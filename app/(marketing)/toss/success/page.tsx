"use client"

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// Avoid static prerendering issues with useSearchParams
export const dynamic = 'force-dynamic'

function TossSuccessContent() {
  const sp = useSearchParams()
  const router = useRouter()
  const [msg, setMsg] = useState('결제 확인 중…')

  useEffect(() => {
    const paymentKey = sp.get('paymentKey')
    const orderId = sp.get('orderId')
    const amount = Number(sp.get('amount') || '0')
    if (!paymentKey || !orderId || !amount) { setMsg('잘못된 요청입니다'); return }
    ;(async () => {
      try {
        const res = await fetch('/api/toss/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentKey, orderId, amount }) })
        if (!res.ok) throw new Error(await res.text())
        setMsg('결제가 확인되었습니다. 잠시 후 대시보드로 이동합니다…')
        setTimeout(() => router.replace('/dashboard'), 1200)
      } catch (e: any) {
        setMsg(`결제 확인 실패: ${e?.message || ''}`)
      }
    })()
  }, [sp, router])

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center text-sm text-neutral-700">{msg}</div>
    </div>
  )
}

export default function TossSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center p-6"><div className="text-center text-sm text-neutral-700">로딩 중...</div></div>}>
      <TossSuccessContent />
    </Suspense>
  )
}


