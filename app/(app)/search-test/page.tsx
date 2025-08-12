'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

// Small inline thumbnail that always shows; hover opens larger preview; click opens modal.
function InlineThumb({ row }: { row: any }) {
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)
  const src = buildInitialPreviewSrc(row)
  const box = 'w-14 h-21' // 56x84px
  return (
    <div className="relative" onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src || ''} alt="thumb" className={`rounded object-cover ${box}`} style={{width:56, height:84}} onClick={()=>setOpen(true)} />
      {hover && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20">
          <div className="bg-white border shadow rounded p-1">
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
  const [keyword, setKeyword] = useState('재테크')
  // period UI removed for MVP
  const [limit, setLimit] = useState<'5' | '30' | '60'>('30')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SearchRow[] | null>(null)
  const [sort, setSort] = useState<'views' | 'latest' | 'oldest'>('views')
  const [filters, setFilters] = useState<{ views?: [number, number]; followers?: [number, number]; date?: [string, string] }>({})
  const [debug, setDebug] = useState<any>(null)
  const [raw, setRaw] = useState<string>('')
  const [, forceTick] = useState(0)
  

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
    setLoading(true)
    setItems(null)
    setDebug(null)
    setRaw('')
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keyword, limit, debug: true }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = (j && (j.message || j.error)) || `Request failed (${res.status})`
        alert(msg)
        setRaw(JSON.stringify(j || { error: msg }, null, 2))
        return
      }
      const json = await res.json()
      const arr: SearchRow[] = Array.isArray(json.items) ? json.items : []
      // default sort: views desc
      arr.sort((a, b) => (b.views || 0) - (a.views || 0))
      setItems(arr)
      setDebug(json.debug ?? null)
      setRaw(JSON.stringify(json, null, 2))
    } catch (e) {
      const msg = (e as Error).message
      setRaw(msg)
    } finally {
      setLoading(false)
    }
  }

  // Prefetch thumbnails (all) to make modal open instantly
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return
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

  

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Search API quick test</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="col-span-2">
          <span className="block text-sm mb-1">keyword</span>
          <input className="w-full border rounded px-3 py-2" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </label>
        {/* period selector removed */}
        <label>
          <span className="block text-sm mb-1">limit</span>
          <select className="w-full border rounded px-3 py-2" value={limit} onChange={(e) => setLimit(e.target.value as any)}>
            <option value="5">5 (개발용)</option>
            <option value="30">30</option>
            <option value="60">60</option>
          </select>
        </label>
        {/* minViews removed */}
      </div>
      <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run search'}</Button>
      

      {Array.isArray(items) && items.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex items-center justify-between mb-2 text-sm text-neutral-600 gap-2">
            <div className="flex items-center gap-3">
              <span>Items: {items.length}</span>
              <label className="flex items-center gap-1">
                <input id="checkall" type="checkbox" onChange={(e)=>{
                  const set = new Set<string>(e.target.checked ? items.map(i=>i.url) : [])
                  ;(window as any).__rowSelect = { selected: set }
                  document.querySelectorAll<HTMLInputElement>('input[data-row-check]')
                    .forEach(inp => { inp.checked = e.target.checked })
                }} /> 전체선택
              </label>
            </div>
            <div className="flex items-center gap-2">
              <ClientFilters items={items} setItems={setItems} setFilters={setFilters} />
              <SortMenu items={items} setItems={setItems} sort={sort} setSort={setSort} />
              <ExportButtons items={items} />
            </div>
          </div>
          <table className="min-w-full text-sm border">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-2 border">Select</th>
                <th className="p-2 border">Thumb</th>
                <th className="p-2 border">Uploaded</th>
                <th className="p-2 border">Views</th>
                <th className="p-2 border">Duration</th>
                <th className="p-2 border">Likes</th>
                <th className="p-2 border">Comments</th>
                <th className="p-2 border">Account</th>
                <th className="p-2 border">Caption</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                 <tr key={r.url} className="odd:bg-white even:bg-neutral-50 align-top">
                  <td className="p-2 border text-center align-middle"><RowCheck url={r.url} /></td>
                  <td className="p-2 border whitespace-nowrap text-center align-middle"><InlineThumb row={r as any} /></td>
                  <td className="p-2 border whitespace-nowrap text-center align-middle">{r.takenDate ?? '-'}</td>
                  <td className="p-2 border text-center align-middle">{formatNumber(r.views)}</td>
                  <td className="p-2 border text-center align-middle">{formatDuration(r.duration)}</td>
                  <td className="p-2 border text-center align-middle">{r.likes === 'private' ? '-' : formatNumber(r.likes as number)}</td>
                  <td className="p-2 border text-center align-middle">{formatNumber(r.comments)}</td>
                  <td className="p-2 border text-center align-middle">
                    {r.username ? (
                      <div>
                        <a className="text-blue-600 underline" href={`https://www.instagram.com/${r.username}/`} target="_blank" rel="noreferrer">@{r.username}</a>
                        <div className="text-xs text-neutral-500">{typeof r.followers === 'number' ? new Intl.NumberFormat('en-US').format(r.followers) : '-'} 팔로워</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="p-2 border max-w-xs text-center align-middle"><CaptionDialog caption={r.caption || ''} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <pre className="whitespace-pre-wrap text-xs bg-neutral-50 border rounded p-3 overflow-auto max-h-[60vh]">
        {raw}
      </pre>
    </div>
  )
}

function SortMenu({ items, setItems, sort, setSort }: { items: SearchRow[]; setItems: (v: SearchRow[]) => void; sort: 'views' | 'latest' | 'oldest'; setSort: (v: 'views' | 'latest' | 'oldest') => void }) {
  const [open, setOpen] = useState(false)
  const apply = (mode: 'latest' | 'oldest' | 'views') => {
    const sorted = [...items]
    if (mode === 'views') {
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0))
    } else if (mode === 'latest') {
      sorted.sort((a, b) => (Date.parse(b.takenDate || '') || 0) - (Date.parse(a.takenDate || '') || 0))
    } else {
      sorted.sort((a, b) => (Date.parse(a.takenDate || '') || 0) - (Date.parse(b.takenDate || '') || 0))
    }
    setItems(sorted)
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

function ClientFilters({ items, setItems, setFilters }: { items: SearchRow[]; setItems: (v: SearchRow[]) => void; setFilters: (v: any) => void }) {
  const [open, setOpen] = useState(false)
  // ranges derive from current items
  const viewsArr = items.map(i => i.views || 0)
  const followersArr = items.map(i => i.followers || 0)
  const minViews = Math.min(...viewsArr, 0)
  const maxViews = Math.max(...viewsArr, 0)
  const minFollowers = Math.min(...followersArr, 0)
  const maxFollowers = Math.max(...followersArr, 0)
  const dates = items.map(i => i.takenDate ? Date.parse(i.takenDate) : 0).filter(Boolean)
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
    const filtered = items.filter(i => {
      const okViews = (i.views || 0) >= vMin && (i.views || 0) <= vMax
      const okFollowers = (i.followers || 0) >= fMin && (i.followers || 0) <= fMax
      const ts = i.takenDate ? Date.parse(i.takenDate) : 0
      const okDate = !dMin || !dMax ? true : (ts >= Date.parse(dMin) && ts <= Date.parse(dMax))
      return okViews && okFollowers && okDate
    })
    setItems(filtered)
    setFilters({ views: [vMin, vMax], followers: [fMin, fMax], date: [dMin, dMax] })
    setOpen(false)
  }
  const reset = () => { setItems(items.slice()); setOpen(false) }
  return (
    <div className="relative">
      <button className="px-2 py-1 border rounded" onClick={() => setOpen(v => !v)}>필터</button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border rounded shadow z-10 text-sm p-3 w-[20rem] space-y-2">
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

function ExportButtons({ items }: { items: SearchRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  ;(window as any).__rowSelect = { selected, setSelected } // quick share to RowCheck
  const guardSelected = () => {
    if (!selected.size) { alert('선택된 콘텐츠가 없습니다.'); return false }
    return true
  }
  const toXlsx = async () => {
    if (!guardSelected()) return
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
  }
  const downloadVideos = async () => {
    if (!guardSelected()) return
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
  }
  const openLinks = () => {
    if (!guardSelected()) return
    const urls = items.filter(i => selected.has(i.url)).map(i => i.url)
    urls.forEach(u => window.open(u, '_blank'))
  }
  return (
    <div className="flex items-center gap-2">
      <button className="px-2 py-1 border rounded" onClick={openLinks}>영상 바로가기</button>
      <button className="px-2 py-1 border rounded" onClick={toXlsx}>엑셀</button>
      <button className="px-2 py-1 border rounded" onClick={downloadVideos}>영상</button>
    </div>
  )
}

function RowCheck({ url }: { url: string }) {
  const [, setTick] = useState(0)
  const toggle = (checked: boolean) => {
    const api = (window as any).__rowSelect as { selected: Set<string> }
    if (!api) return
    if (checked) api.selected.add(url); else api.selected.delete(url)
    setTick(v => v + 1)
  }
  const api = (window as any).__rowSelect as { selected?: Set<string> } | undefined
  const checked = !!api?.selected?.has?.(url)
  return <input data-row-check type="checkbox" checked={checked} onChange={(e)=>toggle(e.target.checked)} />
}

function CaptionDialog({ caption }: { caption: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="px-2 py-1 text-xs border rounded hover:bg-neutral-50" onClick={() => setOpen(true)}>
        캡션 확인하기
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg max-w-2xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">캡션</h2>
              <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 border rounded" onClick={() => { navigator.clipboard.writeText(caption || ''); alert('복사되었습니다') }}>복사</button>
                <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap max-h-[60vh] overflow-auto">{caption || '-'}</div>
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
  const box = 'w-[320px] h-[480px]';
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
  return <img src={src || ''} alt="thumb" className={`rounded object-cover ${box}`} onError={tryNext} />
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
  return <input inputMode="numeric" className="border rounded px-2 py-1 w-1/2 text-right" value={text} onChange={onInput} />
}


