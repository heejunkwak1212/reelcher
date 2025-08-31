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

interface PaymentRecord {
  id: string
  date: string
  plan: string
  amount: string
  paymentMethod: string
  status: string
}

// 더미 결제 내역 데이터
const paymentRecords: PaymentRecord[] = [
  {
    id: '1',
    date: '2024년 1월 15일',
    plan: 'STARTER',
    amount: '₩9,900',
    paymentMethod: '신용카드 (****1234)',
    status: '완료'
  },
  {
    id: '2', 
    date: '2023년 12월 15일',
    plan: 'STARTER',
    amount: '₩9,900', 
    paymentMethod: '신용카드 (****1234)',
    status: '완료'
  },
  {
    id: '3',
    date: '2023년 11월 15일',
    plan: 'FREE',
    amount: '₩0',
    paymentMethod: '-',
    status: '완료'
  }
]

// 플랜별 콘텐츠 정의
const planContent = {
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
      '인스타그램 다중 키워드 검색'
    ],
    buttonText: '모든 플랜 보기'
  },
  pro: {
    title: '',
    features: [
      '월 7,000 크레딧',
      'STARTER 플랜의 모든 기능',
      '최대 90개 검색 결과',
      '28배의 더 많은 사용량'
    ],
    buttonText: '모든 플랜 보기'
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
    buttonText: '모든 플랜 보기'
  }
}

export default function BillingPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [credits, setCredits] = useState<any>(null)
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

        setUser(user)
        setProfile(prof)
        setCredits(cr)
      } catch (error) {
        console.error('데이터 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

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

  // 최근 12개월 결제 내역 필터링
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  
  const filteredPaymentRecords = paymentRecords.filter(record => {
    try {
      const recordDate = new Date(record.date.replace('년', '/').replace('월', '/').replace('일', ''))
      return recordDate >= twelveMonthsAgo
    } catch {
      return true // 날짜 파싱 실패 시 포함
    }
  })

  // 현재 플랜의 콘텐츠 가져오기
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
          {currentPlan !== 'free' && (
            <div className="flex justify-end mt-4">
              <Button 
                variant="outline" 
                size="sm"
                className="text-sm text-gray-600 border-gray-300 hover:bg-gray-50"
              >
                구독 취소
              </Button>
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
            {currentPlan === 'free' && filteredPaymentRecords.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-800 mb-2">결제 내역이 없습니다</h3>
                <p className="text-sm font-medium text-gray-600">FREE 플랜은 무료로 제공됩니다</p>
              </div>
            ) : (
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
                {filteredPaymentRecords.map((record) => (
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
              </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  )
}