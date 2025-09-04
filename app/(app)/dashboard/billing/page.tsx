'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RainbowButton } from '@/components/ui/rainbow-button'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table2'
import { FileText } from 'lucide-react'
import { CheckIcon } from "@radix-ui/react-icons"
import CancelSubscriptionButton from '@/components/billing/CancelSubscriptionButton'

interface PaymentRecord {
  id: string
  date: string
  plan: string
  amount: string
  paymentMethod: string
  status: string
  created_at: string
}

// 플랜별 콘텐츠 정의 (현재 플랜에 따라 버튼 텍스트 동적 변경)
const getPlanContent = (currentPlan: string) => {
  return {
    free: {
      title: '플랜 업그레이드를 통해 콘텐츠 생산성을 크게 높여보세요!',
      features: [
        '릴처의 모든 기능 지원',
        '더욱 다양한 검색 결과',
        '최대 80배의 더 많은 사용량'
      ],
      buttonText: '지금 바로 시작하기'
    },
    starter: {
      title: '',
      features: [
        '월 2,000 크레딧',
        'FREE 플랜의 모든 기능',
        '최대 60개 검색 결과',
        '자막 추출 기능',
      ],
      buttonText: currentPlan === 'business' ? '모든 플랜 보기' : '업그레이드'
    },
    pro: {
      title: '',
      features: [
        '월 7,000 크레딧',
        'STARTER 플랜의 모든 기능',
        '최대 90개 검색 결과',
        '28배의 더 많은 사용량'
      ],
      buttonText: currentPlan === 'business' ? '모든 플랜 보기' : '업그레이드'
    },
    business: {
      title: '',
      features: [
        '월 20,000 크레딧',
        'PRO 플랜의 모든 기능',
        '최대 120개 검색 결과',
        '80배의 가장 많은 사용량',
        '최우선 지원'
      ],
      buttonText: '모든 플랜 보기' // ✅ 비즈니스 플랜에서는 항상 "모든 플랜 보기"
    }
  }
}

