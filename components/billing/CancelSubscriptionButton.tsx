"use client"
import { useState } from 'react'

export default function CancelSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!confirm('구독을 취소하시겠어요? 다음 결제일까지는 혜택이 유지됩니다.')) return
    setLoading(true)
    try {
      const r = await fetch('/api/toss/billing', { method: 'DELETE' })
      if (r.ok) {
        alert('구독이 취소되었습니다. 다음 결제일까지 혜택이 유지됩니다.')
        location.reload()
      } else {
        alert('취소에 실패했습니다')
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      className="px-3 py-2 rounded-md border text-sm disabled:opacity-50"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? '처리 중…' : '구독 취소'}
    </button>
  )
}


