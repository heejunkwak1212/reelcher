"use client"
import { useQuery } from '@tanstack/react-query'

export default function AdminHome() {
  const q = useQuery({
    queryKey: ['admin-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/summary', { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ users: number; searches: number; totalCredits: number }>
    },
  })
  const data = q.data
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">관리자</h1>
      <div className="flex items-center gap-2">
        <a href="/admin/users" className="px-3 py-2 border rounded">사용자 관리</a>
        <a href="/admin/searches" className="px-3 py-2 border rounded">검색 기록</a>
        <a href="/admin/credits" className="px-3 py-2 border rounded">크레딧</a>
        <a href="/admin/payments" className="px-3 py-2 border rounded">결제</a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="사용자 수" value={data?.users ?? '-'} />
        <Card title="검색 건수" value={data?.searches ?? '-'} />
        <Card title="총 보유 크레딧" value={data?.totalCredits ?? '-'} />
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm text-neutral-600">{title}</div>
      <div className="text-2xl font-bold">{String(value)}</div>
    </div>
  )
}


