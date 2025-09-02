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
    const period = sp.get('period') || 'monthly'
    
    console.log('Billing return params:', { authKey, customerKey, plan, period });
    
    if (!authKey || !customerKey) { 
      setMsg('잘못된 요청입니다. 결제 정보가 누락되었습니다.'); 
      return 
    }
    
    ;(async () => {
      try {
        setMsg('빌링키 발급 중...')
        
        // 1단계: authKey로 billingKey 발급
        const ex = await fetch('/api/toss/billing/return', { 
          method:'POST', 
          headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify({ authKey, customerKey, plan }) 
        })
        
        if (!ex.ok) {
          const errorText = await ex.text()
          throw new Error(`빌링키 발급 실패: ${errorText}`)
        }
        
        const response = await ex.json()
        console.log('Billing response:', response);
        
        // 새로운 플로우: 결제 확인 페이지로 리다이렉트
        if (response.success && response.redirectUrl) {
          setMsg('결제 확인 페이지로 이동합니다...')
          setTimeout(() => router.replace(response.redirectUrl), 1000)
        } else {
          throw new Error('빌링키 발급 응답이 올바르지 않습니다.')
        }
        
      } catch (e: any) {
        console.error('Billing process error:', e)
        setMsg('처리 중 오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류'))
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


