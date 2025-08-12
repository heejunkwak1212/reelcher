import { searchSchema } from '@/utils/validators'
import { runTaskAndGetItems, runTaskAndGetItemsWithMeta, startTaskRun, waitForRunItems, abortRun } from '@/lib/apify'
import type { IHashtagItem, IReelDetail, IProfileSummary, ISearchRow } from '@/types'
import { searchLimiter } from '@/lib/ratelimit'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json(
    {
      message: 'POST only. Example body',
      example: { keyword: '재테크', minViews: 0, limit: '30' },
    },
    { status: 405 },
  )
}

export async function POST(req: Request) {
  try {
    // Optional Turnstile token verification (env-gated)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
    if (turnstileSecret) {
      try {
        const body = await req.clone().json().catch(() => ({} as any))
        const token = body?.turnstileToken
        if (!token) return new Response('CAPTCHA required', { status: 400 })
        const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: turnstileSecret, response: token }),
        }).then(r => r.json()).catch(() => ({ success: false }))
        if (!verify?.success) return new Response('CAPTCHA failed', { status: 400 })
      } catch {}
    }
    if (searchLimiter) {
      const ip = req.headers.get('x-forwarded-for') || 'anon'
      const res = await searchLimiter.limit(`search:${ip}`)
      if (!res.success) return new Response('Too Many Requests', { status: 429 })
    }

    const body = await req.json()
    const input = searchSchema.parse(body)

    const token = process.env.APIFY_TOKEN
    if (!token) return new Response('APIFY_TOKEN missing', { status: 500 })

    // Require auth for costful operation
    const supabase = supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Credits reservation (dev limit "5" skips reservation)
    const reserveAmount = input.limit === '60' ? 200 : input.limit === '30' ? 100 : 0
    const creditsEndpoint = new URL('/api/credits/consume', req.url).toString()
    let didReserve = false
    if (reserveAmount > 0) {
      const resv = await fetch(creditsEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, reserve: reserveAmount }) })
      if (!resv.ok) {
        const msg = await resv.text().catch(() => '')
        return new Response(msg || 'Insufficient credits', { status: resv.status })
      }
      didReserve = true
    }

    let settle: null | ((finalCount: number) => Promise<void>) = null
    settle = async (finalCount: number) => {
      if (!didReserve || reserveAmount <= 0) return
      const toCharge = Math.floor((finalCount / 30) * 100)
      const rollback = Math.max(0, reserveAmount - toCharge)
      const commit = Math.max(0, Math.min(reserveAmount, toCharge))
      await fetch(creditsEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, commit, rollback }) }).catch(() => {})
    }

    const resultsLimit = Number(input.limit) as 30 | 60 | 90 | 120
    // Auto-detect region from keyword language (very simple heuristic)
    const keywordHasKorean = /[\uac00-\ud7af]/.test(input.keyword)
    const inferredRegion = keywordHasKorean ? 'KR' : undefined
    // Use Task default proxy (Automatic). We don't override proxy to avoid pool exhaustion.
    const proxyOpt: Record<string, unknown> = {}
    // sanitize hashtag for actor regex: remove leading '#', trim whitespace, drop forbidden chars
    const plainHashtag = input.keyword
      .replace(/^#/, '')
      .normalize('NFKC')
      .trim()
      .replace(/[!?.,:;\-+=*&%$#@\/\\~^|<>()\[\]{}"'`\s]+/g, '')

    // 1) Hashtag Scraper (reels only) → collect URLs to feed into details
    // Setup abort handling: if client disconnects, abort all Apify runs (best-effort)
    const apifyRunIds = new Set<string>()
    const onAbort = () => {
      const idList = Array.from(apifyRunIds)
      Promise.all(idList.map(runId => abortRun({ token, runId }))).catch(() => {})
    }
    try { req.signal.addEventListener('abort', onAbort, { once: true }) } catch {}
    const getUrl = (x: any) => {
      const sc = x?.shortCode || x?.shortcode || x?.short_code || x?.code
      return x?.url || x?.postUrl || x?.link || (sc ? `https://www.instagram.com/p/${sc}/` : undefined)
    }
    // Use Task configured for reels; override hashtags/limit only
    const taskId = 'waxen_space/instagram-hashtag-scraper-task'
    let hashtagItems: IHashtagItem[] = []
    const hashtagErrors: string[] = []
    // Date filter disabled in stage-1 (MVP). Keep helper stub for future use.
    const getItemTs = (_x: any): number | undefined => undefined
    const seenStage1 = new Set<string>()
    let hashtagFiltered: IHashtagItem[] = []
    // If the hashtag itself has finite items, don't loop endlessly.
    // Strategy:
    // Single task call with requested resultsLimit (supports 15..120). We avoid repeated calls to prevent duplicates and save cost.
    let attempts = 0
    let totalDiscoveredUrls = 0
    {
      attempts++
      try {
        const firstLimit = resultsLimit
        const started1 = await startTaskRun({ taskId, token, input: { hashtags: [plainHashtag], resultsLimit: firstLimit, whatToScrape: 'reels', firstPageOnly: false } })
        apifyRunIds.add(started1.runId)
        const run1 = await waitForRunItems<IHashtagItem>({ token, runId: started1.runId })
        const batch1 = Array.isArray(run1.items) ? run1.items : []
        hashtagItems = [...hashtagItems, ...batch1]
        for (const it of batch1) {
          const u = getUrl(it)
          if (!u) continue
          if (!seenStage1.has(u)) totalDiscoveredUrls++
          if (seenStage1.has(u)) continue
          seenStage1.add(u)
          hashtagFiltered.push(it)
        }
        // No second call; we depend on the single larger batch to avoid duplicate sets.
      } catch (e) { hashtagErrors.push((e as Error).message) }
    }
    // Note: No iterative re-fetch (MVP). We avoid repeated calls to control costs.
    if (hashtagItems.length === 0 && hashtagErrors.length > 0) {
      const reason = hashtagErrors.join(' | ')
      const l = reason.toLowerCase()
      const isPayment = l.includes('payment') || l.includes('insufficient') || l.includes('credit') || l.includes('402') || l.includes('limit')
      const status = isPayment ? 402 : 502
      const msg = isPayment ? 'Apify credits are likely exhausted. Top up to continue.' : 'Upstream hashtag task failed.'
      return Response.json({ error: 'UpstreamError', message: msg, reason }, { status })
    }
    // hashtagFiltered holds unique items from stage-1
    // Derive URL list from filtered items
    let reelUrls = Array.from(new Set(
      hashtagFiltered.map(i => getUrl(i)).filter((u): u is string => typeof u === 'string'),
    )).slice(0, resultsLimit)
    // If fewer than or equal to 3 posts exist for the hashtag → cancel (use raw items count)
    if (hashtagItems.length <= 3) {
      if (settle) await settle(0)
      return Response.json({ error: 'TooFewResults', message: '해당 해시태그에 해당하는 게시물(릴스)이 3개 이하인 경우 검색이 불가능합니다.' }, { status: 400 })
    }

    // 2) Reel details via directUrls in 30-sized batches; run with parallelism
    const hasChildVideo = (obj?: any): boolean => {
      const children: any[] = Array.isArray(obj?.childPosts) ? obj.childPosts : []
      for (const c of children) {
        const tt = (c?.productType || c?.type || c?.media_type || '').toString().toLowerCase()
        if (c?.videoUrl || tt.includes('video') || tt.includes('reel') || tt.includes('clip') || tt.includes('clips')) return true
      }
      return false
    }
    const isReelUrl = (u?: string, obj?: any) => {
      const t = (obj?.productType || obj?.type || obj?.media_type || '').toString().toLowerCase()
      const videoLike = !!obj?.videoUrl || t.includes('reel') || t.includes('clip') || t.includes('video') || t.includes('clips') || hasChildVideo(obj)
      return !!u && (/instagram.com\/reel\//.test(u) || videoLike)
    }
    let reels: IReelDetail[] = []
    const target = Math.min(resultsLimit, reelUrls.length || resultsLimit)
    let cursorRounds = 0
    if (reelUrls.length > 0) {
      const batchSize = 30
      const detailsTaskId = 'waxen_space/instagram-scraper-task'
      const maxIdx = Math.min(reelUrls.length, target)
      const batches: string[][] = []
      for (let i = 0; i < maxIdx; i += batchSize) {
        batches.push(reelUrls.slice(i, i + batchSize))
      }
      // Run all batches in parallel (account-level concurrency/RAM will naturally queue if needed)
      await Promise.all(batches.map(async (batch) => {
        const started = await startTaskRun({ taskId: detailsTaskId, token, input: { directUrls: batch, resultsType: 'posts', addParentData: false, resultsLimit: batch.length } })
        apifyRunIds.add(started.runId)
        const gotMeta = await waitForRunItems<IReelDetail>({ token, runId: started.runId })
        const got = gotMeta.items
        for (const r of got) {
          const u = getUrl(r)
          if (isReelUrl(u, r) && !reels.some(x => getUrl(x) === u)) reels.push(r)
        }
        cursorRounds++
      }))
      reels = reels.slice(0, target)
    }
    // No additional fallback calls; proceed with what we have

    // usernames from hashtag stage or fallback to details
    const usernamesFromHashtag: string[] = []
    const usernamesFromDetails = reels.map(r => (r as any).ownerUsername || (r as any).username).filter(Boolean) as string[]
    const usernames = Array.from(new Set([...(usernamesFromHashtag || []), ...(usernamesFromDetails || [])]))

    // 3) Profiles: process usernames in 30-sized batches sequentially (no parallel)
    let profiles: IProfileSummary[] = []
    if (usernames.length) {
      const chunkSize = 30
      for (let i = 0; i < usernames.length; i += chunkSize) {
        const slice = usernames.slice(i, i + chunkSize)
        const started = await startTaskRun({ taskId: 'waxen_space/instagram-profile-scraper-task', token, input: { usernames: slice, ...proxyOpt } })
        apifyRunIds.add(started.runId)
        const res = await waitForRunItems<IProfileSummary>({ token, runId: started.runId })
        profiles.push(...res.items)
      }
    }

    const usernameToFollowers = new Map<string, number | undefined>()
    const usernameToFollowing = new Map<string, number | undefined>()
    profiles.forEach(p => {
      if (p.username) {
        const followers = (p as any).followers ?? (p as any).followersCount
        const following = (p as any).following ?? (p as any).followingCount
        usernameToFollowers.set(p.username, followers)
        if (following !== undefined) usernameToFollowing.set(p.username, following)
      }
    })

    // Merge
    // Prefer using the original display/thumbnail URL directly.
    // Our image-proxy will set proper headers (Referer/UA) and follow redirects.
    const pickThumb = (d: any): string | undefined => {
      const candidates: (string | undefined)[] = [d?.displayUrl, d?.display_url, d?.thumbnailUrl, d?.imageUrl, d?.thumbnailSrc, d?.thumbnail, d?.images?.[0]?.url]
      for (const c of candidates) { if (typeof c === 'string' && c.startsWith('http')) return c }
      // Try deriving from video URL (CDN often serves frame previews at .jpg)
      const v: string | undefined = d?.videoUrl || d?.video_url
      if (typeof v === 'string' && v.startsWith('http')) {
        try {
          const u = new URL(v)
          // heuristic: replace extension with .jpg
          const path = u.pathname.replace(/\.[a-z0-9]+$/i, '.jpg')
          const guess = `${u.origin}${path}${u.search}`
          return guess
        } catch {}
      }
      return undefined
    }
    const sanitizeNonNegative = (n: any): number | undefined => {
      const v = typeof n === 'number' ? n : Number.isFinite(n) ? Number(n) : undefined
      if (typeof v === 'number' && v >= 0) return v
      return undefined
    }
    const pickDuration = (d: any): number | undefined => {
      const dur = d?.duration ?? d?.videoDuration ?? d?.durationSec ?? d?.videoDurationSeconds
      const num = typeof dur === 'number' ? dur : Number(dur)
      if (!Number.isFinite(num)) return undefined
      return Math.floor(num)
    }
    let rows: ISearchRow[] = reels.map(d => {
      const url = getUrl(d)
      // match by url OR by shortcode when url normalizes differently between actors
      const shortA = (url || '').match(/\/p\/([^/]+)\//)?.[1]
      const h = (hashtagItems as IHashtagItem[]).find(i => {
        const hu = getUrl(i)
        if (hu && hu === url) return true
        const shortB = (hu || '').match(/\/p\/([^/]+)\//)?.[1]
        return shortA && shortB && shortA === shortB
      })
      const owner = (d as any).ownerUsername || (d as any)?.username || (h as any)?.ownerUsername
      const followersFromDetails = (d as any)?.ownerFollowers ?? (d as any)?.owner?.followersCount ?? (d as any)?.followersCount
      const followingFromDetails = (d as any)?.ownerFollowing ?? (d as any)?.owner?.followingCount ?? (d as any)?.followingCount
      const followers = owner ? (usernameToFollowers.get(owner) ?? followersFromDetails) : followersFromDetails
      const following = owner ? (usernameToFollowing.get(owner) ?? followingFromDetails) : followingFromDetails
      const rawViews = (d as any)?.views ?? (d as any)?.playCount ?? (d as any)?.videoPlayCount ?? (d as any)?.plays ?? (d as any)?.viewCount
      const rawLikes = (h as any)?.likes ?? (d as any)?.likes ?? (d as any)?.likesCount ?? (d as any)?.likeCount ?? (d as any)?.edgeMediaPreviewLike?.count ?? (d as any)?.edge_liked_by?.count
      const rawComments = (h as any)?.comments ?? (d as any)?.comments ?? (d as any)?.commentsCount ?? (d as any)?.commentCount
      const views = sanitizeNonNegative(rawViews)
      const likes = sanitizeNonNegative(rawLikes)
      const comments = sanitizeNonNegative(rawComments)
      const likesDisplay = ((): number | undefined | 'private' => {
        if (rawLikes === null || rawLikes === undefined) return 'private'
        const v = sanitizeNonNegative(rawLikes)
        return typeof v === 'number' ? v : 'private'
      })()
      // taken date (day precision)
      const takenAtRaw = (d as any)?.takenAt ?? (h as any)?.timestamp
      const takenDate = (() => {
        const ts = typeof takenAtRaw === 'string' ? Date.parse(takenAtRaw) : typeof takenAtRaw === 'number' ? takenAtRaw : undefined
        if (!ts) return undefined
        const dt = new Date(ts)
        const yyyy = dt.getFullYear()
        const mm = String(dt.getMonth() + 1).padStart(2, '0')
        const dd = String(dt.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      })()
      return {
        url,
        username: owner,
        views,
        likes: likesDisplay as any,
        comments,
        followers,
        following,
        thumbnailUrl: pickThumb(d),
        videoUrl: (d as any)?.videoUrl || (d as any)?.video_url,
        caption: (h as any)?.caption || (d as any)?.caption,
        duration: pickDuration(d),
        takenDate,
      }
    })

    // Followers backfill loop: ensure we have as many rows with followers as possible
    let backfillRounds = 0
    const maxBackfillRounds = 0
    while (rows.filter(r => typeof r.followers === 'number').length < Math.min(target, rows.length) && backfillRounds < maxBackfillRounds) {
      // find usernames missing followers
      const missingUsernames = rows
        .filter(r => r.username && (r.followers === undefined || r.followers === null))
        .map(r => r.username as string)
      const uniqueMissing = Array.from(new Set(missingUsernames)).filter(u => !profiles.some(p => p.username === u))
      if (uniqueMissing.length === 0) break
      const started = await startTaskRun({ taskId: 'waxen_space/instagram-profile-scraper-task', token, input: { usernames: uniqueMissing.slice(0, 20), ...proxyOpt } })
      apifyRunIds.add(started.runId)
      const more = await waitForRunItems<IProfileSummary>({ token, runId: started.runId })
      const moreProfiles = more.items
      profiles = [...profiles, ...moreProfiles]
      usernameToFollowers.clear()
      usernameToFollowing.clear()
      profiles.forEach(p => {
        if (p.username) {
          const followers = (p as any).followers ?? (p as any).followersCount
          const following = (p as any).following ?? (p as any).followingCount
          usernameToFollowers.set(p.username, followers)
          if (following !== undefined) usernameToFollowing.set(p.username, following)
        }
      })
      // rebuild rows with new followers
      rows = reels.map(d => {
        const url = getUrl(d)
        const shortA = (url || '').match(/\/p\/([^/]+)\//)?.[1]
      const h = (hashtagItems as IHashtagItem[]).find(i => {
          const hu = getUrl(i)
          if (hu && hu === url) return true
          const shortB = (hu || '').match(/\/p\/([^/]+)\//)?.[1]
          return shortA && shortB && shortA === shortB
        })
        const owner = (d as any).ownerUsername || (d as any)?.username || (h as any)?.ownerUsername
        const followersFromDetails = (d as any)?.ownerFollowers ?? (d as any)?.owner?.followersCount ?? (d as any)?.followersCount
        const followingFromDetails = (d as any)?.ownerFollowing ?? (d as any)?.owner?.followingCount ?? (d as any)?.followingCount
        const followers = owner ? (usernameToFollowers.get(owner) ?? followersFromDetails) : (usernameToFollowers.get((d as any)?.username) ?? followersFromDetails)
        const following = owner ? (usernameToFollowing.get(owner) ?? followingFromDetails) : (usernameToFollowing.get((d as any)?.username) ?? followingFromDetails)
        const rawViews = (d as any)?.views ?? (d as any)?.playCount ?? (d as any)?.videoPlayCount ?? (d as any)?.plays ?? (d as any)?.viewCount
        const rawLikes = (h as any)?.likes ?? (d as any)?.likes ?? (d as any)?.likesCount ?? (d as any)?.likeCount ?? (d as any)?.edgeMediaPreviewLike?.count ?? (d as any)?.edge_liked_by?.count
        const rawComments = (h as any)?.comments ?? (d as any)?.comments ?? (d as any)?.commentsCount ?? (d as any)?.commentCount
        const views = sanitizeNonNegative(rawViews)
        const likes = sanitizeNonNegative(rawLikes)
        const comments = sanitizeNonNegative(rawComments)
        const likesDisplay = ((): number | undefined | 'private' => {
          if (rawLikes === null || rawLikes === undefined) return 'private'
          const v = sanitizeNonNegative(rawLikes)
          return typeof v === 'number' ? v : 'private'
        })()
        const takenAtRaw2 = (d as any)?.takenAt ?? (h as any)?.timestamp
        const takenDate2 = (() => {
          const ts = typeof takenAtRaw2 === 'string' ? Date.parse(takenAtRaw2) : typeof takenAtRaw2 === 'number' ? takenAtRaw2 : undefined
          if (!ts) return undefined
          const dt = new Date(ts)
          const yyyy = dt.getFullYear()
          const mm = String(dt.getMonth() + 1).padStart(2, '0')
          const dd = String(dt.getDate()).padStart(2, '0')
          return `${yyyy}-${mm}-${dd}`
        })()
        return {
          url,
          username: owner,
          views,
          likes: likesDisplay as any,
          comments,
          followers,
          following,
          thumbnailUrl: pickThumb(d),
          videoUrl: (d as any)?.videoUrl || (d as any)?.video_url,
          caption: (h as any)?.caption || (d as any)?.caption,
          duration: pickDuration(d),
          takenDate: takenDate2,
        }
      })
      backfillRounds++
    }

    // Filters (period removed)
    const filtered = rows
    const finalRows = filtered
    if (input.debug) {
      // Default sort views desc for consistency
      const sorted = [...finalRows].sort((a, b) => ((b.views ?? 0) - (a.views ?? 0)))
      const finalCount = sorted.length
      const prorationSuggestion = Math.floor((finalCount / 30) * 100)
      const creditsToCharge = prorationSuggestion
      if (settle) await settle(finalCount)
      return Response.json({
        items: sorted,
        debug: {
          inferredRegion,
          collected: reels.length,
          uniqueUrls: new Set(reels.map(r => (r as any).url)).size,
          hashtagItems: 0,
          usernamesCollected: usernames.length,
          rounds: cursorRounds,
          sample: reels.slice(0, 3).map(r => ({ url: getUrl(r), hasVideo: !!(r as any)?.videoUrl })),
          inputs: {
            hashtagInput: { hashtags: [plainHashtag], resultsLimit, whatToScrape: 'reels' },
            detailsPreferred: { hashtags: [plainHashtag], resultsLimit: target, whatToScrape: 'reels', ...proxyOpt },
          },
          apify: {
            hashtagRun: {},
            hashtagError: undefined,
            hashtagRunGlobal: null,
          },
          fallbackPlan: reels.length < target ? `used fallbacks to reach ${reels.length}/${target}` : 'not needed',
          stages: {
            detailsFetched: reels.length,
            profilesFetched: profiles.length,
            rowsWithFollowers: rows.filter(r => typeof r.followers === 'number').length,
            backfillRounds,
          },
          prorationSuggestion,
        },
        credits: { toCharge: creditsToCharge, basis: 100, per: 30 },
      })
    }
    {
      const sorted = [...finalRows].sort((a, b) => ((b.views ?? 0) - (a.views ?? 0)))
      const finalCount = sorted.length
      const toCharge = Math.floor((finalCount / 30) * 100)
      if (settle) await settle(finalCount)
      return Response.json({ items: sorted, credits: { toCharge, basis: 100, per: 30 } })
    }
  } catch (e) {
    // Best-effort: no settle here because we don't have user/reserve in this scope anymore
    // Always return JSON for easier debugging from clients/CLI
    // Include Zod issues when available
    const anyErr: any = e
    const isZod = Array.isArray(anyErr?.issues)
    const payload = isZod
      ? { error: 'ValidationError', issues: anyErr.issues }
      : { error: anyErr?.message || 'Bad Request' }
    return Response.json(payload, { status: 400 })
  }
}

