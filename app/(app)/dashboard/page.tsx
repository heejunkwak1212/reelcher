"use client"
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import TossPayButton from '@/components/payments/TossPayButton'

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
      <SubscriptionManager />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-gray-200 rounded p-4">
          <div className="text-sm text-neutral-600">최근 검색 수</div>
          <div className="text-2xl font-bold">{recent ?? '-'}</div>
        </div>
        <div className="border border-gray-200 rounded p-4">
          <div className="text-sm text-neutral-600">잔여 크레딧</div>
          <div className="text-2xl font-bold">{credit ?? '-'}</div>
        </div>
        <div className="border border-gray-200 rounded p-4">
          <div className="text-sm text-neutral-600">이번 달 사용량</div>
          <div className="text-2xl font-bold">-</div>
        </div>
      </div>
      <div>
        <h2 className="text-sm text-neutral-600 mb-2">결제 테스트</h2>
        <TossPayButton />
      </div>
    </div>
  )
}

function SubscriptionManager() {
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  useEffect(()=>{ (async()=>{ const j = await fetch('/api/me',{cache:'no-store'}).then(r=>r.json()).catch(()=>null); setMe(j) })() },[])
  const changePlan = async (p: 'starter'|'pro'|'business') => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions/change', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ plan: p }) })
      if (!res.ok) throw new Error(await res.text())
      alert('플랜이 변경되었습니다')
      location.reload()
    } catch(e:any){ alert(e?.message||'변경 실패') } finally { setLoading(false) }
  }
  const cancel = async () => {
    if (!confirm('구독을 취소하시겠어요?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/subscriptions/cancel', { method:'POST' })
      if (!res.ok) throw new Error(await res.text())
      alert('구독이 취소되었습니다')
      location.reload()
    } catch(e:any){ alert(e?.message||'취소 실패') } finally { setLoading(false) }
  }
  return (
    <div className="border border-gray-200 rounded p-4">
      <h2 className="font-medium mb-2">구독 관리</h2>
      <div className="text-sm text-neutral-700 mb-2">현재 플랜: {me?.plan || '-'}</div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 border border-gray-200 rounded hover:border-gray-300 transition-colors" onClick={()=>changePlan('starter')} disabled={loading}>스타터로 변경</button>
        <button className="px-3 py-2 border border-gray-200 rounded hover:border-gray-300 transition-colors" onClick={()=>changePlan('pro')} disabled={loading}>프로로 변경</button>
        <button className="px-3 py-2 border border-gray-200 rounded hover:border-gray-300 transition-colors" onClick={()=>changePlan('business')} disabled={loading}>비즈니스로 변경</button>
        <button className="px-3 py-2 border border-gray-200 rounded bg-black text-white hover:bg-gray-800 transition-colors" onClick={cancel} disabled={loading}>구독 취소</button>
      </div>
    </div>
  )
}


