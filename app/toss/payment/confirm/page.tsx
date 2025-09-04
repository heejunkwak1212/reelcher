'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function PaymentConfirmPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const billingKey = searchParams.get('billingKey')
  const customerKey = searchParams.get('customerKey')
  const plan = searchParams.get('plan') || 'starter'
  const isUpgrade = searchParams.get('upgrade') === 'true'

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  // 플랜별 정보
  const planInfo = {
    starter: { name: '스타터', price: 100, credits: 2000, color: 'bg-blue-500' },
    pro: { name: '프로', price: 49000, credits: 7000, color: 'bg-purple-500' },
    business: { name: '비즈니스', price: 119000, credits: 20000, color: 'bg-orange-500' }
  }

  const currentPlan = planInfo[plan as keyof typeof planInfo] || planInfo.starter

  useEffect(() => {
    console.log('🎯 결제 확인 페이지 로드됨:', { billingKey, customerKey, plan, isUpgrade })

    // 업그레이드 모드일 때는 billingKey와 customerKey가 필수
    if (isUpgrade && (!billingKey || !customerKey)) {
      console.error('❌ 업그레이드 모드에서 결제 정보 누락:', { billingKey, customerKey })
      setError('플랜 변경을 위한 결제 정보가 올바르지 않습니다. 다시 시도해주세요.')
    } else if (!isUpgrade && (!billingKey || !customerKey)) {
      console.error('❌ 신규 구독에서 결제 정보 누락:', { billingKey, customerKey })
      setError('결제 정보가 올바르지 않습니다.')
    } else {
      console.log('✅ 결제 정보 확인 완료')
    }
  }, [billingKey, customerKey, plan, isUpgrade])

  const handlePaymentConfirm = async () => {
    if (!billingKey || !customerKey) return

    setIsProcessing(true)
    setError('')

    try {
      if (isUpgrade) {
        // 플랜 업그레이드 처리
        const response = await fetch('/api/subscriptions/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billingKey,
            customerKey,
            newPlan: plan,
            upgrade: true
          })
        })

        const result = await response.json()

        if (response.ok && result.success) {
          // 업그레이드 성공 - 대시보드로 이동
          router.push(`/dashboard?subscription=success&plan=${plan}&action=upgrade&amount=${currentPlan.price}&credits=${currentPlan.credits}&message=업그레이드`)
        } else {
          setError(result.error || '업그레이드 처리 중 오류가 발생했습니다.')
        }
      } else {
        // 신규 구독 결제 처리
        const response = await fetch('/api/toss/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billingKey,
            customerKey,
            plan
          })
        })

        const result = await response.json()

        if (response.ok && result.success) {
          // 결제 성공 - 대시보드로 이동
          router.push(`/dashboard?subscription=success&plan=${plan}&action=subscribe&amount=${currentPlan.price}&credits=${currentPlan.credits}&message=구독`)
        } else {
          setError(result.message || '결제 처리 중 오류가 발생했습니다.')
        }
      }

    } catch (err) {
      console.error('Payment confirmation error:', err)
      setError('결제 처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 결제 정보가 없는 경우 에러 표시
  if (error && ((!billingKey || !customerKey) || (isUpgrade && (!billingKey || !customerKey)))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">❌</div>
            <h1 className="text-xl font-semibold mb-2">결제 정보 오류</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/pricing')} className="w-full">
              다시 시도
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {/* 아이콘 */}
          <div className="text-green-500 text-4xl mb-4">✅</div>

          <h1 className="text-2xl font-bold mb-2">
            {isUpgrade ? '플랜 변경 결제' : '카드 등록 완료!'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isUpgrade
              ? '플랜을 변경하시겠습니까?'
              : '이제 구독 결제를 진행하시겠습니까?'
            }
          </p>
          
          {/* 플랜 정보 */}
          <div className={`${currentPlan.color} text-white rounded-lg p-4 mb-6`}>
            <h2 className="text-xl font-semibold">{currentPlan.name} 플랜</h2>
            <div className="text-2xl font-bold mt-2">
              {currentPlan.price.toLocaleString()}원
              <span className="text-sm opacity-90">/월</span>
            </div>
            <div className="text-sm opacity-90 mt-1">
              {currentPlan.credits.toLocaleString()} 크레딧 제공
            </div>
          </div>
          
          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          {/* 버튼들 */}
          <div className="space-y-3">
            <Button 
              onClick={handlePaymentConfirm}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  결제 처리 중...
                </>
              ) : (
                `${currentPlan.price.toLocaleString()}원 결제하기`
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => router.push('/pricing')}
              disabled={isProcessing}
              className="w-full"
            >
              취소
            </Button>
          </div>
          
          {/* 안내 문구 */}
          <p className="text-xs text-gray-500 mt-4">
            {isUpgrade ? (
              <>등록된 카드로 안전하게 결제됩니다.<br/>
              다음 결제일부터 새 플랜 요금이 적용됩니다.</>
            ) : (
              <>등록된 카드로 안전하게 결제됩니다.<br/>
              언제든지 구독을 취소할 수 있습니다.</>
            )}
          </p>
        </div>
      </Card>
    </div>
  )
}