export default function BillingPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [credits, setCredits] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [paymentLoading, setPaymentLoading] = useState(true)
  const [hasMorePayments, setHasMorePayments] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: prof } = await supabase
          .from('profiles')
          .select('plan, created_at, subscription_start_date')
          .eq('user_id', user.id)
          .single()

        const { data: cr } = await supabase
          .from('credits')
          .select('balance, cycle_start_date, next_grant_date')
          .eq('user_id', user.id)
          .single()

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, plan, billing_key')
          .eq('user_id', user.id)
          .single()

        setUser(user)
        setProfile(prof)
        setCredits(cr)
        setSubscription(sub)
      } catch (error) {
        console.error('데이터 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // 결제 내역 조회 함수
  const fetchPaymentHistory = async (page: number = 1, reset: boolean = false) => {
    try {
      setPaymentLoading(true)
      const response = await fetch(`/api/me/payment-history?page=${page}&limit=5`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`💳 결제 내역 로드 완료: ${data.payments?.length || 0}개 항목`, data)

        if (reset) {
          setPaymentRecords(data.payments)
        } else {
          setPaymentRecords(prev => [...prev, ...data.payments])
        }
        setHasMorePayments(data.hasMore)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('결제 내역 조회 실패:', error)
    } finally {
      setPaymentLoading(false)
    }
  }

  // 컴포넌트 마운트 시 결제 내역 조회
  useEffect(() => {
    if (user) {
      fetchPaymentHistory(1, true)
    }
  }, [user])

  // 더 보기 버튼 클릭 핸들러
  const handleLoadMore = () => {
    if (!paymentLoading && hasMorePayments) {
      fetchPaymentHistory(currentPage + 1, false)
    }
  }

  if (loading) {
  return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  )
}

  const currentPlan = profile?.plan || 'free'
  const balance = Number(credits?.balance || 0)

  // 현재 플랜의 콘텐츠 가져오기 (동적 생성)
  const planContent = getPlanContent(currentPlan)
  const currentPlanContent = planContent[currentPlan as keyof typeof planContent] || planContent.free

  return (
    <div className="max-w-4xl mx-auto space-y-8 pt-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-700">구독 관리</h1>
        <p className="text-sm font-medium text-gray-600 mt-1">현재 플랜 및 결제 내역을 관리하세요</p>
      </div>

      {/* 현재 플랜 섹션 */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-6 text-center">
          <Badge variant="outline" className="mb-4 bg-white text-gray-700 border-gray-300">
            {currentPlan.toUpperCase()}
          </Badge>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">현재 플랜</h2>
          <p className="text-sm font-medium text-gray-600 mb-6">
            {currentPlan === 'free' ? '무료 플랜을 사용 중입니다' : `${currentPlan.toUpperCase()} 플랜을 사용 중입니다`}
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-center">
            {currentPlanContent.title && (
              <h3 className="text-sm font-medium text-gray-800 mb-4">
                {currentPlanContent.title}
              </h3>
            )}
            
            {/* 혜택 리스트와 버튼을 같은 너비로 정렬 */}
            <div className="flex flex-col items-center">
              <div className={`space-y-3 mb-6 ${currentPlan === 'free' ? 'w-48' : 'w-56'}`}>
                {currentPlanContent.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 text-left">
                    <CheckIcon className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <Link href="/pricing" className={currentPlan === 'free' ? 'w-48' : 'w-56'}>
                <RainbowButton className="text-sm font-medium w-full">
                  {currentPlanContent.buttonText}
                </RainbowButton>
              </Link>
            </div>
          </div>
          
          {/* 유료 플랜 사용자용 구독 취소 버튼 */}
          {currentPlan !== 'free' && subscription?.status === 'active' && (
            <div className="flex justify-end mt-4">
              <CancelSubscriptionButton 
                onCancelled={() => {
                  // 구독 취소 후 데이터 새로고침
                  window.location.reload();
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결제 내역 섹션 */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-700">결제 내역</CardTitle>
              <p className="text-sm font-medium text-gray-600">지난 결제 기록을 확인하세요</p>
            </div>
            <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
              최근 12개월
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
            {paymentRecords.length === 0 && !paymentLoading ? (
              <div className="text-center py-12">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-800 mb-2">결제 내역이 없습니다</h3>
                <p className="text-sm font-medium text-gray-600">
                  {currentPlan === 'free' ? 'FREE 플랜은 무료로 제공됩니다' : '아직 결제 내역이 없습니다'}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/5 text-sm font-medium text-gray-700">날짜</TableHead>
                      <TableHead className="w-1/5 text-sm font-medium text-gray-700">구독 플랜</TableHead>
                      <TableHead className="w-1/5 text-sm font-medium text-gray-700">금액</TableHead>
                      <TableHead className="w-1/5 text-sm font-medium text-gray-700">결제 수단</TableHead>
                      <TableHead className="w-1/5 text-sm font-medium text-gray-700">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="w-1/5 text-sm font-medium text-gray-800">{record.date}</TableCell>
                        <TableCell className="w-1/5 text-sm font-medium text-gray-600">{record.plan}</TableCell>
                        <TableCell className="w-1/5 text-sm font-semibold text-gray-800 tabular-nums">{record.amount}</TableCell>
                        <TableCell className="w-1/5 text-sm font-medium text-gray-600">{record.paymentMethod}</TableCell>
                        <TableCell className="w-1/5">
                          <Badge 
                            variant="outline" 
                            className={
                              record.status === '완료' 
                                ? 'text-green-700 border-green-200 bg-green-50' 
                                : 'text-gray-700 border-gray-200 bg-gray-50'
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* 로딩 상태 */}
                    {paymentLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span className="ml-2 text-sm text-gray-600">로딩 중...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {/* 더 보기 버튼 */}
                {hasMorePayments && !paymentLoading && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" onClick={handleLoadMore}>
                      더 보기
                    </Button>
                  </div>
                )}
              </>
            )}
        </CardContent>
      </Card>
    </div>
  )
}