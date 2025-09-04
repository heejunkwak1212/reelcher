'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function AdminDashboard() {
  const [chartPeriod, setChartPeriod] = useState<'monthly' | 'weekly'>('monthly')
  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('대시보드 데이터 로드 실패')
      return res.json()
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    )
  }

  const stats = dashboardData?.stats || {}
  const mrrData = dashboardData?.mrrData || []
  const weeklyMrrData = dashboardData?.weeklyMrrData || []

  // 성장률 계산 함수
  const calculateGrowthRate = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  // 현재 차트 데이터 선택
  const currentChartData = chartPeriod === 'monthly' ? (mrrData || []) : (weeklyMrrData || [])
  const currentDataKey = chartPeriod === 'monthly' ? 'month' : 'week'

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">관리자 대시보드</h1>
      </div>

      {/* 수익 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">월간 반복 수익 (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{(mrrData[mrrData.length - 1]?.mrr || 0).toLocaleString()}원</div>
            <div className="text-xs text-gray-500 mt-1">
              활성 구독: 1개
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">총 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.totalRevenue?.toLocaleString() || 0}원</div>
            <div className="text-xs text-gray-500 mt-1">
              누적 결제 금액
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">이번 달 순수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.currentMonthNetProfit?.toLocaleString() || 0}원</div>
            <div className="text-xs text-gray-500 mt-1">
              수익 {stats.currentMonthRevenue?.toLocaleString() || 0}원 - 원가 {stats.currentMonthApifyCost?.toLocaleString() || 0}원
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">사용자당 평균 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.averageRevenuePerUser?.toLocaleString() || 0}원</div>
            <div className="text-xs text-gray-500 mt-1">
              ARPU (원가 차감 후)
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 플랜별 사용자 현황 + 검색 통계 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 플랜별 사용자 현황 */}
        <div className="lg:col-span-2">
          <Card className="h-full min-h-[280px]"> {/* 카드 세로 길이 조정 - 필요시 280px 값 변경 */}
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">플랜별 사용자 현황</CardTitle>
            </CardHeader>
                         <CardContent className="flex flex-col justify-between p-6 h-full">
               <div className="mb-6">
                 {/* 플랜별 사용자 현황 카드들 */}
                 <div className="grid grid-cols-4 gap-3 mb-6">
                   {['FREE', 'STARTER', 'PRO', 'BUSINESS'].map((plan) => {
                     const count = stats.planCounts?.[plan.toLowerCase()] || 0;
                     return (
                       <div key={plan} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                         <div className="text-xs font-medium text-gray-600 mb-1">{plan}</div>
                         <div className="text-lg font-semibold text-gray-900">{count}명</div>
                       </div>
                     );
                   })}
                 </div>
               </div>
               
               {/* 구분선과 총 사용자 */}
               <div className="border-t pt-4 mt-auto">
                 <div className="flex items-center justify-between">
                   <span className="text-sm font-medium text-gray-600">총 사용자</span>
                   <span className="text-lg font-semibold text-gray-900">
                     {stats.totalUserCount?.toLocaleString() || 0}명
                   </span>
                 </div>
               </div>
             </CardContent>
          </Card>
        </div>

        {/* 검색 통계 */}
        <div className="flex flex-col gap-6">
                     <Card className="min-h-fit">
             <CardHeader className="pb-3">
               <CardTitle className="text-sm font-medium text-gray-600 pl-1">주간 검색</CardTitle>
             </CardHeader>
             <CardContent className="flex flex-col justify-start py-3 pl-8 pr-4">
               <div className="text-2xl font-semibold text-gray-900 text-left">{stats.weeklySearches?.toLocaleString() || 0}</div>
               <div className="text-xs text-gray-500 mt-1 text-left">
                 최근 7일간 (자막추출 제외)
               </div>
             </CardContent>
           </Card>

           <Card className="min-h-fit">
             <CardHeader className="pb-3">
               <CardTitle className="text-sm font-medium text-gray-600 pl-1">월간 검색</CardTitle>
             </CardHeader>
             <CardContent className="flex flex-col justify-start py-3 pl-8 pr-4">
               <div className="text-2xl font-semibold text-gray-900 text-left">{stats.monthlySearches?.toLocaleString() || 0}</div>
               <div className="text-xs text-gray-500 mt-1 text-left">
                 이번 달 1일~말일 (자막추출 제외)
               </div>
             </CardContent>
           </Card>
        </div>
      </div>

      {/* 수익 트렌드 차트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">
              {chartPeriod === 'monthly' ? '월별' : '주간'} 수익 트렌드
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={chartPeriod === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartPeriod('monthly')}
              >
                월간
              </Button>
              <Button
                variant={chartPeriod === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartPeriod('weekly')}
              >
                주간
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64 relative">
            {currentChartData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500 text-sm">
                  {chartPeriod === 'monthly' ? '월별' : '주간'} 수익 데이터가 없습니다.
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={currentChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey={currentDataKey} stroke="#6b7280" />
                  <YAxis
                    stroke="#6b7280"
                    domain={['dataMin - 1000', 'dataMax + 1000']}
                    tickFormatter={(value) => `${value.toLocaleString()}원`}
                  />
                  <Tooltip
                    formatter={(value, name, props: any) => {
                      const current = Number(value)
                      const currentIndex = currentChartData.findIndex((item: any) => item[currentDataKey] === props.label)
                      const previous = currentIndex > 0 ? Number(currentChartData[currentIndex - 1].mrr) : 0
                      const growthRate = calculateGrowthRate(current, previous)

                      return [
                        `${current.toLocaleString()}원`,
                        `수익 (${growthRate > 0 ? '+' : ''}${growthRate}% ${chartPeriod === 'monthly' ? '전월 대비' : '전주 대비'})`
                      ]
                    }}
                    labelStyle={{ color: '#374151' }}
                    contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/cancellations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">취소/탈퇴 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">구독 취소 및 회원탈퇴 현황 분석</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/searches">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">검색 기록 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">사용자별 검색 기록 및 수익성 분석</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/monitoring">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Apify 모니터링</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">실시간 리소스 사용량 및 비용 모니터링</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
