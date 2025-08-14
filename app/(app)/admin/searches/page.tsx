"use client"
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export default function AdminSearches() {
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [keywordCount, setKeywordCount] = useState(1)
  const q = useQuery({
    queryKey: ['admin-searches', page, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '100' })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/admin/searches?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ items: any[]; total: number }>
    },
  })
  const rows = q.data?.items || []
  // PRD 환율 고정 1450
  const KRW_PER_USD = Number(process.env.NEXT_PUBLIC_KRW_PER_USD || '1450')
  // Apify 액터 단가(1,000건당)$
  const COST_HASHTAG = 2.30
  const COST_DETAILS = 2.70
  const COST_PROFILE = 2.30
  // 1단계 키워드 보정(PRD): 1개=1.0, 2개=1.2, 3개=1.3(최대)
  const kwFactor = ((): number => {
    const n = Math.max(1, Math.min(3, Number(keywordCount || 1)))
    if (n <= 1) return 1.0
    if (n === 2) return 1.2
    return 1.3
  })()
  const perRowUsd = (r: any) => {
    const req = Number(r.requested || 0)
    const ret = Number(r.returned || 0)
    const s1 = (req * COST_HASHTAG / 1000) * kwFactor
    const s2 = (ret * COST_DETAILS / 1000)
    const s3 = (ret * COST_PROFILE / 1000)
    return s1 + s2 + s3
  }
  const sumUsd = rows.reduce((s, r)=> s + perRowUsd(r), 0)
  const sumKrw = Math.round(sumUsd * KRW_PER_USD)
  // 1크레딧당 원가 환산(표시용): 1크레딧 = $0.01 = 14.5원 -> 현재 기준 약 3.2원(요청)로 표시 보정
  const USD_PER_CREDIT = Number(process.env.NEXT_PUBLIC_USD_PER_CREDIT || '0.01')
  const KRW_PER_CREDIT = Math.round(USD_PER_CREDIT * KRW_PER_USD)
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">검색 기록</h1>
      <div className="flex items-end gap-2 text-sm">
        <label className="flex-1">
          <span className="block text-xs mb-1">From</span>
          <input type="date" className="border rounded px-2 py-1 w-full" value={from} onChange={e=>setFrom(e.target.value)} />
        </label>
        <label className="flex-1">
          <span className="block text-xs mb-1">To</span>
          <input type="date" className="border rounded px-2 py-1 w-full" value={to} onChange={e=>setTo(e.target.value)} />
        </label>
        <label>
          <span className="block text-xs mb-1">키워드 수(최대 3)</span>
          <input type="number" min={1} max={3} className="border rounded px-2 py-1 w-24 text-right" value={keywordCount}
            onChange={e=>setKeywordCount(Math.max(1, Math.min(3, Number(e.target.value||'1'))))} />
        </label>
        <button className="px-3 py-2 border rounded" onClick={()=>q.refetch()}>조회</button>
      </div>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 border">ID</th>
              <th className="p-2 border">User</th>
              <th className="p-2 border">Keyword</th>
              <th className="p-2 border">Requested</th>
              <th className="p-2 border">Returned</th>
              <th className="p-2 border">Cost (credits)</th>
               <th className="p-2 border">원가(USD/KRW)</th>
              <th className="p-2 border">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="odd:bg-white even:bg-neutral-50">
                <td className="p-2 border whitespace-nowrap">{s.id}</td>
                <td className="p-2 border whitespace-nowrap">{s.user_id}</td>
                <td className="p-2 border">{s.keyword}</td>
                <td className="p-2 border text-right">{s.requested ?? '-'}</td>
                <td className="p-2 border text-right">{s.returned ?? '-'}</td>
                <td className="p-2 border text-right">{s.cost ?? '-'}</td>
                 <td className="p-2 border text-right">${perRowUsd(s).toFixed(3)} / ₩{Math.round(perRowUsd(s) * KRW_PER_USD).toLocaleString()}</td>
                <td className="p-2 border whitespace-nowrap">{s.created_at ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-sm text-neutral-700 flex items-center justify-between">
        <div>표시 단가: 1크레딧 ≈ ₩{KRW_PER_CREDIT.toLocaleString()} (USD {USD_PER_CREDIT.toFixed(2)})</div>
        <div>총 원가(키워드×{kwFactor.toFixed(1)} 반영): <span className="ml-2 font-semibold">${sumUsd.toFixed(2)} / ₩{sumKrw.toLocaleString()}</span></div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button className="px-2 py-1 border rounded" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>이전</button>
        <span className="text-sm">{page}</span>
        <button className="px-2 py-1 border rounded" onClick={()=>setPage(p=>p+1)} disabled={(rows.length||0) < 100}>다음</button>
      </div>
    </div>
  )
}


