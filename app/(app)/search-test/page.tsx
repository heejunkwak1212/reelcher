'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'

// Small inline thumbnail that always shows; hover opens larger preview; click opens modal.
function InlineThumb({ row }: { row: any }) {
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)
  const src = buildInitialPreviewSrc(row)
  const box = 'w-16 h-24' // 64x96px
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<number | null>(null)
  const scheduleClose = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = window.setTimeout(() => setHover(false), 250) }
  const cancelClose = () => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null } }
  useEffect(() => { return () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) } }, [])
  const previewId: string = row?.url || Math.random().toString(36)
  const claimGlobal = () => {
    const g = window as any
    if (g.__hoverPreviewActive && g.__hoverPreviewActive !== previewId) {
      if (typeof g.__hoverPreviewClose === 'function') g.__hoverPreviewClose()
    }
    g.__hoverPreviewActive = previewId
    g.__hoverPreviewClose = () => {
      if ((window as any).__hoverPreviewActive === previewId) setHover(false)
    }
  }
  useEffect(() => {
    if (!hover) {
      const g = window as any
      if (g.__hoverPreviewActive === previewId) {
        g.__hoverPreviewActive = null
        g.__hoverPreviewClose = undefined
      }
    }
  }, [hover])
  useEffect(() => {
    if (!hover) return
    const compute = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const PREVIEW_H = 420
      const margin = 6
      const left = rect.right + margin
      let top = rect.top + rect.height / 2 - PREVIEW_H / 2
      const maxTop = window.innerHeight - PREVIEW_H - margin
      if (top < margin) top = margin
      if (top > maxTop) top = maxTop
      setPos({ left: Math.round(left), top: Math.round(top) })
    }
    compute()
    window.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [hover])
  return (
    <div ref={containerRef} className="relative" onMouseEnter={()=>{cancelClose(); claimGlobal(); setHover(true)}} onMouseLeave={scheduleClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || ''} alt="thumb" className={`rounded object-cover ${box}`} style={{width:64, height:96}} onClick={()=>setOpen(true)} />
      {hover && pos && (
        <div ref={previewRef} className="z-50" style={{ position: 'fixed', left: pos.left, top: pos.top }} onMouseEnter={cancelClose} onMouseLeave={()=>setHover(false)}>
          <div className="bg-white border border-gray-200 shadow rounded p-1">
            <PreviewContent row={row} />
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-[420px] p-3" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-sm">미리보기</h2>
              <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <PreviewContent row={row} />
          </div>
        </div>
      )}
    </div>
  )
}

// (imports moved to top with 'use client')

type SearchRow = {
  url: string
  username?: string
  views?: number
  likes?: number | 'private'
  comments?: number
  followers?: number
  following?: number
  thumbnailUrl?: string
  caption?: string
  duration?: number
  takenDate?: string
}

