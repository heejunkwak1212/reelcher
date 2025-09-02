import { searchSchema } from '@/utils/validators'
import { runTaskAndGetItems, runTaskAndGetItemsWithMeta, startTaskRun, waitForRunItems, abortRun } from '@/lib/apify'
import type { IHashtagItem, IReelDetail, IProfileSummary, ISearchRow } from '@/types'
import { searchLimiter } from '@/lib/ratelimit'
import { supabaseServer } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'

// Instagram 검색 요청 스키마
const instagramSearchSchema = z.object({
  searchType: z.enum(['keyword', 'profile']),
  keyword: z.string().optional(),
  profileUrl: z.string().optional(),
  limit: z.union([
    z.literal(5), z.literal(30), z.literal(60), z.literal(90), z.literal(120),
    z.literal('5'), z.literal('30'), z.literal('60'), z.literal('90'), z.literal('120')
  ]),
  filters: z.object({
    period: z.enum(['day', 'week', 'month', 'month2', 'month3', 'month6', 'year', 'all']).optional(),
    minViews: z.number().min(0).optional(),
  }).optional().default({}),
  debug: z.boolean().optional(),
  turnstileToken: z.string().optional(),
  queuedRunId: z.string().optional() // 대기열에서 완료된 runId
})

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
  console.log('=== Instagram API 호출 시작 ===')
  try {
    // Read body once and reuse to avoid stream re-consumption errors
    const body = await req.json().catch(() => ({} as any))
    console.log('Instagram API 요청 본문:', JSON.stringify(body, null, 2))
    
    // 요청 본문을 먼저 저장만 하고 검증은 나중에
    console.log('Instagram API 요청 본문 저장 완료')
    
    // Optional Turnstile token verification (env-gated)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY
    const isDevelopment = process.env.NODE_ENV === 'development'
    console.log('Turnstile 검증 시작. Secret 존재:', !!turnstileSecret, '개발환경:', isDevelopment)
    if (turnstileSecret && !isDevelopment) {
      try {
        const token = (body as any)?.turnstileToken
        console.log('Turnstile 토큰:', token ? '존재함' : '없음')
        if (!token) {
          console.log('Turnstile 토큰이 없어서 400 반환')
          return new Response('CAPTCHA required', { status: 400 })
        }
        console.log('Turnstile 서버 검증 시작...')
        const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: turnstileSecret, response: token }),
        }).then(r => r.json()).catch(() => ({ success: false }))
        console.log('Turnstile 검증 결과:', verify)
        if (!verify?.success) {
          console.log('Turnstile 검증 실패로 400 반환')
          return new Response('CAPTCHA failed', { status: 400 })
        }
        console.log('Turnstile 검증 성공')
      } catch (e) {
        console.error('Turnstile 검증 중 예외 발생:', e)
      }
    }
    console.log('Rate Limiting 검사 시작. Limiter 존재:', !!searchLimiter)
    if (searchLimiter) {
      const ip = req.headers.get('x-forwarded-for') || 'anon'
      console.log('Rate Limiting IP:', ip)
      const res = await searchLimiter.limit(`search:${ip}`)
      console.log('Rate Limiting 결과:', res)
      if (!res.success) {
        console.log('Rate Limiting 실패 - 429 반환')
        return new Response('Too Many Requests', { status: 429 })
      }
    }

    console.log('Instagram API body validation 시작:', body)
    console.log('현재 NODE_ENV:', process.env.NODE_ENV)
    
    // 관리자 체크를 먼저 수행 (validation 전에)
    const supabaseForAuth = await supabaseServer()
    const { data: { user } } = await supabaseForAuth.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // 디버깅: 사용자 정보 로깅
    console.log('🔍 Instagram API - User ID:', user.id)
    console.log('🔍 Instagram API - User Email:', user.email)
    
    let isAdmin = false
    try {
      const { data: userData } = await supabaseForAuth.from('users').select('role').eq('user_id', user.id).single()
      isAdmin = userData?.role === 'admin'
      console.log('관리자 체크 결과:', isAdmin)
    } catch (adminCheckError) {
      console.log('관리자 체크 실패:', adminCheckError)
    }
    
    let input: any
    try {
      // 관리자인 경우 5개 검색 허용을 위해 특별 처리
      if (isAdmin && (body.limit === '5' || body.limit === 5)) {
        console.log('관리자 5개 검색 특별 허용')
        // 임시로 30으로 변경해서 validation 통과시킨 후 다시 5로 복원
        const tempBody = { ...body, limit: '30' }
        input = instagramSearchSchema.parse(tempBody)
        input.limit = '5' // 다시 5로 복원
      } else {
        input = instagramSearchSchema.parse(body)
      }
      console.log('Instagram API validation 성공:', input)
      console.log('Instagram API filters 확인:', JSON.stringify(input.filters, null, 2))
      
      // 대기열에서 완료된 runId가 있는 경우 해당 결과 사용
      if (input.queuedRunId) {
        console.log(`🔍 대기열 완료된 runId로 결과 가져오기: ${input.queuedRunId}`)
        try {
          const { waitForRunItems } = await import('@/lib/apify')
          const token = process.env.APIFY_TOKEN!
          const result = await waitForRunItems({ token, runId: input.queuedRunId })
          
          return Response.json({ 
            items: result.items || [],
            credits: { toCharge: 0, basis: 100, per: 30 },
            fromQueue: true
          })
        } catch (error) {
          console.error('❌ 대기열 runId 결과 가져오기 실패:', error)
          return Response.json({ error: '대기열 결과를 가져올 수 없습니다.' }, { status: 500 })
        }
      }
    } catch (validationError: any) {
      console.error('Instagram API validation 실패:', {
        error: validationError,
        issues: validationError?.issues,
        message: validationError?.message
      })
      return Response.json({ 
        error: 'Validation failed',
        details: validationError,
        receivedBody: body
      }, { status: 400 })
    }

    const token = process.env.APIFY_TOKEN
    console.log('APIFY_TOKEN 확인:', token ? 'TOKEN 존재' : 'TOKEN 없음')
    if (!token) return new Response('APIFY_TOKEN missing', { status: 500 })

    // 이미 위에서 user 인증 완료됨
    const supabase = await supabaseServer()

    // Credits reservation
    // Dev limit '5' skips reservation; for others, map 30→100, 60→200, 90→300, 120→400
    // Developer bypass: if user email matches DEV list -> do not consume credits
    let isDev = false
    try {
      const { data } = await supabase.from('users').select('email').eq('id', user.id).single()
      const email = (data?.email || '').toString()
      const devList = (process.env.DEV_EMAIL_WHITELIST || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
      if (email && devList.includes(email.toLowerCase())) isDev = true
    } catch {}

    // 관리자 체크는 이미 위에서 완료됨

    // Plan-based limits (관리자는 모든 제한 무시)
    let plan: 'free' | 'starter' | 'pro' | 'business' | string = 'free'
    if (!isAdmin) {
      try {
        const { data: prof } = await supabase.from('profiles').select('plan').eq('user_id', user.id).single()
        plan = (prof?.plan as any) || 'free'
      } catch {}
      const lim = input.limit
      if (plan === 'free' && lim !== '30' && lim !== '5') {
        return new Response('FREE plan allows only 30 results.', { status: 403 })
      }
      if (plan === 'starter' && (lim === '90' || lim === '120')) {
        return new Response('STARTER plan allows up to 60 results.', { status: 403 })
      }
      if (plan === 'pro' && lim === '120') {
        return new Response('PRO plan allows up to 90 results.', { status: 403 })
      }
    } else {
      console.log('관리자 계정: 모든 제한 우회')
    }

    // 관리자가 아닌 경우에만 크레딧 즉시 차감 (search-record API 방식)
    let expectedCredits = 0
    let searchRecordId: string | null = null
    
    if (!isDev && !isAdmin) {
      // 크레딧 계산
      expectedCredits = (
        (input.limit === '30' || input.limit === 30) ? 100 :
        (input.limit === '60' || input.limit === 60) ? 200 :
        (input.limit === '90' || input.limit === 90) ? 300 :
        (input.limit === '120' || input.limit === 120) ? 400 : 0
      )

      // 크레딧이 필요한 경우 즉시 차감 및 검색 기록 생성
      if (expectedCredits > 0) {
        try {
          const keyword = input.hashtag || input.username || ''
          const recordPayload = {
            platform: 'instagram' as const,
            search_type: input.searchType as 'keyword' | 'profile',
            keyword: input.searchType === 'profile' ? (keyword.startsWith('@') ? keyword : `@${keyword}`) : keyword,
            expected_credits: expectedCredits,
            requested_count: Number(input.limit),
            status: 'pending' as const
          }
          
          console.log(`🚀 Instagram 검색 시작 즉시 기록 생성:`, recordPayload)
          
          const recordRes = await fetch(new URL('/api/me/search-record', req.url), {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify(recordPayload)
          })
          
          if (recordRes.ok) {
            const recordData = await recordRes.json()
            searchRecordId = recordData.id
            console.log(`✅ Instagram 검색 기록 생성 성공: ${searchRecordId}`)
          } else {
            const errorText = await recordRes.text()
            console.error(`❌ Instagram 검색 기록 생성 실패: ${recordRes.status} ${errorText}`)
            
            // 크레딧 부족 또는 기타 오류 처리
            if (recordRes.status === 402) {
              return new Response('크레딧이 부족합니다.', { status: 402 })
            }
            return new Response('검색 기록 생성 실패', { status: 500 })
          }
        } catch (error) {
          console.error('❌ Instagram 검색 기록 생성 오류:', error)
          return new Response('검색 기록 생성 실패', { status: 500 })
        }
      }
    }

    // 세션 관리 변수들을 전역 스코프에 선언
    let searchSessionId: string | undefined = undefined
    let queueManager: any = undefined
    
    // settle 함수 제거 - search-record API 방식으로 대체

    const resultsLimit = Number(input.limit) as 5 | 30 | 60 | 90 | 120
    console.log('Instagram 검색 타입:', input.searchType)
    
    // 검색 타입에 따른 분기
    if (input.searchType === 'profile') {
      console.log('Instagram 프로필 검색 시작')
      return await handleProfileSearch(req, input, resultsLimit, token, user.id, searchRecordId, expectedCredits)
    }
    
    // 기존 키워드 검색 로직
    console.log('Instagram 키워드 검색 시작')
    console.log('🔍 입력 파라미터:', {
      keyword: input.keyword,
      searchType: input.searchType,
      filters: input.filters,
      limit: input.limit
    })
    
    // 원본 키워드 저장 (유튜브와 동일하게)
    const originalKeyword = input.keyword || ''
    
    // Auto-detect region from keyword language (very simple heuristic)
    const keywordHasKorean = /[\uac00-\ud7af]/.test(originalKeyword)
    const inferredRegion = keywordHasKorean ? 'KR' : undefined
    // Use Task default proxy (Automatic). We don't override proxy to avoid pool exhaustion.
    const proxyOpt: Record<string, unknown> = {}
    // sanitize hashtag for actor regex: remove leading '#', trim whitespace, drop forbidden chars
    // Multi keyword normalization (max 3). Fallback to single keyword
    const rawKeywords: string[] = Array.isArray((input as any).keywords) && (input as any).keywords!.length
      ? ((input as any).keywords as string[])
      : [originalKeyword]
    const normalizedKeywords = Array.from(new Set(
      rawKeywords.map(k => k
        .replace(/^#/, '')
        .normalize('NFKC')
        .trim()
        .replace(/[!?.,:;\-+=*&%$#@\/\\~^|<>()\[\]{}"'`\s]+/g, '')
      ).filter(Boolean)
    )).slice(0, 3)
    const plainHashtag = normalizedKeywords[0]
    
    console.log('🏷️ 키워드 변환:', {
      originalKeyword,
      plainHashtag,
      normalizedKeywords
    })

    // 1) Hashtag Scraper (reels only) → collect URLs to feed into details
    // Setup abort handling: if client disconnects, abort all Apify runs (best-effort)
    const apifyRunIds = new Set<string>()
    const onAbort = () => {
      const idList = Array.from(apifyRunIds)
      Promise.all(idList.map(runId => abortRun({ token, runId }))).catch(() => {})
    }
    try { req.signal.addEventListener('abort', onAbort, { once: true }) } catch {}
    
    // Instagram 키워드 검색 전체를 try-catch로 감싸서 대기열 처리 에러 방지
    try {
    const getUrl = (x: any) => {
      const sc = x?.shortCode || x?.shortcode || x?.short_code || x?.code
      return x?.url || x?.postUrl || x?.link || (sc ? `https://www.instagram.com/p/${sc}/` : undefined)
    }
    // Use Task configured for reels; override hashtags/limit only
    const taskId = 'bold_argument/instagram-hashtag-scraper-task'
    let hashtagItems: IHashtagItem[] = []
    const hashtagErrors: string[] = []
    // Date filter disabled in stage-1 (MVP). Keep helper stub for future use.
    const getItemTs = (_x: any): number | undefined => undefined
    const seenStage1 = new Set<string>()
    let hashtagFiltered: IHashtagItem[] = []
    // If the hashtag itself has finite items, don't loop endlessly.
    // Strategy:
    // Run Stage-1 per keyword with fair split and 1.3x oversampling cap, then dedupe/merge.
    let attempts = 0
    let totalDiscoveredUrls = 0
    {
      attempts++
      try {
        console.log('Instagram 검색 시작 - normalizedKeywords:', normalizedKeywords)
        const kwCount = Math.max(1, normalizedKeywords.length)
        const base = Math.floor(resultsLimit / kwCount)
        let remainder = resultsLimit % kwCount
        // Fair target per keyword
        const perTarget = normalizedKeywords.map(() => base + (remainder-- > 0 ? 1 : 0))
        const oversampleFactor = normalizedKeywords.length >= 2 ? 1.3 : 1.0
        const perOversample = perTarget.map(n => Math.ceil(n * oversampleFactor))
        
        console.log('Instagram 배치 계획:', { kwCount, base, perTarget, perOversample })

        // 검색 세션 ID 생성 (전체 검색의 연속성 보장)  
        searchSessionId = `instagram_${user.id}_${Date.now()}`
        console.log(`🎯 Instagram 검색 세션 생성: ${searchSessionId}`)
        
        const { getDatabaseQueueManager } = await import('@/lib/db-queue-manager')
        queueManager = getDatabaseQueueManager()

        // 첫 번째 키워드로 RAM 상태 확인 (즉시 실행 시도)
        const firstKeyword = normalizedKeywords[0]
        const firstSlice = Math.min(30, perOversample[0])
        
        console.log(`🎯 Instagram 첫 번째 키워드 "${firstKeyword}" 즉시 실행 시도 - slice: ${firstSlice}`)
        
        const firstResult = await queueManager.executeWithSessionContinuity(
          taskId,
          { hashtags: [firstKeyword], resultsLimit: firstSlice, whatToScrape: 'reels', firstPageOnly: false },
          {
            userId: user.id,
            priority: 'high',
            maxRetries: 3,
            sessionId: searchSessionId,
            sessionStep: 1,
            originalApiEndpoint: '/api/search',
            originalPayload: body,
            onQueued: (position: number) => {
              console.log(`🔄 Instagram 키워드 검색이 대기열 ${position}번째에 추가됨`)
            }
          }
        )
        
        // 대기열에 추가된 경우 즉시 202 응답 반환
        if (!firstResult.success) {
          console.log(`⏳ [STEP 1] Instagram 키워드 검색이 대기열에 추가됨: ${firstResult.message}`)
          console.log(`🔄 [STEP 2] 인스타그램 대기열 추가 상세:`)
          console.log(`  - 사용자: ${user.id} (${user.email})`)
          console.log(`  - 세션ID: ${searchSessionId}`)
          console.log(`  - 대기열ID: ${firstResult.queueId}`)
          console.log(`  - 메시지: ${firstResult.message}`)
          console.log(`📤 [STEP 3] 202 응답 반환 준비 중...`)
          
          const response202 = Response.json({
            success: false,
            message: `Instagram 검색이 대기열에 추가되었습니다. ${firstResult.message}`,
            queueId: firstResult.queueId,
            sessionId: searchSessionId,
            debug: {
              userId: user.id,
              taskId,
              sessionId: searchSessionId,
              timestamp: new Date().toISOString()
            }
          }, { status: 202 })
          
          console.log(`✅ [STEP 4] 202 응답 생성 완료, 반환 중...`)
          console.log(`📋 [STEP 5] 응답 내용:`, {
            status: 202,
            queueId: firstResult.queueId,
            sessionId: searchSessionId,
            timestamp: new Date().toISOString()
          })
          
          return response202
        }
        
        // 즉시 실행 성공 - 나머지 키워드들도 처리
        console.log(`🚀 RAM 여유로움 - 즉시 실행 진행`)
        
        const runs = await Promise.all(normalizedKeywords.map(async (kw, idx) => {
          if (idx === 0) {
            // 첫 번째 키워드는 이미 처리됨
            const started = { runId: firstResult.runId! }
            console.log(`Instagram Apify 액터 시작됨 - runId: ${started.runId}`)
            apifyRunIds.add(started.runId)
            const run = await waitForRunItems<IHashtagItem>({ token, runId: started.runId })
            console.log(`Instagram Apify 액터 완료 - runId: ${started.runId}, items: ${run.items?.length || 0}개`)
            return Array.isArray(run.items) ? run.items : []
          }
          
          const want = Math.max(1, perOversample[idx])
          const batches = Math.ceil(want / 30)
          let acc: IHashtagItem[] = []
          console.log(`Instagram 키워드 "${kw}" 처리 시작 - want: ${want}, batches: ${batches}`)
          for (let b = 0; b < batches; b++) {
            const slice = Math.min(30, want - b * 30)
            if (slice <= 0) break
            console.log(`Instagram Apify 액터 호출 시작 - taskId: ${taskId}, kw: ${kw}, slice: ${slice}`)
            
            const result = await queueManager.executeWithSessionContinuity(
              taskId,
              { hashtags: [kw], resultsLimit: slice, whatToScrape: 'reels', firstPageOnly: false },
              {
                userId: user.id,
                priority: 'high',
                maxRetries: 3,
                sessionId: searchSessionId,
                sessionStep: 1,
                originalApiEndpoint: '/api/search',
                originalPayload: body,
                onQueued: (position: number) => {
                  console.log(`🔄 Instagram 키워드 검색이 대기열 ${position}번째에 추가됨`)
                }
              }
            )
            
            if (!result.success) {
              console.log(`⚠️ 추가 키워드 "${kw}" 대기열 추가됨, 건너뜀`)
              continue
            }
            
            const started = { runId: result.runId! }
            console.log(`Instagram Apify 액터 시작됨 - runId: ${started.runId}`)
            apifyRunIds.add(started.runId)
            const run = await waitForRunItems<IHashtagItem>({ token, runId: started.runId })
            console.log(`Instagram Apify 액터 완료 - runId: ${started.runId}, items: ${run.items?.length || 0}개`)
            acc = acc.concat(Array.isArray(run.items) ? run.items : [])
          }
          return acc
        }))
        hashtagItems = runs.flat()
        
        // 1단계 성공 - 세션 활성화
        queueManager.startSearchSession(searchSessionId)
        for (const it of hashtagItems) {
          const u = getUrl(it)
          if (!u) continue
          if (!seenStage1.has(u)) totalDiscoveredUrls++
          if (seenStage1.has(u)) continue
          seenStage1.add(u)
          hashtagFiltered.push(it)
        }
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
    // Deduped union URLs across keywords, then slice to requested size
    let reelUrls = Array.from(new Set(
      hashtagFiltered.map(i => getUrl(i)).filter((u): u is string => typeof u === 'string'),
    )).slice(0, resultsLimit)
    // If fewer than or equal to 3 posts exist for the hashtag → cancel (use raw items count)
    if (hashtagItems.length <= 3) {
      // 검색 실패 시 search-record 업데이트
      if (searchRecordId) {
        try {
          const updatePayload = {
            id: searchRecordId,
            status: 'failed',
            results_count: 0,
            actual_credits: 0,
            refund_amount: expectedCredits,
            error_message: '해당 해시태그에 해당하는 게시물(릴스)이 3개 이하인 경우 검색이 불가능합니다.'
          }
          
          await fetch(new URL('/api/me/search-record', req.url), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify(updatePayload)
          })
        } catch (error) {
          console.warn('⚠️ 검색 실패 기록 업데이트 실패:', error)
        }
      }
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
      const detailsTaskId = 'bold_argument/instagram-scraper-task'
      const maxIdx = Math.min(reelUrls.length, target)
      const batches: string[][] = []
      for (let i = 0; i < maxIdx; i += batchSize) {
        batches.push(reelUrls.slice(i, i + batchSize))
      }
      // Run all batches in parallel with session continuity
      await Promise.all(batches.map(async (batch) => {
        const queueResult = await queueManager.executeWithSessionContinuity(
          detailsTaskId,
          { directUrls: batch, resultsType: 'posts', addParentData: false, resultsLimit: batch.length },
          {
            userId: user.id,
            priority: 'normal',
            maxRetries: 3,
            sessionId: searchSessionId,
            sessionStep: 2, // 2단계: Details 수집
            originalApiEndpoint: '/api/search',
            originalPayload: body,
            onQueued: (position: number) => {
              console.log(`🔄 Instagram details 검색이 대기열 ${position}번째에 추가됨`)
            }
          }
        )
        
        if (!queueResult.success) {
          console.log(`⏳ Instagram details 검색이 대기열에 추가됨: ${queueResult.message}`)
          // 일부 배치가 대기열에 들어가더라도 다른 배치는 계속 진행
          console.warn(`⚠️ Details 배치 대기열 추가, 다른 배치는 계속 진행: ${queueResult.message}`)
          return // 이 배치만 건너뛰고 다른 배치는 계속
        }
        
        const started = { runId: queueResult.runId! }
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
      // 기존 queueManager 재사용 (이미 DB 기반으로 설정됨)
      
      for (let i = 0; i < usernames.length; i += chunkSize) {
        const slice = usernames.slice(i, i + chunkSize)
        
        const queueResult = await queueManager.executeWithSessionContinuity(
          'bold_argument/instagram-profile-scraper-task',
          { usernames: slice, ...proxyOpt },
          {
            userId: user.id,
            priority: 'low',
            maxRetries: 3,
            sessionId: searchSessionId,
            sessionStep: 3, // 3단계: Profile 수집
            originalApiEndpoint: '/api/search',
            originalPayload: body,
            onQueued: (position: number) => {
              console.log(`🔄 Instagram profile 검색이 대기열 ${position}번째에 추가됨`)
            }
          }
        )
        
        if (!queueResult.success) {
          console.log(`⏳ Instagram profile 검색이 대기열에 추가됨: ${queueResult.message}`)
          // 3단계(프로필) 실패시 경고만 출력하고 계속 진행 (선택적 단계)
          console.warn(`⚠️ Profile 정보 수집 실패, 기본 검색 결과로 계속 진행: ${queueResult.message}`)
          break // 이 루프만 중단하고 기존 결과로 계속
        }
        
        const started = { runId: queueResult.runId! }
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
      // taken date (with time for consistent display)
      const takenAtRaw = (d as any)?.takenAt ?? (h as any)?.timestamp
      const takenDate = (() => {
        const ts = typeof takenAtRaw === 'string' ? Date.parse(takenAtRaw) : typeof takenAtRaw === 'number' ? takenAtRaw : undefined
        if (!ts) return undefined
        const dt = new Date(ts)
        return dt.toISOString() // ISO 문자열로 반환하여 프론트엔드에서 날짜+시간 파싱 가능
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
        // paidPartnership 필드 추가
        paidPartnership: (d as any).paidPartnership || false,
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
      
      const queueResult = await queueManager.executeWithSessionContinuity(
        'bold_argument/instagram-profile-scraper-task',
        { usernames: uniqueMissing.slice(0, 20), ...proxyOpt },
        {
          userId: user.id,
          priority: 'low',
          maxRetries: 3,
          sessionId: searchSessionId,
          sessionStep: 3, // 3단계: 추가 Profile 수집
          originalApiEndpoint: '/api/search',
          originalPayload: body,
          onQueued: (position: number) => {
            console.log(`🔄 Instagram 추가 profile 검색이 대기열 ${position}번째에 추가됨`)
          }
        }
      )
      
      if (!queueResult.success) {
        console.log(`⏳ Instagram 추가 profile 검색이 대기열에 추가됨: ${queueResult.message}`)
        break // 추가 profile은 필수가 아니므로 실패 시 중단
      }
      
      const started = { runId: queueResult.runId! }
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
          // paidPartnership 필드 추가 (기존 키워드 검색에서도 협찬 필터링 가능)
          paidPartnership: (d as any).paidPartnership || false,
        }
      })
      backfillRounds++
    }

    // Filters (period removed)
    const filtered = rows
    const finalRows = filtered
    
    // 통합된 처리 로직 (디버그/일반 모드 구분 제거)
    console.log('🔄 Instagram 최종 처리 시작')
    let actualCreditsUsed = 0 // 스코프를 넓혀서 아래에서 사용 가능하게 함
    {
      const sorted = [...finalRows].sort((a, b) => ((b.views ?? 0) - (a.views ?? 0)))
      const finalCount = sorted.length
      
      // ==========================================
      // 🔄 검색 완료 후 search-record 업데이트 (Instagram 키워드)
      // ==========================================
      
      // 검색 완료 시 search-record 업데이트
      if (searchRecordId) {
        try {
          console.log(`🔄 Instagram 키워드 검색 완료, 기록 업데이트: ${searchRecordId}`)
          
          // 실제 크레딧 사용량 계산 (proration)
          const returned = finalCount
          const requested = Number(input.limit)
          const actualCredits = Math.floor((returned / 30) * 100)
          const refundAmount = Math.max(0, expectedCredits - actualCredits)
          
          const updatePayload = {
            id: searchRecordId,
            status: 'completed',
            results_count: returned,
            actual_credits: actualCredits,
            refund_amount: refundAmount
          }
          
          console.log(`🔄 Instagram 키워드 검색 기록 업데이트:`, updatePayload)
          
          await fetch(new URL('/api/me/search-record', req.url), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify(updatePayload)
          })
          
          actualCreditsUsed = actualCredits
          console.log(`✅ Instagram 키워드 검색 기록 업데이트 완료: ${actualCreditsUsed} 크레딧`)
        } catch (error) {
          console.warn('⚠️ Instagram 키워드 검색 기록 업데이트 실패:', error)
        }
      }
      // Log search + update counters + cleanup old logs (3 days retention)
      try {
        await supabase.from('searches').insert({
          user_id: user.id,
          keyword: plainHashtag,
          requested: Number(input.limit),
          returned: finalCount,
          cost: actualCreditsUsed,
        })
      } catch (searchLogError) {
        console.error('❌ searches 테이블 로그 저장 실패:', searchLogError)
      }
      
      // 메인 후처리 로직 시작  
      console.log('🔄 Instagram 후처리 시작')
      try {
        // 키워드 정보 재확인
        const searchKeyword = input.keyword || ''
        console.log('🔑 처리할 키워드:', searchKeyword)
        
        // Update counters atomically via service role to avoid RLS edge cases
        const svc = (await import('@/lib/supabase/service')).supabaseService()
      const todayUtc = new Date()
      const yyyy = todayUtc.getUTCFullYear()
      const mm = String(todayUtc.getUTCMonth() + 1).padStart(2, '0')
      const firstOfMonth = `${yyyy}-${mm}-01`
      const { data: row } = await svc.from('search_counters').select('month_start,month_count,today_date,today_count').eq('user_id', user.id).single()
      let month_start = row?.month_start || firstOfMonth
      let month_count = Number(row?.month_count || 0)
      let today_date = row?.today_date || todayUtc.toISOString().slice(0,10)
      let today_count = Number(row?.today_count || 0)
      // reset if month crossed
      if (String(month_start) !== firstOfMonth) { month_start = firstOfMonth; month_count = 0 }
      // reset if day crossed
      const todayStr = todayUtc.toISOString().slice(0,10)
      if (String(today_date) !== todayStr) { today_date = todayStr; today_count = 0 }
      month_count += 1
      today_count += 1
      
      // search_counters 테이블 업데이트
      await svc.from('search_counters').upsert({ 
        user_id: user.id as any, 
        month_start, 
        month_count, 
        today_date, 
        today_count, 
        updated_at: new Date().toISOString() as any 
      })
      
      // 검색 기록 저장 (search_history 테이블) - 키워드 검색으로 통일
      console.log('💾 search_history 저장 시도 중:', {
        user_id: user.id,
        platform: 'instagram',
        search_type: 'keyword',
        keyword: searchKeyword,
        results_count: sorted.length,
        credits_used: actualCreditsUsed
      })
      
      // 검색 기록 저장은 클라이언트의 /api/me/search-record에서 처리 (중복 방지)
      console.log(`📝 Instagram 키워드 검색 완료 - 결과: ${sorted.length}개, 크레딧: ${actualCreditsUsed} (기록은 클라이언트에서 처리)`)
      
      // 크레딧 차감은 search-record API에서 처리됨
      console.log(`💰 Instagram 키워드 검색 실제 크레딧 사용량: ${actualCreditsUsed}`)
      console.log(`✅ 크레딧 정산은 search-record API에서 처리됨`)
      } catch (mainError) {
        console.error('❌ Instagram 메인 처리 블록 오류:', mainError)
        console.error('❌ 메인 처리 스택:', (mainError as Error)?.stack)
      }
      
      // actualCreditsUsed는 settle 함수에서 반환됨
      console.log('🎯 Instagram 검색 완료:', {
        키워드: input.keyword || '',
        결과수: finalRows.length,
        크레딧: actualCreditsUsed
      })
      
      // 디버그 모드일 때는 추가 정보 포함
      if (input.debug) {
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
            prorationSuggestion: actualCreditsUsed,
          },
          credits: { toCharge: actualCreditsUsed, basis: 100, per: 30 },
        })
      } else {
        // 검색 성공 완료 - 세션 종료
        queueManager.completeSearchSession(searchSessionId)
        
        return Response.json({ 
          items: sorted, 
          credits: { toCharge: actualCreditsUsed, basis: 100, per: 30 } 
        })
      }
    }
  } catch (e) {
    console.error('=== Instagram 키워드 검색 에러 발생 ===')
    console.error('에러 타입:', typeof e)
    console.error('에러 객체:', e)
    
    // 대기열 관련 에러인지 확인
    const errorMessage = (e as Error)?.message || String(e)
    if (errorMessage.includes('대기열') || errorMessage.includes('queue')) {
      console.log('🔄 대기열 관련 에러 - 202 응답 반환')
      return Response.json({
        success: false,
        message: errorMessage,
        queueId: (e as any)?.queueId || 'unknown'
      }, { status: 202 })
    }
    console.error('에러 스택:', (e as Error)?.stack)
    
    // 에러 발생 시 세션 정리
    try {
      console.log('에러 발생으로 세션 정리 중...')
      // 에러 시 정리는 별도 로직으로 처리하거나 타임아웃으로 자동 정리
    } catch (sessionError) {
      console.warn('세션 정리 중 에러:', sessionError)
    }
    
    // Best-effort: no settle here because we don't have user/reserve in this scope anymore
    // Always return JSON for easier debugging from clients/CLI
    // Include Zod issues when available
    const anyErr: any = e
    const isZod = Array.isArray(anyErr?.issues)
    const payload = isZod
      ? { error: 'ValidationError', issues: anyErr.issues }
      : { error: anyErr?.message || 'Bad Request', fullError: String(e) }
    
    console.error('반환할 에러 페이로드:', payload)
    return Response.json(payload, { status: 400 })
  }
  } catch (outerError) {
    console.error('=== POST 함수 최상위 에러 ===', outerError)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Instagram 프로필 검색 핸들러
async function handleProfileSearch(
  req: Request,
  input: any,
  resultsLimit: number,
  token: string,
  userId: string,
  searchRecordId: string | null,
  expectedCredits: number
) {
  console.log('=== Instagram 프로필 검색 시작 ===')
  
  try {
    // 프로필 URL에서 사용자명 추출
    const profileUrl = input.profileUrl
    console.log('프로필 URL:', profileUrl)
    
    let username = ''
    if (profileUrl.includes('instagram.com/')) {
      // URL에서 사용자명 추출: https://www.instagram.com/abc -> abc
      const match = profileUrl.match(/instagram\.com\/([^\/?\s]+)/)
      username = match ? match[1] : profileUrl
    } else {
      // 사용자명만 입력된 경우
      username = profileUrl.replace('@', '').trim()
    }
    
    if (!username) {
      return Response.json({ error: '유효하지 않은 프로필 URL 또는 사용자명입니다.' }, { status: 400 })
    }
    
    console.log('추출된 사용자명:', username)
    
    // 기간 필터 처리 (성공 사례와 동일한 형식으로 변환)
    console.log('🔍 Instagram 기간 필터 디버깅:')
    console.log('  - input 전체:', JSON.stringify(input, null, 2))
    console.log('  - input.onlyPostsNewerThan:', input.onlyPostsNewerThan)
    console.log('  - input.filters:', JSON.stringify(input.filters, null, 2))
    console.log('  - input.filters?.period:', input.filters?.period)
    console.log('  - input.filters 타입:', typeof input.filters)
    console.log('  - input.filters 존재 여부:', !!input.filters)
    
    let onlyPostsNewerThan: string
    
    // period 필터가 있으면 우선적으로 사용 (기존 onlyPostsNewerThan 무시)
    if (input.filters?.period && input.filters.period !== '') {
      // period 값을 onlyPostsNewerThan 형식으로 변환
      const periodMap: Record<string, string> = {
        'day': '1 day',
        'week': '1 week',
        'month': '1 month',
        'month2': '2 months',
        'month3': '3 months',
        'month6': '6 months',
        'year': '1 year'
      }
      onlyPostsNewerThan = periodMap[input.filters.period] || "3 months"
      console.log(`  - ✅ period 변환 성공: ${input.filters.period} → ${onlyPostsNewerThan}`)
    } else if (input.onlyPostsNewerThan) {
      // 기존 방식으로 전달된 경우
      onlyPostsNewerThan = input.onlyPostsNewerThan
      console.log('  - 기존값 사용:', onlyPostsNewerThan)
    } else {
      // 아무것도 없으면 기본값
      onlyPostsNewerThan = "3 months"
      console.log('  - 기본값 사용: 3 months')
    }
    
    console.log('✅ 기간 필터 최종 결과:', onlyPostsNewerThan)
    
    // Apify 실행 추적
    const apifyRunIds = new Set<string>()
    const onAbort = () => {
      const idList = Array.from(apifyRunIds)
      Promise.all(idList.map(runId => abortRun({ token, runId }))).catch(() => {})
    }
    try { req.signal.addEventListener('abort', onAbort, { once: true }) } catch {}
    
    // Instagram Scraper 태스크 실행 (프로필 검색 전용 새 액터 사용)
    const taskId = 'bold_argument/instagram-scraper-task-2'
    const profileUrl_full = `https://www.instagram.com/${username}`
    
    console.log('Instagram 프로필 스크래퍼 태스크 시작:', taskId)
    console.log('프로필 URL:', profileUrl_full)
    console.log('결과 개수:', resultsLimit)
    console.log('업로드 기간 필터:', onlyPostsNewerThan)
    
    // 성공 사례와 정확히 동일한 taskInput 구조
    const taskInput = {
      addParentData: false,
      directUrls: [profileUrl_full],
      enhanceUserSearchWithFacebookPage: false,
      isUserReelFeedURL: false,
      isUserTaggedFeedURL: false,
      onlyPostsNewerThan: onlyPostsNewerThan || "3 months", // 기본값 3개월
      resultsLimit: resultsLimit,
      resultsType: 'stories',
      searchType: 'hashtag' // 성공 사례에 포함된 필드
    }
    
    console.log('Apify 태스크 입력:', JSON.stringify(taskInput, null, 2))
    
    // DB 대기열 시스템을 통한 안전한 실행
    const { getDatabaseQueueManager } = await import('@/lib/db-queue-manager')
    const queueManager = getDatabaseQueueManager()
    
    const queueResult = await queueManager.executeWithTryFirst(
      taskId,
      taskInput,
      {
        userId: userId,
        priority: 'high', // Instagram 프로필 검색은 높은 우선순위
        maxRetries: 3,
        originalApiEndpoint: '/api/search',
        originalPayload: input
      }
    )
    
    if (!queueResult.success) {
      console.log(`⏳ Instagram 프로필 검색이 대기열에 추가됨: ${queueResult.message}`)
      return Response.json({
        success: false,
        message: `시스템 사용량이 높습니다. ${queueResult.message}`,
        queueId: queueResult.queueId
      }, { status: 202 }) // Accepted, 처리 중
    }
    
    const started = { runId: queueResult.runId! }
    console.log('Apify 태스크 시작됨 - runId:', started.runId)
    apifyRunIds.add(started.runId)
    
    const result = await waitForRunItems<IReelDetail>({ token, runId: started.runId })
    console.log('Apify 태스크 완료 - 결과 개수:', result.items?.length || 0)
    
    const reels = result.items || []
    
    // 릴스만 필터링 (비디오 콘텐츠만)
    const videoReels = reels.filter(r => {
      const hasVideo = !!r.videoUrl || (r as any).type === 'Video' || (r as any).type === 'Reel'
      return hasVideo
    })
    
    console.log('비디오 릴스 필터링 후 개수:', videoReels.length)
    
    // paidPartnership 필드 로깅
    videoReels.forEach((reel, index) => {
      console.log(`릴스 ${index + 1} paidPartnership:`, (reel as any).paidPartnership)
    })
    
    // 결과 변환
    const searchRows: ISearchRow[] = videoReels.map(r => {
      const getUrl = (x: any) => {
        const sc = x?.shortCode || x?.shortcode || x?.short_code || x?.code
        return x?.url || x?.postUrl || x?.link || (sc ? `https://www.instagram.com/p/${sc}/` : undefined)
      }
      
      // 조회수 처리 (videoPlayCount 사용)
      const videoPlayCount = (r as any).videoPlayCount || (r as any).viewCount || (r as any).views || 0
      
      // 좋아요 처리 (-1이면 'private'로 변환)
      const rawLikes = (r as any).likesCount || (r as any).likes
      const likes = rawLikes === -1 ? 'private' : (rawLikes || 0)
      
      // 영상 길이 처리 (videoDuration을 초 단위로 받아서 숫자로 저장)
      const videoDurationSeconds = (r as any).videoDuration || (r as any).duration || 0
      const durationInSeconds = Math.floor(videoDurationSeconds)
      
      return {
        platform: 'instagram' as const,
        url: getUrl(r),
        title: (r as any).caption || (r as any).text || '',
        username: (r as any).ownerUsername || username,
        views: videoPlayCount,
        likes: likes,
        comments: (r as any).commentsCount || (r as any).comments || 0,
        // 프로필 검색에서는 팔로워 수 제외 (요구사항)
        followers: undefined,
        takenDate: (r as any).timestamp || (r as any).takenDate || (r as any).takenAt,
        thumbnailUrl: (r as any).thumbnailUrl || (r as any).displayUrl,
        videoUrl: (r as any).videoUrl,
        caption: (r as any).caption || (r as any).text || '',
        duration: durationInSeconds, // 초 단위로 저장
        // paidPartnership 필드 포함
        paidPartnership: (r as any).paidPartnership || false
      }
    })
    
    console.log('최종 검색 결과 개수:', searchRows.length)
    
    // ==========================================
    // 🔄 검색 완료 후 search-record 업데이트 (Instagram 프로필)
    // ==========================================
    
    // 검색 완료 시 search-record 업데이트
    if (searchRecordId) {
      try {
        console.log(`🔄 Instagram 프로필 검색 완료, 기록 업데이트: ${searchRecordId}`)
        
        // 실제 크레딧 사용량 계산 (proration)
        const returned = searchRows.length
        const requested = Number(input.limit)
        const actualCredits = Math.floor((returned / 30) * 100)
        const refundAmount = Math.max(0, expectedCredits - actualCredits)
        
        const updatePayload = {
          id: searchRecordId,
          status: 'completed',
          results_count: returned,
          actual_credits: actualCredits,
          refund_amount: refundAmount
        }
        
        console.log(`🔄 Instagram 프로필 검색 기록 업데이트:`, updatePayload)
        
                  await fetch(new URL('/api/me/search-record', req.url), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify(updatePayload)
          })
        
        console.log(`✅ Instagram 프로필 검색 기록 업데이트 완료`)
      } catch (error) {
        console.warn('⚠️ Instagram 프로필 검색 기록 업데이트 실패:', error)
      }
    }
    
    console.log(`📝 Instagram 프로필 검색 완료 - 결과: ${searchRows.length}개, 크레딧: search-record API에서 처리됨`)
    
    return Response.json({
      items: searchRows, // 프론트엔드가 기대하는 필드명으로 변경
      metadata: {
        platform: 'instagram',
        searchType: 'profile',
        username: username,
        totalCount: searchRows.length,
        profileSearchEnabled: true
      }
    })
    
  } catch (error) {
    console.error('Instagram 프로필 검색 에러:', error)
    
    // 검색 실패 시 search-record 업데이트
    if (searchRecordId) {
      try {
        const updatePayload = {
          id: searchRecordId,
          status: 'failed',
          results_count: 0,
          actual_credits: 0,
          refund_amount: expectedCredits,
          error_message: (error as Error)?.message || 'Unknown error'
        }
        
                  await fetch(new URL('/api/me/search-record', req.url), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': req.headers.get('cookie') || ''
            },
            body: JSON.stringify(updatePayload)
          })
      } catch (updateError) {
        console.warn('⚠️ 프로필 검색 실패 기록 업데이트 실패:', updateError)
      }
    }
    
    return Response.json({ 
      error: 'Instagram 프로필 검색 실패', 
      message: (error as Error)?.message || 'Unknown error'
    }, { status: 500 })
  }
}

