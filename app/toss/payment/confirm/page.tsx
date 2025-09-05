'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Check, CreditCard, Shield } from 'lucide-react'

export default function PaymentConfirmPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const billingKey = searchParams.get('billingKey')
  const customerKey = searchParams.get('customerKey')
  const plan = searchParams.get('plan') || 'starter'
  const isUpgrade = searchParams.get('upgrade') === 'true'

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')

  // 플랜별 정보 및 기능 설명 (pricing 페이지 기준)
  const planInfo = {
    starter: { 
      name: '스타터 플랜', 
      price: 19000, 
      credits: 2000, 
      features: [
        "월 2,000 크레딧",
        "FREE 플랜의 모든 기능",
        "최대 60개 검색 결과",
        "자막 추출 기능"
      ]
    },
    pro: { 
      name: '프로 플랜', 
      price: 49000, 
      credits: 7000,
      features: [
        "월 7,000 크레딧",
        "STARTER 플랜의 모든 기능",
        "최대 90개 검색 결과"
      ]
    },
    business: { 
      name: '비즈니스 플랜', 
      price: 119000, 
      credits: 20000,
      features: [
        "월 20,000 크레딧",
        "PRO 플랜의 모든 기능",
        "최대 120개 검색 결과",
        "최우선 지원"
      ]
    }
  }

  const currentPlan = planInfo[plan as keyof typeof planInfo] || planInfo.starter

  useEffect(() => {
    console.log('🎯 결제 확인 페이지 로드됨:', { plan, isUpgrade })

    // 업그레이드 모드일 때는 billingKey와 customerKey가 필수
    if (isUpgrade && (!billingKey || !customerKey)) {
      console.error('❌ 업그레이드 모드에서 결제 정보 누락')
      setError('플랜 변경을 위한 결제 정보가 올바르지 않습니다. 다시 시도해주세요.')
    } else if (!isUpgrade && (!billingKey || !customerKey)) {
      console.error('❌ 신규 구독에서 결제 정보 누락')
      setError('결제 정보가 올바르지 않습니다.')
    } else {
      console.log('✅ 결제 정보 확인 완료')
      
      // URL에서 민감한 정보 제거
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('billingKey')
      newUrl.searchParams.delete('customerKey')
      window.history.replaceState({}, '', newUrl.toString())
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        {/* 상단 체크 아이콘 */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            카드 등록이 완료됐어요!
          </h1>
          <p className="text-gray-600 text-base">
            선택하신 플랜으로 더 많은 기능을 이용할 수 있어요
          </p>
        </div>

        {/* 플랜 정보 카드 */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
              {currentPlan.name}
            </h2>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-gray-900">
                {currentPlan.price.toLocaleString()}원
                <span className="text-lg font-medium text-gray-500">/월</span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {currentPlan.credits.toLocaleString()} 크레딧 제공
              </div>
            </div>

            {/* 기능 목록 */}
            <div className="space-y-3 mb-6">
              {currentPlan.features.map((feature, index) => (
                <div key={index} className="flex items-center">
                  <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                  <span className="text-sm text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 결제 방법 */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">결제 방법</h3>
          <Card className="border-2 border-gray-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CreditCard className="w-5 h-5 text-gray-700 mr-3" />
                  <span className="text-base font-medium text-gray-900">카드 결제</span>
                  <span className="text-sm text-gray-600 ml-2">안전한 카드 결제 시스템</span>
                </div>
                <div className="w-4 h-4 bg-black rounded-full"></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 결제 요약 */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">결제 요약</h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{currentPlan.name} (VAT 부가세 포함)</span>
              <span className="font-medium">{currentPlan.price.toLocaleString()}원/월</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-bold">
                <span>총 결제 금액</span>
                <span>{currentPlan.price.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* 결제하기 및 취소 버튼 */}
        <div className="space-y-2 mb-10">
          <Button 
            onClick={handlePaymentConfirm}
            disabled={isProcessing}
            className="w-full bg-black hover:bg-gray-800 text-white py-4 text-base font-medium"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                결제 처리 중...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                결제하기
              </>
            )}
          </Button>
          
          <Button
            onClick={() => router.push('/pricing')}
            disabled={isProcessing}
            variant="outline"
            className="w-full bg-white hover:bg-gray-50 text-gray-900 border-gray-300 py-4 text-base font-medium"
          >
            취소
          </Button>
        </div>

        {/* 보안 안내 */}
        <div className="flex flex-col items-center">
          <div className="mb-2">
            <Shield className="w-5 h-5 text-green-500" />
          </div>
          <span className="text-xs text-gray-500 text-center">
            안전한 결제 시스템으로 보호돼요
          </span>
          <p className="text-xs text-gray-400 text-center mt-1">
            결제 정보는 암호화하여 안전하게 처리돼요
          </p>
        </div>
      </div>
    </div>
  )
}