export default function SearchTestPage() {
  const [keywords, setKeywords] = useState<string[]>(['재테크'])
  const [user, setUser] = useState<any>(null)
  // period UI removed for MVP
  const [limit, setLimit] = useState<'5' | '30' | '60' | '90' | '120'>('30')

  // Load user data immediately from Supabase client + API
  useEffect(() => {
    async function loadUserData() {
      try {
        // First: Check Supabase client session (instant)
        const { supabaseBrowser } = await import('@/lib/supabase/client')
        const supabase = supabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          // Quick set from session data
          setUser({
            id: session.user.id,
            email: session.user.email,
            ...session.user.user_metadata
          })
        }

        // Second: Fetch full user data from API (background update)
        const userRes = await fetch('/api/me')
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData)
        } else if (!session?.user) {
          setUser(null)
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
      }
    }
    loadUserData()
  }, [])
  const [myCredits, setMyCredits] = useState<number | null>(null)
  const [todayCount, setTodayCount] = useState<number>(0)
  const [monthCount, setMonthCount] = useState<number>(0)
  const [recentKeywords, setRecentKeywords] = useState<string[]>([])
  const [monthCredits, setMonthCredits] = useState<number>(0)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [plan, setPlan] = useState<'free' | 'starter' | 'pro' | 'business' | string>('free')
  const prevLimitRef = useRef<typeof limit>(limit)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [baseItems, setBaseItems] = useState<SearchRow[] | null>(null)
  const [sort, setSort] = useState<'views' | 'latest' | 'oldest'>('views')
  const [filters, setFilters] = useState<{ views?: [number, number]; followers?: [number, number]; date?: [string, string] }>({})
  const [debug, setDebug] = useState<any>(null)
  const [raw, setRaw] = useState<string>('')
  const [checkAllToggle, setCheckAllToggle] = useState<number>(0)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  // Turnstile (env-gated)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const [, forceTick] = useState(0)
  // progress overlay (search/export/download/subtitle)
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressTitle, setProgressTitle] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const progressTimer = useRef<number | null>(null)
  const openProgress = (title: string, initial = 5) => {
    setProgressTitle(title)
    setProgressPercent(initial)
    setProgressOpen(true)
  }
  const tickProgress = (max = 92, step = 2, ms = 250) => {
    if (progressTimer.current && typeof window !== 'undefined') window.clearInterval(progressTimer.current)
    progressTimer.current = (typeof window !== 'undefined' ? window.setInterval(() => {
      setProgressPercent((p) => (p < max ? p + step : p))
    }, ms) : null) as any
  }
  const finishProgress = (delay = 600) => {
    if (progressTimer.current && typeof window !== 'undefined') { window.clearInterval(progressTimer.current as any); progressTimer.current = null }
    setProgressPercent(100)
    if (typeof window !== 'undefined') window.setTimeout(() => setProgressOpen(false), delay)
  }

  // Stats reload helpers for immediate UI refresh after searches
  const loadStats = async () => {
    try {
      const stats = await fetch('/api/me?scope=search-stats', { cache: 'no-store' }).then(r=>r.ok?r.json():null).catch(()=>null)
      if (stats) {
        setTodayCount(Number(stats.today || 0))
        setMonthCount(Number(stats.month || 0))
        setMonthCredits(Number(stats.monthCredits || 0))
        if (Array.isArray(stats.recent)) setRecentKeywords(stats.recent as string[])
      }
    } catch {}
  }
  const loadCredits = async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' })
      if (res.ok) {
        const j = await res.json()
        setMyCredits(typeof j?.credits === 'number' ? j.credits : null)
        setIsAdmin(j?.role === 'admin')
        if (j?.plan) setPlan(j.plan)
      }
    } catch {}
  }
  
  // Combined reload for faster refreshes
  const reloadUserData = async () => {
    try {
      const [userRes, statsRes] = await Promise.all([
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/me?scope=search-stats', { cache: 'no-store' })
      ])
      
      if (userRes.ok) {
        const j = await userRes.json()
        setMyCredits(typeof j?.credits === 'number' ? j.credits : null)
        setIsAdmin(j?.role === 'admin')
        if (j?.plan) setPlan(j.plan)
      }
      
      if (statsRes.ok) {
        const stats = await statsRes.json()
        setTodayCount(Number(stats.today || 0))
        setMonthCount(Number(stats.month || 0))
        setMonthCredits(Number(stats.monthCredits || 0))
        if (Array.isArray(stats.recent)) setRecentKeywords(stats.recent as string[])
      }
    } catch {}
  }
  

  const nf = useMemo(() => new Intl.NumberFormat('en-US'), [])
  const formatNumber = (n?: number | 'private') => (typeof n === 'number' ? nf.format(n) : n === 'private' ? '비공개' : '-')
  const formatDuration = (sec?: number) => {
    if (typeof sec !== 'number' || !Number.isFinite(sec)) return '-'
    const s = Math.max(0, Math.floor(sec))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2,'0')}`
  }

  const run = async () => {
    // On first click, check 7-day opt-out
    const optKey = 'relcher.search.confirm.optout.until'
    const until = typeof window !== 'undefined' ? Number(localStorage.getItem(optKey) || 0) : 0
    const now = Date.now()
    const creditMap: Record<string, number> = { '30': 100, '60': 200, '90': 300, '120': 400, '5': 0 }
    const nCredits = creditMap[String(limit)] ?? 0
    // Always show confirmation (restore behavior), with 7-day opt-out
      const ok = await new Promise<boolean>((resolve) => {
        const modal = document?.createElement('div') as HTMLDivElement
        modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
        modal.innerHTML = `
          <div class="bg-white rounded shadow-lg w-full max-w-md p-5" role="dialog">
            <div class="text-base font-semibold mb-3">검색을 시작할까요?</div>
            <div class="text-sm text-neutral-700 space-y-2">
              <p>데이터 수집으로 인해 검색 시간은 최대 1분 이상 소요될 수 있으며 시작 즉시 크레딧이 소모돼요.</p>
            <p>${limit}개의 결과를 바로 받아볼까요? 예상 차감: <b>${nCredits} 크레딧</b></p>
            </div>
            <div class="flex items-center justify-between mt-4">
            <label class="text-xs text-neutral-600 flex items-center gap-2 cursor-pointer">
              <input id="opt7" type="checkbox" class="w-4 h-4 rounded border-gray-300" ${ (until>now)?'checked':'' } onchange=""/>
              7일 동안 보지 않기
            </label>
              <div class="flex items-center gap-2">
                <button id="cnl" class="px-3 py-2 border rounded">취소</button>
                <button id="go" class="px-3 py-2 border rounded bg-black text-white">시작(${nCredits}크레딧)</button>
              </div>
            </div>
          </div>`
        document?.body?.appendChild(modal)
        const cleanup = () => { modal.remove() }
        modal.querySelector('#cnl')?.addEventListener('click', () => { cleanup(); resolve(false) })
        modal.querySelector('#go')?.addEventListener('click', () => {
          const chk = (modal.querySelector('#opt7') as HTMLInputElement | null)?.checked
          if (chk) {
            const sevenDays = 7 * 24 * 60 * 60 * 1000
             if (typeof window !== 'undefined') localStorage.setItem(optKey, String(Date.now() + sevenDays))
        } else {
          if (typeof window !== 'undefined') localStorage.removeItem(optKey)
          }
          cleanup(); resolve(true)
        })
      })
      if (!ok) return
    setLoading(true)
    abortRef.current = new AbortController()
    setDebug(null)
    setRaw('')
    openProgress('검색을 진행 중입니다…', 5)
    tickProgress(92, 1, 500)
    try {
      // multi keywords parse (max 3)
      const list = keywords.map(s=>s.trim()).filter(Boolean).slice(0,3)
      const payload: any = { keyword: (list[0] || '재테크'), limit, debug: true }
      if (list.length) payload.keywords = list
      if (turnstileSiteKey) payload.turnstileToken = turnstileToken

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortRef.current?.signal,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = (j && (j.message || j.error)) || `Request failed (${res.status})`
        if (res.status === 402) {
          const modal = document.createElement('div')
          modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
          modal.innerHTML = `
            <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
              <div class="text-base font-semibold mb-3">크레딧이 부족해요</div>
              <div class="text-sm text-neutral-700">크레딧을 충전하시겠어요?</div>
              <div class="flex items-center justify-end gap-2 mt-4">
                <button id="cnl" class="px-3 py-2 border rounded">취소</button>
                <a id="go" class="px-3 py-2 border rounded bg-black text-white" href="/pricing">구매</a>
              </div>
            </div>`
          document.body.appendChild(modal)
          modal.querySelector('#cnl')?.addEventListener('click', () => modal.remove())
        } else {
          alert(msg)
        }
        setRaw(JSON.stringify(j || { error: msg }, null, 2))
        setProgressOpen(false)
        return
      }
      const json = await res.json()
      const arr: SearchRow[] = Array.isArray(json.items) ? json.items : []
      // default sort: views desc
      arr.sort((a, b) => (b.views || 0) - (a.views || 0))
      setBaseItems(arr)
      setDebug(json.debug ?? null)
      setRaw(JSON.stringify(json, null, 2))
      finishProgress()
      // Immediately refresh stats and credits after settlement
      await Promise.all([loadStats(), loadCredits()])
      // 환불 안내
      try {
        const debugInfo = (json && json.debug) || null
        const returned = Array.isArray(json?.items) ? json.items.length : 0
        const requested = Number(payload?.limit || 30)
        if (requested >= 30 && returned < requested) {
          const actualCredits = Math.floor((returned / 30) * 100)
          const reserved = payload?.limit === '60' ? 200 : payload?.limit === '90' ? 300 : payload?.limit === '120' ? 400 : 100
          const refund = Math.max(0, reserved - actualCredits)
          if (refund > 0) {
            const toast = document.createElement('div')
            toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-black text-white text-sm px-4 py-2 rounded shadow'
            toast.textContent = `반환 안내: 결과가 적어 ${refund} 크레딧이 환불되었습니다.`
            document.body.appendChild(toast)
            setTimeout(()=>toast.remove(), 4000)
          }
        }
      } catch {}
    } catch (e) {
      const msg = (e as Error).message
      setRaw(msg)
      setProgressOpen(false)
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const cancel = () => {
    try { abortRef.current?.abort() } catch {}
    setProgressOpen(false)
    setLoading(false)
  }

  // Derived items from baseItems + filters + sort
  const items = useMemo(() => {
    if (!Array.isArray(baseItems)) return null
    let arr = baseItems
    const v = filters
    if (v && (v.views || v.followers || v.date)) {
      const [vMin, vMax] = v.views || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
      const [fMin, fMax] = v.followers || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
      const [dMin, dMax] = v.date || ['', '']
      arr = arr.filter((i) => {
        const okViews = (i.views || 0) >= vMin && (i.views || 0) <= vMax
        const okFollowers = (i.followers || 0) >= fMin && (i.followers || 0) <= fMax
        const ts = i.takenDate ? Date.parse(i.takenDate) : 0
        const okDate = !dMin || !dMax ? true : (ts >= Date.parse(dMin) && ts <= Date.parse(dMax))
        return okViews && okFollowers && okDate
      })
    }
    const sorted = [...arr]
    if (sort === 'views') {
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0))
    } else if (sort === 'latest') {
      sorted.sort((a, b) => (Date.parse(b.takenDate || '') || 0) - (Date.parse(a.takenDate || '') || 0))
    } else {
      sorted.sort((a, b) => (Date.parse(a.takenDate || '') || 0) - (Date.parse(b.takenDate || '') || 0))
    }
    return sorted
  }, [baseItems, filters, sort])

  // Prefetch thumbnails (all) to make modal open instantly
  useEffect(() => {
    if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return
    ensurePreconnect('https://images.apifyusercontent.com')
    const unique = new Set<string>()
    for (const row of items) {
      const src = buildInitialPreviewSrc(row)
      if (src && !unique.has(src)) {
        unique.add(src)
      }
    }
    unique.forEach((src) => preloadImage(src))
  }, [items])

  // Load Turnstile widget only when site key exists
  useEffect(() => {
    if (typeof window === 'undefined' || !turnstileSiteKey) return
    const id = 'cf-turnstile'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.defer = true
      s.id = id
      document.head.appendChild(s)
    }
    const i = setInterval(() => {
      const anyWin = window as any
      if (anyWin.turnstile && widgetRef.current) {
        anyWin.turnstile.render(widgetRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          'refresh-expired': 'auto',
          size: 'flexible',
          theme: 'light',
        })
        clearInterval(i)
      }
    }, 200)
    return () => clearInterval(i)
  }, [turnstileSiteKey])

  // load my credits, role, user info, and search counters/recent keywords
  useEffect(() => {
    (async () => {
      try {
        // Parallel API calls for faster loading
        const [userRes, statsRes] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' }),
          fetch('/api/me?scope=search-stats', { cache: 'no-store' })
        ])
        
        // Process user data
        if (userRes.ok) {
          const j = await userRes.json()
          setMyCredits(typeof j?.credits === 'number' ? j.credits : null)
          setIsAdmin(j?.role === 'admin')
          setUser(j?.user || null)
          if (j?.plan) setPlan(j.plan)
        }
        
        // Process stats data
        if (statsRes.ok) {
          const stats = await statsRes.json()
          setTodayCount(Number(stats.today || 0))
          setMonthCount(Number(stats.month || 0))
          if (Array.isArray(stats.recent)) setRecentKeywords(stats.recent as string[])
          setMonthCredits(Number(stats.monthCredits || 0))
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
      }
    })()
  }, [])

  const showUpgradeModal = (message = '해당 기능은 스타터 플랜부터 이용이 가능해요') => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
    modal.innerHTML = `
      <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
        <div class="text-base font-semibold mb-3">사용 제한</div>
        <div class="text-sm text-neutral-700">${message}</div>
        <div class="flex items-center justify-end gap-2 mt-4">
          <button id="cnl" class="px-3 py-1.5 text-sm border rounded">닫기</button>
          <a id="go" class="px-3 py-1.5 text-sm border rounded bg-black text-white" href="/pricing">업그레이드 바로가기</a>
        </div>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('#cnl')?.addEventListener('click', () => modal.remove())
  }

  return (
    <div className="min-h-screen">
      {/* Header Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-[1320px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-0.5 hover:opacity-80 transition-opacity">
              <img 
                src="/logo.svg" 
                alt="Reelcher" 
                className="w-12 h-12"
              />
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                Reelcher
              </h1>
            </Link>
            
            {/* Navigation */}
            <div className="flex items-center gap-3">
              {user ? (
                <Button asChild variant="outline" className="text-sm font-medium border-2 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                  <Link href="/dashboard">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      대시보드
                    </div>
                  </Link>
                </Button>
              ) : (
                <Button asChild className="text-sm font-medium bg-black text-white hover:bg-gray-800 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                  <Link href="/sign-in">무료로 시작하기</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1320px] mx-auto p-6 pt-8 space-y-8">

      {/* Main Content - Two Column Layout */}
      <div className="flex gap-10">
        {/* Left Column: Search Controls */}
        <div className="w-[420px] space-y-7" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
          {/* 키워드 */}
          <div>
            <div className="text-base font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>키워드</div>
            <div className="flex items-center gap-3">
              <input 
                className="flex-1 h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                placeholder="예: 맛집, 여행, 패션..."
                value={keywords[0]} 
                onChange={(e)=>setKeywords([e.target.value, ...keywords.slice(1)])} 
              />
              {keywords.length < 3 && (
                <button 
                  className="h-12 px-4 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-all" 
                  style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  onClick={(e)=>{e.preventDefault(); if (plan==='free'){ showUpgradeModal('여러 키워드 검색은 스타터 플랜부터 이용이 가능해요'); return } setKeywords(prev=>[...prev,''])}}
                >
                  + 키워드 추가
                </button>
              )}
            </div>
            {keywords.slice(1).map((kw, idx)=> (
              <div key={idx} className="flex items-center gap-3 mt-2">
                <input 
                  className="flex-1 h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                  style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  placeholder={`키워드 ${idx + 2}`}
                  value={kw} 
                  onChange={(e)=>setKeywords(prev=>prev.map((v,i)=>i===idx+1?e.target.value:v))} 
                />
                <button 
                  className="h-12 px-4 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-all" 
                  style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  onClick={(e)=>{e.preventDefault(); setKeywords(prev=>prev.filter((_,i)=>i!==idx+1))}}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
          
          {/* 주제별 키워드 추천 */}
          <div>
            <Button 
              variant="outline" 
              size="sm"
              className="text-sm h-10 border border-gray-200 font-normal" 
              style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              onClick={(e)=>{e.preventDefault(); setTemplateOpen(v=>!v)}}
            >
              주제별 추천 키워드 {templateOpen ? '닫기' : '열기'}
            </Button>
            {templateOpen && (
              <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                <TemplatePicker selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} onPick={(kw)=>{ setKeywords([kw]); setTemplateOpen(false) }} />
              </div>
            )}
          </div>

          {/* 결과 개수 */}
          <div>
            <div className="text-base font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>결과 개수</div>
            <select 
              className="w-48 h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all bg-white" 
              style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
              value={limit} 
              onChange={(e)=>{
              const v = e.target.value as any
              // Plan-based locking
              if (plan==='free' && (v==='60'||v==='90'||v==='120')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('FREE 플랜은 30개만 가능합니다'); return }
              if (plan==='starter' && (v==='90'||v==='120')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('STARTER 플랜은 60개까지만 가능합니다'); return }
              if (plan==='pro' && v==='120') { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('PRO 플랜은 90개까지만 가능합니다'); return }
              prevLimitRef.current = v; setLimit(v)
              }}
              >
              {isAdmin && <option value="5">5 (개발용)</option>}
              <option value="30">30개 (100크레딧)</option>
                <option value="60">60개 (200크레딧){plan==='free'?' 🔒':''}</option>
                <option value="90">90개 (300크레딧){(plan==='free'||plan==='starter')?' 🔒':''}</option>
                <option value="120">120개 (400크레딧){(plan==='free'||plan==='starter'||plan==='pro')?' 🔒':''}</option>
            </select>
          </div>

          {/* 검색 버튼 */}
          <div>
            <button 
              onClick={(e)=>{e.preventDefault(); run()}} 
              disabled={loading} 
              className={`h-14 px-8 rounded-lg text-base font-medium text-white transition-all duration-200 w-48 ${
                loading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-black hover:bg-gray-800 hover:-translate-y-0.5'
              }`}
              style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
            >
              {loading ? '진행 중…' : '검색 시작'}
            </button>
            {loading && (
              <button 
                className="h-12 px-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all w-48 mt-3" 
                style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                onClick={(e)=>{e.preventDefault(); cancel()}}
              >
                취소
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Statistics and Info - 더욱 넓은 레이아웃 */}
        <div className="w-[600px] space-y-5" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
          <div className="flex gap-6">
            {/* 좌측: 검색 통계 + 크레딧 사용량 (하나의 박스에 구분선으로 분리) */}
            <div className="flex-1 p-6 border border-gray-200 rounded-lg bg-gray-50 min-h-[220px]">
              {/* 검색 통계 */}
              <div className="text-base font-semibold text-gray-700 mb-5">검색 통계</div>
              <div className="space-y-4 text-sm mb-6">
                <div className="flex items-center justify-between text-gray-600">
                  <span>오늘 검색</span>
                  <span className="font-semibold text-gray-900">{todayCount}회</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>이번 달</span>
                  <span className="font-semibold text-gray-900">{monthCount}회</span>
                </div>
              </div>
              
              {/* 더 명확한 구분선 */}
              <div className="border-t border-gray-300 my-5"></div>
              
              {/* 크레딧 사용량 */}
              <div className="text-base font-semibold text-gray-700 mb-5">크레딧 사용량</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>이번 달</span>
                  <span className="font-semibold text-gray-900">{new Intl.NumberFormat('en-US').format(monthCredits)} 크레딧</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>잔여</span>
                  <span className="font-semibold text-gray-900">{typeof myCredits === 'number' ? new Intl.NumberFormat('en-US').format(myCredits) : '-'} 크레딧</span>
                </div>
              </div>
            </div>

            {/* 우측: 나의 최근 키워드 (별도 박스) */}
            <div className="flex-1 p-6 border border-gray-200 rounded-lg bg-gray-50 min-h-[220px]">
              <div className="text-base font-semibold text-gray-700 mb-5">나의 최근 키워드</div>
              <div className="flex flex-wrap gap-2">
                {(recentKeywords.length ? recentKeywords : [...new Set(keywords.filter(Boolean))]).slice(0,6).map(k => (
                  <Badge 
                    key={k} 
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100 transition-colors text-sm px-3 py-1 border-gray-200 hover:border-gray-300"
                    onClick={() => setKeywords([k])}
                  >
                    {k}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Results Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold text-gray-800">
              검색 결과 <span className="text-gray-600">({items?.length || 0}개)</span>
            </h2>
            <div className="flex items-center gap-2">
              <Checkbox 
                checked={(() => {
                  if (typeof window === 'undefined') return false
                  const api = (window as any).__rowSelect as { selected?: Set<string> } | undefined
                  const urls = items ? items.map(i=>i.url) : []
                  return urls.length > 0 && urls.every(url => api?.selected?.has?.(url))
                })()}
                onCheckedChange={(checked) => {
                  const api = (window as any).__rowSelect as { selected?: Set<string>; setSelected?: any }
                  const urls = items ? items.map(i=>i.url) : []
                  const next = new Set<string>(checked ? urls : [])
                  if (api && typeof api.setSelected === 'function') {
                    api.setSelected(next)
                  } else if (api && api.selected) {
                    api.selected = next
                  } else {
                    ;(window as any).__rowSelect = { selected: next }
                  }
                  // 강제로 리렌더링을 위한 상태 업데이트
                  setCheckAllToggle((v: number) => v+1)
                }}
              />
              <label className="text-sm text-gray-600">전체선택</label>
            </div>
        </div>
          <div className="flex items-center gap-3">
            {baseItems ? (
              <>
        <div className="flex items-center gap-2">
            <ClientFilters baseItems={baseItems} setFilters={setFilters} />
          <SortMenu sort={sort} setSort={setSort} />
                </div>
                <div className="h-6 w-px bg-gray-300"></div>
                <ExportButtons items={items || []} onProgress={{ open: openProgress, tick: tickProgress, finish: finishProgress }} />
              </>
            ) : (
              <>
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">필터</button>
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">정렬</button>
                <div className="h-6 w-px bg-gray-300"></div>
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">영상 바로가기</button>
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">엑셀 추출</button>
                <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">영상 추출</button>
              </>
            )}
        </div>
      </div>
      <div className="sr-only" aria-hidden>{turnstileSiteKey ? <div ref={widgetRef} /> : null}</div>
      

        <div className="overflow-x-auto p-6">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="p-3 text-center font-semibold text-gray-700 w-[60px]">선택</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[80px]">썸네일</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[100px]">업로드</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[100px]">조회수</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[80px]">길이</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[100px]">좋아요</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[100px]">댓글</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[180px]">계정</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[120px]">기능</th>
              </tr>
            </thead>
            <tbody>
              {items && items.length > 0 ? items.map((r) => (
                 <tr key={r.url} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors h-[84px]">
                  <td className="p-3 text-center align-middle"><RowCheck url={r.url} /></td>
                  <td className="p-3 text-center align-middle"><InlineThumb row={r as any} /></td>
                  <td className="p-3 text-center align-middle text-gray-600">{r.takenDate ?? '-'}</td>
                  <td className="p-3 text-center align-middle font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{formatNumber(r.views)}</td>
                  <td className="p-3 text-center align-middle text-gray-600" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{formatDuration(r.duration)}</td>
                  <td className="p-3 text-center align-middle font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{r.likes === 'private' ? '-' : formatNumber(r.likes as number)}</td>
                  <td className="p-3 text-center align-middle font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{formatNumber(r.comments)}</td>
                  <td className="p-3 text-left align-middle">
                    {r.username ? (
                        <div className="flex flex-col">
                          <a className="text-gray-900 hover:text-gray-700 font-medium" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }} href={`https://www.instagram.com/${r.username}/`} target="_blank" rel="noreferrer">@{r.username}</a>
                          <div className="text-xs text-gray-500" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{typeof r.followers === 'number' ? new Intl.NumberFormat('en-US').format(r.followers) : '-'} 팔로워</div>
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="p-3 text-center align-middle">
                    <div className="flex flex-col gap-2 items-center">
                      <CaptionDialog caption={r.caption || ''} />
                      <SubtitleDialog url={r.url} />
                    </div>
                  </td>
                </tr>
                            )) : (
                <tr>
                  <td className="p-12 text-center text-gray-500" colSpan={9}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="text-lg font-medium text-gray-700">검색 결과가 없습니다</div>
                      <div className="text-sm text-gray-500">상단에서 키워드를 입력하고 검색을 실행해보세요</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <pre className="whitespace-pre-wrap text-xs bg-neutral-50 border border-gray-200 rounded p-3 overflow-auto max-h-[60vh]">
        {raw}
      </pre>
      {progressOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => {}}>
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{progressTitle}</div>
            <div className="w-full h-3 bg-neutral-200 rounded">
              <div className="h-3 bg-black rounded" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
            <div className="mt-2 text-sm text-neutral-600">{Math.round(progressPercent)}%</div>
            <div className="mt-3 text-xs text-neutral-500">창을 닫지 말아주세요</div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// Expandable template picker with 15+ categories and 10 keywords each
function TemplatePicker({ selectedCategory, setSelectedCategory, onPick }: { selectedCategory: string; setSelectedCategory: (v: string)=>void; onPick: (keyword: string)=>void }) {
  const categories: { name: string; keywords: string[] }[] = [
    { name: '카페/디저트', keywords: ['카페','디저트','빵스타그램','카페투어','커피','라떼','브런치','맛집','케이크','스콘'] },
    { name: 'PT/헬스', keywords: ['헬스','pt','다이어트','운동루틴','하체운동','등운동','가슴운동','홈트','스트레칭','체지방'] },
    { name: '교육/스터디', keywords: ['영어공부','공부법','토익','어학연수','자격증','스터디','수학문제','코딩공부','국어공부','메모공부'] },
    { name: '뷰티/헤어', keywords: ['헤어스타일','메이크업','염색','단발','펌','아이메이크업','쿠션추천','립추천','스킨케어','네일아트'] },
    { name: '패션', keywords: ['데일리룩','OOTD','패션','코디','가을코디','겨울패션','운동화추천','원피스','데님','니트'] },
    { name: '로컬서비스', keywords: ['인테리어','이사','청소','수리','목공','타일','조명','커튼','리모델링','셀프인테리어'] },
    { name: '전자상거래', keywords: ['쇼핑추천','가성비템','온라인쇼핑','리뷰','언박싱','인기상품','세일정보','핫딜','생활용품','주방용품'] },
    { name: '여행', keywords: ['여행','국내여행','해외여행','핫플','맛집투어','호캉스','제주도','일본여행','유럽여행','여행코스'] },
    { name: '사진/영상', keywords: ['사진찍는법','영상편집','브이로그','필름카메라','아이폰사진','색보정','룩북','타임랩스','감성사진','튜토리얼'] },
    { name: '반려동물', keywords: ['멍스타그램','냥스타그램','강아지산책','고양이','훈련','간식','미용','유기동물','입양','반려견용품'] },
    { name: '요리/레시피', keywords: ['집밥','레시피','쿠킹','간단요리','다이어트식단','에어프라이어','밀프렙','도시락','브런치','야식'] },
    { name: '부동산/재테크', keywords: ['재테크','부동산','주식','ETF','적금','절약','신용카드','월급관리','사업아이템','사이드잡'] },
    { name: '교육/키즈', keywords: ['육아','키즈카페','놀이교육','동화책','미술놀이','키즈패션','간식만들기','유치원','초등공부','교육정보'] },
    { name: '음악/악기', keywords: ['피아노','기타','보컬','드럼','작곡','연습영상','커버곡','버스킹','음원추천','플레이리스트'] },
    { name: '아웃도어/캠핑', keywords: ['캠핑','백패킹','차박','캠핑용품','등산','하이킹','낚시','불멍','바비큐','캠핑요리'] },
  ]
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="text-[13px] text-neutral-600 mb-2">카테고리를 선택하면 추천 키워드가 펼쳐집니다.</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {categories.map(c => (
          <button key={c.name} className={`px-3 py-1.5 text-[12px] border border-gray-200 rounded-full transition-colors ${selectedCategory===c.name?'bg-black text-white border-black':'bg-neutral-50 text-neutral-800 hover:border-gray-300'}`} onClick={(e)=>{e.preventDefault(); setSelectedCategory(selectedCategory === c.name ? '' : c.name)}}>{c.name}</button>
        ))}
      </div>
      {selectedCategory && (
        <div className="border-t border-gray-200 pt-3">
          <div className="text-[13px] text-neutral-600 mb-2">추천 키워드</div>
          <div className="flex flex-wrap gap-2">
            {categories.find(c=>c.name===selectedCategory)?.keywords.map(k => (
              <button key={k} className="px-3 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white hover:bg-neutral-50 hover:border-gray-300 transition-colors" onClick={(e)=>{e.preventDefault(); onPick(k)}}>{k}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SortMenu({ sort, setSort }: { sort: 'views' | 'latest' | 'oldest'; setSort: (v: 'views' | 'latest' | 'oldest') => void }) {
  const [open, setOpen] = useState(false)
  const apply = (mode: 'latest' | 'oldest' | 'views') => {
    // only update sort; items is derived via useMemo
    setSort(mode)
    setOpen(false)
  }
  return (
    <div className="relative">
      <button className="px-2 py-1 border rounded" onClick={() => setOpen((v) => !v)}>
        정렬 ({sort === 'views' ? '조회수순' : sort === 'latest' ? '최신' : '오래된'})
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border rounded shadow z-10 text-sm">
          <button className="block px-3 py-2 hover:bg-neutral-50 w-full text-left" onClick={() => apply('latest')}>최신 날짜순</button>
          <button className="block px-3 py-2 hover:bg-neutral-50 w-full text-left" onClick={() => apply('oldest')}>오래된 날짜순</button>
          <button className="block px-3 py-2 hover:bg-neutral-50 w-full text-left" onClick={() => apply('views')}>조회수순</button>
        </div>
      )}
    </div>
  )
}

function ClientFilters({ baseItems, setFilters }: { baseItems: SearchRow[]; setFilters: (v: any) => void }) {
  const [open, setOpen] = useState(false)
  // ranges derive from base items (original search result)
  const viewsArr = baseItems.map(i => i.views || 0)
  const followersArr = baseItems.map(i => i.followers || 0)
  const minViews = Math.min(...viewsArr, 0)
  const maxViews = Math.max(...viewsArr, 0)
  const minFollowers = Math.min(...followersArr, 0)
  const maxFollowers = Math.max(...followersArr, 0)
  const dates = baseItems.map(i => i.takenDate ? Date.parse(i.takenDate) : 0).filter(Boolean)
  const minDate = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0,10) : ''
  const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0,10) : ''

  const [vMin, setVMin] = useState<number>(minViews)
  const [vMax, setVMax] = useState<number>(maxViews)
  const [fMin, setFMin] = useState<number>(minFollowers)
  const [fMax, setFMax] = useState<number>(maxFollowers)
  const [dMin, setDMin] = useState<string>(minDate)
  const [dMax, setDMax] = useState<string>(maxDate)

  useEffect(() => { setVMin(minViews); setVMax(maxViews); setFMin(minFollowers); setFMax(maxFollowers); setDMin(minDate); setDMax(maxDate) }, [minViews, maxViews, minFollowers, maxFollowers, minDate, maxDate])

  const apply = () => {
    setFilters({ views: [vMin, vMax], followers: [fMin, fMax], date: [dMin, dMax] })
    setOpen(false)
  }
  const reset = () => { setFilters({}); setOpen(false) }
  return (
    <div className="relative">
      <button className="px-2 py-1 border border-gray-200 rounded hover:border-gray-300 transition-colors" onClick={() => setOpen(v => !v)}>필터</button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded shadow z-10 text-sm p-3 w-[20rem] space-y-2">
          <div>
            <div className="mb-1">조회수 범위</div>
            <div className="flex gap-2">
              <CommaInput value={vMin} onChange={setVMin} />
              <CommaInput value={vMax} onChange={setVMax} />
            </div>
          </div>
          <div>
            <div className="mb-1">팔로워 범위</div>
            <div className="flex gap-2">
              <CommaInput value={fMin} onChange={setFMin} />
              <CommaInput value={fMax} onChange={setFMax} />
            </div>
          </div>
          <div>
            <div className="mb-1">업로드 기간</div>
            <div className="flex gap-2">
              <input type="date" className="border rounded px-2 py-1 w-1/2" value={dMin} min={minDate} max={maxDate} onChange={e=>setDMin(e.target.value)} />
              <input type="date" className="border rounded px-2 py-1 w-1/2" value={dMax} min={minDate} max={maxDate} onChange={e=>setDMax(e.target.value)} />
            </div>
            <div className="text-xs text-neutral-500 mt-1">현재 결과의 범위 밖 날짜는 자동으로 제한됩니다.</div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="px-2 py-1 border rounded" onClick={reset}>초기화</button>
            <button className="px-2 py-1 border rounded bg-black text-white" onClick={apply}>적용</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExportButtons({ items, onProgress }: { items: SearchRow[]; onProgress: { open: (t:string, i?:number)=>void; tick: (max?:number, step?:number, ms?:number)=>void; finish: (delay?:number)=>void } }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(window as any).__rowSelect = { selected, setSelected }
  }, [selected])
  const guardSelected = () => {
    if (!selected.size) { alert('선택된 콘텐츠가 없습니다.'); return false }
    return true
  }
  const toXlsx = async () => {
    if (!guardSelected()) return
    onProgress.open('엑셀을 생성하고 있습니다…', 5)
    onProgress.tick(90, 1, 450)
    const selectedItems = items.filter(i => selected.has(i.url))
    const res = await fetch('/api/export-xlsx', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: selectedItems }) })
    if (!res.ok) return alert('엑셀 생성 실패')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reels.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    onProgress.finish()
  }
  const downloadVideos = async () => {
    if (!guardSelected()) return
    onProgress.open('영상을 준비하고 있습니다…', 5)
    onProgress.tick(92, 1, 450)
    const urls = items.filter(i => selected.has(i.url)).map(i => (i as any).videoUrl).filter(u => typeof u === 'string' && u.startsWith('http')) as string[]
    if (!urls.length) return alert('다운로드 가능한 영상 URL이 없습니다')
    const res = await fetch('/api/downloads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }) })
    if (!res.ok) return alert('영상 다운로드 실패')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = urls.length === 1 ? 'reel.mp4' : 'reels.zip'
    a.click()
    URL.revokeObjectURL(url)
    onProgress.finish()
  }
  const openLinks = () => {
    if (!guardSelected()) return
    const urls = items.filter(i => selected.has(i.url)).map(i => i.url)
    if (typeof window !== 'undefined') urls.forEach(u => window.open(u, '_blank'))
  }
  return (
    <div className="flex items-center gap-2">
      <button className="px-2 py-1 border rounded" onClick={openLinks}>영상 바로가기</button>
      <button className="px-2 py-1 border rounded" onClick={toXlsx}>엑셀 추출</button>
      <button className="px-2 py-1 border rounded" onClick={downloadVideos}>영상(mp4) 추출</button>
    </div>
  )
}

function RowCheck({ url }: { url: string }) {
  const [, setTick] = useState(0)
  const toggle = (checked: boolean) => {
    if (typeof window === 'undefined') return
    const api = (window as any).__rowSelect as { selected?: Set<string>; setSelected?: any }
    if (!api) return
    if (typeof api.setSelected === 'function') {
      api.setSelected((prev: Set<string>) => {
        const next = new Set(prev || [])
        if (checked) next.add(url); else next.delete(url)
        return next
      })
    } else if (api.selected) {
    if (checked) api.selected.add(url); else api.selected.delete(url)
    }
    setTick(v => v + 1)
  }
  const checked = (() => {
    if (typeof window === 'undefined') return false
    const api = (window as any).__rowSelect as { selected?: Set<string> } | undefined
    return !!api?.selected?.has?.(url)
  })()
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Checkbox 
        checked={checked} 
        onCheckedChange={(newChecked) => {
          toggle(!!newChecked)
        }} 
      />
    </div>
  )
}

function CaptionDialog({ caption }: { caption: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="px-2 py-1 text-xs border rounded hover:bg-neutral-50" onClick={() => setOpen(true)}>
        캡션 확인
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg max-w-xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">캡션</h2>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 border rounded" onClick={() => { navigator.clipboard.writeText(caption || ''); alert('복사되었습니다') }}>복사</button>
                <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-left max-h-[60vh] overflow-auto">{caption || '-'}</div>
          </div>
        </div>
      )}
    </>
  )
}

function SubtitleDialog({ url }: { url: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  // simple in-memory cache per URL
  const cache = (globalThis as any).__subtitleCache || ((globalThis as any).__subtitleCache = new Map<string, string>())
  const showCreditModal = (message = '자막 추출에는 20 크레딧이 필요해요. 업그레이드 또는 충전 후 다시 시도해 주세요.') => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
    modal.innerHTML = `
      <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
        <div class="text-base font-semibold mb-3">크레딧 부족</div>
        <div class="text-sm text-neutral-700">${message}</div>
        <div class="flex items-center justify-end gap-2 mt-4">
          <button id="cnl" class="px-3 py-1.5 text-sm border rounded">닫기</button>
          <a id="go" class="px-3 py-1.5 text-sm border rounded bg-black text-white" href="/pricing">업그레이드/충전</a>
        </div>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('#cnl')?.addEventListener('click', () => modal.remove())
  }
  const ensureCredits = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' })
      if (!res.ok) return false
      const j = await res.json().catch(() => ({}))
      const credits = Number(j?.credits || 0)
      if (!Number.isFinite(credits) || credits < 20) { showCreditModal(); return false }
      return true
    } catch {
      return false
    }
  }
  const load = async () => {
    if (!url) { alert('영상 URL이 없습니다'); return }
    // if cached, show immediately
    if (cache.has(url)) {
      setText(cache.get(url) || '')
      setOpen(true)
      return
    }
    setLoading(true)
    // tie into page-level overlay via DOM events
    document.body.dispatchEvent(new CustomEvent('relcher:progress', { detail: { action: 'open', title: '자막을 추출하고 있습니다…' } }))
    document.body.dispatchEvent(new CustomEvent('relcher:progress', { detail: { action: 'tick', max: 92, step: 2, ms: 250 } }))
    try {
      const res = await fetch('/api/captions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      if (!res.ok) throw new Error('자막 추출 실패')
      const j = await res.json()
      const t = j?.captions || ''
      cache.set(url, t)
      setText(t)
      setOpen(true)
    } catch (e: any) {
      alert(e?.message || '자막 추출 실패')
    } finally {
      setLoading(false)
      document.body.dispatchEvent(new CustomEvent('relcher:progress', { detail: { action: 'finish' } }))
    }
  }
  return (
    <>
      <button
        className="px-2 py-1 text-xs border rounded hover:bg-neutral-50"
        onClick={() => { if (cache.has(url)) { setText(cache.get(url) || ''); setOpen(true); } else { setConfirmOpen(true) } }}
        disabled={loading}
      >
        {loading ? '추출 중…' : (cache.has(url) ? '자막 확인' : '자막 추출')}
      </button>
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-md p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="text-sm text-left">
              음성이 없는 영상의 경우 빈 값이 출력될 수 있습니다. 먼저 음성이 있는 영상인지 확인해주세요.
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="px-3 py-1 border rounded" onClick={()=>setConfirmOpen(false)}>취소</button>
              <button className="px-3 py-1 border rounded bg-black text-white" onClick={async ()=>{ const ok = await ensureCredits(); if (!ok) return; setConfirmOpen(false); load(); }}>추출 (20크레딧)</button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg max-w-xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">자막</h2>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 border rounded" onClick={() => { navigator.clipboard.writeText(text || ''); alert('복사되었습니다') }}>복사</button>
                <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-left max-h-[60vh] overflow-auto">{text || '-'}</div>
          </div>
        </div>
      )}
    </>
  )
}

// Button that opens a modal preview with robust fallbacks (image → derived jpg → looping video)
function PreviewThumbButton({ row }: { row: any }) {
  const [open, setOpen] = useState(false)
  const warmup = () => {
    const src = buildInitialPreviewSrc(row)
    if (src) preloadImage(src)
  }
  return (
    <>
      <button className="px-2 py-1 text-xs border rounded hover:bg-neutral-50" onMouseEnter={warmup} onClick={() => setOpen(true)}>썸네일 보기</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-[420px] p-3" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-sm">미리보기</h2>
              <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <PreviewContent row={row} />
          </div>
        </div>
      )}
    </>
  )
}

function PreviewContent({ row }: { row: any }) {
  const [src, setSrc] = useState<string | null>(() => buildInitialPreviewSrc(row))
  const [stage, setStage] = useState<'img' | 'guess' | 'video' | 'none'>(row?.thumbnailUrl ? 'img' : (row?.videoUrl || row?.video_url ? 'guess' : 'none'))
  const [retry, setRetry] = useState(0)
  const reelUrl: string = row?.url
  const tryNext = () => {
    // Retry same stage up to 2 times with cache-bust, then move on
    if (retry < 2 && (stage === 'img' || stage === 'guess')) {
      const bust = Date.now().toString(36)
      if (src) setSrc(`${src}${src.includes('?') ? '&' : '?'}b=${bust}`)
      setRetry((r) => r + 1)
      return
    }
    setRetry(0)
    if (stage === 'img') {
      const g = buildGuessFromVideo(row)
      if (g) { setSrc(g); setStage('guess'); return }
      setStage('video'); return
    }
    if (stage === 'guess') { setStage('video'); return }
    setStage('none')
  }
  const box = 'w-[280px] h-[420px]';
  if (stage === 'video') {
    const v: string | undefined = row?.videoUrl || row?.video_url
    if (v) {
      return <video className={`rounded object-cover ${box}`} src={v} muted loop playsInline preload="metadata" />
    }
    setStage('none')
  }
  if (stage === 'none') {
    return <div className={`grid place-items-center bg-neutral-100 text-neutral-400 rounded ${box}`}>미리보기를 불러올 수 없습니다</div>
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <div className="flex flex-col gap-3 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || ''} alt="thumb" className={`rounded object-cover ${box}`} onError={tryNext} />
      {typeof reelUrl === 'string' && reelUrl.startsWith('http') && (
        <a href={reelUrl} target="_blank" rel="noreferrer" className="w-full text-center px-3 py-2 border rounded bg-black text-white">영상 바로가기</a>
      )}
    </div>
  )
}

// Helpers
function buildInitialPreviewSrc(row: any): string | null {
  if (row?.thumbnailUrl && typeof row.thumbnailUrl === 'string') {
    return `/api/image-proxy?src=${encodeURIComponent(row.thumbnailUrl)}`
  }
  const g = buildGuessFromVideo(row)
  return g || null
}

function buildGuessFromVideo(row: any): string | null {
  const v: string | undefined = row?.videoUrl || row?.video_url
  if (v && typeof v === 'string') {
    try {
      const u = new URL(v)
      const guess = `${u.origin}${u.pathname.replace(/\.[a-z0-9]+$/i, '.jpg')}${u.search}`
      return `/api/image-proxy?src=${encodeURIComponent(guess)}`
    } catch {}
  }
  return null
}

// warm up cache for an image URL using Image() loader
const __imgCache: Record<string, boolean> = (globalThis as any).__imgCache || ((globalThis as any).__imgCache = {})
function preloadImage(src: string) {
  if (!src || __imgCache[src]) return
  const img = new Image()
  img.onload = () => { __imgCache[src] = true }
  img.onerror = () => { /* ignore; modal fallback will handle */ }
  // add a small cache-bust the first time to avoid stale 404s from intermediary caches
  const url = new URL(src, location.origin)
  if (!url.searchParams.has('pre')) url.searchParams.set('pre', Date.now().toString(36))
  img.src = url.toString()
}

function ensurePreconnect(href: string) {
  try {
    const id = `preconnect-${href}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preconnect'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {}
}

function CommaInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string>(new Intl.NumberFormat('en-US').format(value || 0))
  useEffect(() => { setText(new Intl.NumberFormat('en-US').format(value || 0)) }, [value])
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '')
    const num = Number(raw)
    if (Number.isFinite(num)) {
      onChange(num)
      setText(new Intl.NumberFormat('en-US').format(num))
    } else {
      setText(e.target.value)
    }
  }
  return <input inputMode="numeric" pattern="[0-9,]*" className="border rounded px-2 py-1 w-1/2 text-right" value={text} onChange={onInput} />
}


