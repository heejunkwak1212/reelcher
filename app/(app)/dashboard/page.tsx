"use client"
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [credit, setCredit] = useState<number | null>(null)
  const [recent, setRecent] = useState<number | null>(null)
  useEffect(() => {
    const run = async () => {
      const supabase = supabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: credits } = await supabase.from('credits').select('balance').eq('user_id', user.id as any).single()
      const { count } = await supabase.from('searches').select('*', { count: 'exact', head: true }).eq('user_id', user.id as any)
      setCredit((credits as any)?.balance ?? 0)
      setRecent(count ?? 0)
    }
    run().catch(() => {})
  }, [])
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">대시보드</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded p-4">
          <div className="text-sm text-neutral-600">최근 검색 수</div>
          <div className="text-2xl font-bold">{recent ?? '-'}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-neutral-600">잔여 크레딧</div>
          <div className="text-2xl font-bold">{credit ?? '-'}</div>
        </div>
        <div className="border rounded p-4">
          <div className="text-sm text-neutral-600">이번 달 사용량</div>
          <div className="text-2xl font-bold">-</div>
        </div>
      </div>
    </div>
  )
}


