"use client"
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const openToss = async (plan: 'starter'|'pro'|'business') => {
    // 실제 SDK 삽입 예시 (주석):
    try {
      const anyWin = window as any
      // SDK가 아직 window에 없으면 스크립트 동적 로드 후 재시도
      if (!anyWin?.TossPayments) {
        await new Promise<void>((resolve, reject) => {
          const id = 'toss-sdk'
          if (document.getElementById(id)) { setTimeout(()=>resolve(), 300); return }
          const s = document.createElement('script')
          s.id = id
          s.src = 'https://js.tosspayments.com/v1'
          s.async = true
          s.defer = true
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('SDK load failed'))
          document.body.appendChild(s)
        })
      }
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
      if (!clientKey) { alert('NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다'); return }
      const me = await fetch('/api/me', { cache: 'no-store' }).then(r=>r.json())
      const customerKey = me?.id || 'user'
      const tossPayments = anyWin.TossPayments(clientKey)
      const origin = window.location.origin
      // Redirect flow: Toss 결제창 → successUrl(우리)로 돌아오면 authKey를 받아 서버에서 billingKey 발급
      await tossPayments.requestBillingAuth('카드', {
        customerKey,
        successUrl: `${origin}/toss/billing/return?plan=${plan}`,
        failUrl: `${origin}/toss/fail`
      })
      return
    } catch (e) {
      console.error(e)
      alert('결제창 호출에 실패했습니다')
    }
  }
  const buy = async (creditDelta: number) => {
    try {
      setLoading(String(creditDelta))
      const res = await fetch('/api/toss/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentKey: 'demo', orderId: 'demo-'+creditDelta, amount: 100, creditDelta }) })
      if (!res.ok) throw new Error(await res.text())
      alert('크레딧이 충전되었습니다')
    } catch (e: any) { alert(e?.message || '구매 실패') } finally { setLoading(null) }
  }
  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold">가격</h1>
        <p className="mt-2 text-[15px] leading-6" style={{ color: '#3A3B3F' }}>플랜을 선택하거나 크레딧을 추가로 구매하세요.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          <PlanCard name="FREE" price="0원" desc="월 250 크레딧" cta={null} />
          <PlanCard name="STARTER" price="19,000원" desc="월 3,000 크레딧" cta={<Button size="sm" onClick={()=>openToss('starter')}>구독</Button>} />
          <PlanCard name="PRO" price="49,000원" desc="월 10,000 크레딧" cta={<Button size="sm" onClick={()=>openToss('pro')}>구독</Button>} />
          <PlanCard name="BUSINESS" price="109,000원" desc="월 30,000 크레딧" cta={<Button size="sm" onClick={()=>openToss('business')}>구독</Button>} />
        </div>
        <h2 className="text-xl font-semibold mt-12">크레딧 추가 구매</h2>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" variant="secondary" disabled={loading==='1000'} onClick={()=>buy(1000)}>{loading==='1000'?'처리 중…':'크레딧 팩 1000 (6,900원)'} </Button>
        </div>
        <p className="text-xs text-neutral-500 mt-3">FREE 플랜에서는 추가 구매가 불가합니다. STARTER 이상에서 이용해 주세요.</p>
      </section>
    </main>
  )
}

function PlanCard({ name, price, desc, cta }: { name: string; price: string; desc: string; cta: React.ReactNode }) {
  return (
    <div className="border rounded p-5">
      <div className="text-sm text-neutral-500">{name}</div>
      <div className="text-2xl font-semibold mt-1">{price}</div>
      <div className="text-sm text-neutral-700 mt-2">{desc}</div>
      <div className="mt-4">{cta}</div>
    </div>
  )
}


