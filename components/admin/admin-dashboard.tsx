'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdminDashboard() {
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

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">관리자 대시보드</h1>
      </div>

      {/* 시스템 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">총 사용자</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.userCount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">총 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.searchCount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">주간 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.weeklySearches?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">월간 검색</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{stats.monthlySearches?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 플랜별 사용자 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">플랜별 사용자 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.planCounts || {}).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-2">
                <Badge variant="outline" className="text-gray-700">
                  {plan.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-600">{count}명</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* MRR 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">월간 반복 수익 (MRR)</CardTitle>
        </CardHeader>
        <CardContent>
          {mrrData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    formatter={(value) => [`${Number(value).toLocaleString()}원`, 'MRR']}
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
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">MRR 데이터가 없습니다.</div>
          )}
        </CardContent>
      </Card>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">시스템 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">정상 운영 중</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
