"use client"
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export default function AdminCredits() {
  const q = useQuery({
    queryKey: ['admin-credits'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users?page=1&pageSize=200', { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ items: any[]; profiles: any[]; credits: any[]; total: number }>
    },
  })
  const rows = (q.data?.items || []).map((u) => ({
    id: u.id,
    email: u.email,
  }))
  const creditMap = new Map<string, any>()
  ;(q.data?.credits || []).forEach((c: any) => creditMap.set(c.user_id, c))
  const [email, setEmail] = useState('')
  const [delta, setDelta] = useState(1000)
  const charge = async () => {
    if (!email || !delta) return alert('이메일과 크레딧을 입력하세요')
    const res = await fetch('/api/admin/users', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, creditDelta: delta }) })
    if (!res.ok) return alert('충전 실패')
    alert('충전되었습니다')
    setEmail('')
    q.refetch()
  }
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">크레딧</h1>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-xs mb-1">이메일</span>
          <input className="w-full border border-gray-200 rounded px-2 py-1" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@example.com" />
        </label>
        <label>
          <span className="block text-xs mb-1">충전 크레딧</span>
          <input type="number" className="w-32 border border-gray-200 rounded px-2 py-1 text-right" value={delta} onChange={e=>setDelta(Number(e.target.value||'0'))} />
        </label>
        <button className="px-3 py-2 border border-gray-200 rounded" onClick={charge}>충전</button>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 border border-gray-200">User</th>
              <th className="p-2 border border-gray-200">Balance</th>
              <th className="p-2 border border-gray-200">Reserved</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const c = creditMap.get(u.id) || {}
              return (
                <tr key={u.id} className="odd:bg-white even:bg-neutral-50">
                  <td className="p-2 border border-gray-200 whitespace-nowrap">{u.email || u.id}</td>
                  <td className="p-2 border border-gray-200 text-right">{c.balance ?? 0}</td>
                  <td className="p-2 border border-gray-200 text-right">{c.reserved ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


