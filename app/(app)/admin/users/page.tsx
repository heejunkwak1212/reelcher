"use client"
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export default function AdminUsers() {
  const [page, setPage] = useState(1)
  const [email, setEmail] = useState('')
  const [promoting, setPromoting] = useState(false)
  const q = useQuery({
    queryKey: ['admin-users', page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?page=${page}&pageSize=50`, { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ 
        items: any[]; 
        profiles: any[]; 
        credits: any[]; 
        searchStats: Record<string, { totalCost: number; searchCount: number }>; 
        total: number 
      }>
    },
  })
  const rows = q.data?.items || []
  const profiles = q.data?.profiles || []
  const credits = q.data?.credits || []
  const searchStats = q.data?.searchStats || {}
  
  // Helper functions
  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId)
  const getCredits = (userId: string) => credits.find(c => c.user_id === userId)
  const getSearchStats = (userId: string) => searchStats[userId] || { totalCost: 0, searchCount: 0 }
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">사용자 관리</h1>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-sm mb-1">관리자로 승격할 이메일</span>
          <input className="w-full border border-gray-200 rounded px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="un030303@naver.com" />
        </label>
        <button className="px-3 py-2 border border-gray-200 rounded bg-black text-white" disabled={!email.trim() || promoting} onClick={async()=>{
          if (!email.trim()) return
          setPromoting(true)
          try {
            const res = await fetch('/api/admin/promote', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ email: email.trim() }) })
            const j = await res.json().catch(()=>({}))
            if (!res.ok) throw new Error(j?.error || '승격 실패')
            alert('관리자로 설정되었습니다')
          } catch (e) { alert((e as Error).message) } finally { setPromoting(false) }
        }}>관리자 추가</button>
      </div>
      <div className="text-sm text-neutral-600">총 {q.data?.total ?? 0}명</div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 border border-gray-200 w-20">ID</th>
              <th className="p-2 border border-gray-200">Email</th>
              <th className="p-2 border border-gray-200 w-24">플랜</th>
              <th className="p-2 border border-gray-200 w-20">잔액</th>
              <th className="p-2 border border-gray-200 w-24">사용량</th>
              <th className="p-2 border border-gray-200 w-20">검색수</th>
              <th className="p-2 border border-gray-200 w-32">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const profile = getProfile(u.id)
              const credit = getCredits(u.id)
              const stats = getSearchStats(u.id)
              return (
                <tr key={u.id} className="odd:bg-white even:bg-neutral-50">
                  <td className="p-2 border border-gray-200 whitespace-nowrap text-xs font-mono">
                    {u.id.slice(-8)}
                  </td>
                  <td className="p-2 border border-gray-200">{u.email || '-'}</td>
                  <td className="p-2 border border-gray-200 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      profile?.plan === 'pro' ? 'bg-blue-100 text-blue-800' :
                      profile?.plan === 'premium' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {profile?.plan || 'free'}
                    </span>
                  </td>
                  <td className="p-2 border border-gray-200 text-right">
                    {(credit?.balance || 0).toLocaleString()}
                  </td>
                  <td className="p-2 border border-gray-200 text-right font-medium">
                    {stats.totalCost.toLocaleString()}
                  </td>
                  <td className="p-2 border border-gray-200 text-center">
                    {stats.searchCount}
                  </td>
                  <td className="p-2 border border-gray-200 whitespace-nowrap text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button className="px-2 py-1 border border-gray-200 rounded hover:border border-gray-200-gray-300 transition-colors" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>이전</button>
        <span className="text-sm">{page}</span>
        <button className="px-2 py-1 border border-gray-200 rounded hover:border border-gray-200-gray-300 transition-colors" onClick={()=>setPage(p=>p+1)} disabled={(rows.length||0) < 50}>다음</button>
      </div>
    </div>
  )
}


