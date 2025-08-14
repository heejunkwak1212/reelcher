"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

declare global {
  interface Window { TossPayments?: (key: string) => any }
}

export default function TossPayButton({ amount = 1000, label = '결제 테스트' }: { amount?: number; label?: string }) {
  const [ready, setReady] = useState(false)
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ''

  useEffect(() => {
    if (!clientKey) return
    const id = 'tosspayments-js'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.src = 'https://js.tosspayments.com/v1/payment'
      s.async = true
      s.id = id
      s.onload = () => setReady(true)
      document.body.appendChild(s)
    } else {
      setReady(true)
    }
  }, [clientKey])

  const pay = async () => {
    if (!clientKey || !window.TossPayments) return alert('Toss 클라이언트 키가 없습니다')
    const tp = window.TossPayments(clientKey)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    await tp.requestPayment('카드', {
      amount,
      orderId: `order_${Date.now()}`,
      orderName: 'Relcher 크레딧 테스트',
      successUrl: `${origin}/toss/success`,
      failUrl: `${origin}/dashboard?paid=0`,
    })
  }

  return (
    <Button onClick={(e)=>{e.preventDefault(); pay()}} disabled={!ready || !clientKey}>
      {label}
    </Button>
  )
}


