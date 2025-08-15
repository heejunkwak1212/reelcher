"use client"
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// Avoid static prerendering issues with useSearchParams
export const dynamic = 'force-dynamic'

function BillingReturnContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const [msg, setMsg] = useState('처리 중…')
  
  useEffect(() => {
    const authKey = sp.get('authKey')
    const customerKey = sp.get('customerKey')
    const plan = sp.get('plan') || 'starter'
    if (!authKey || !customerKey) { setMsg('잘못된 요청입니다'); return }
    ;(async () => {
      try {
        const ex = await fetch('/api/toss/billing/return', { method:'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authKey, customerKey }) })
        if (!ex.ok) throw new Error(await ex.text())
        const { billingKey } = await ex.json()
        const saved = await fetch('/api/toss/billing', { method:'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan, billingKey }) })
        if (!saved.ok) throw new Error(await saved.text())
        setMsg('구독이 활성화되었습니다. 대시보드로 이동합니다…')
        router.replace('/dashboard')
      } catch (e:any) {
        setMsg('처리 중 오류가 발생했습니다: ' + (e?.message || ''))
      }
    })()
  }, [sp, router])

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-sm text-neutral-700">{msg}</div>
    </div>
  )
}

export default function TossBillingReturn() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center p-6"><div className="text-sm text-neutral-700">로딩 중...</div></div>}>
      <BillingReturnContent />
    </Suspense>
  )
}


