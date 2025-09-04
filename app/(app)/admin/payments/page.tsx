"use client"

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function AdminPayments() {
  const [page, setPage] = useState(1)
  const pageSize = 50

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payments', page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/payments?page=${page}&pageSize=${pageSize}`)
      if (!res.ok) throw new Error('결제 데이터 로드 실패')
      return res.json()
    },
    staleTime: 30 * 1000 // 30초간 fresh
  })

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss')
  }

  const formatKRW = (amount: number) => {
    return `${Math.abs(amount).toLocaleString()}원`
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      DONE: 'bg-green-100 text-green-800 border-green-200',
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      FAILED: 'bg-red-100 text-red-800 border-red-200',
      REFUNDED: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    const labels = {
      DONE: '완료',
      PENDING: '진행중',
      FAILED: '실패',
      REFUNDED: '환불'
    }
    return (
      <Badge variant="outline" className={colors[status as keyof typeof colors] || 'bg-gray-100'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    )
  }

  const getPaymentMethodBadge = (method: string) => {
    if (!method) return <Badge variant="outline" className="bg-gray-100">-</Badge>
    
    const colors = {
      CARD: 'bg-blue-100 text-blue-800 border-blue-200',
      PLAN_CHANGE: 'bg-purple-100 text-purple-800 border-purple-200',
    }
    
    const labels = {
      CARD: '카드',
      PLAN_CHANGE: '플랜변경',
    }
    
    return (
      <Badge variant="outline" className={colors[method as keyof typeof colors] || 'bg-gray-100'}>
        {labels[method as keyof typeof labels] || method}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">데이터 로딩 중...</div>
        </div>
      </div>
    )
  }

  if (error) {
  return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">데이터 로드 실패: {error.message}</div>
        </div>
    </div>
  )
}

  const { payments = [], refunds = [], stats = {}, pagination = {} } = data || {}

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">결제 관리</h1>
        <div className="text-sm text-gray-500">
          전체 {pagination.total || 0}건 중 {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, pagination.total || 0)}건 표시
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 결제</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-900">{formatKRW(stats.totalPayments || 0)}</div>
            <div className="text-xs text-gray-500 mt-1">{stats.paymentCount || 0}건</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">총 환불</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-red-600">{formatKRW(stats.totalRefunds || 0)}</div>
            <div className="text-xs text-gray-500 mt-1">{stats.refundCount || 0}건</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">순 수익</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-bold ${(stats.netRevenue || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatKRW(stats.netRevenue || 0)}
            </div>
            <div className="text-xs text-gray-500 mt-1">실제 수익</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">성공률</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-green-600">{stats.successRate || 0}%</div>
            <div className="text-xs text-gray-500 mt-1">결제 성공률</div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">환불률</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-gray-600">
              {stats.paymentCount ? ((stats.refundCount / stats.paymentCount) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-1">환불률</div>
          </CardContent>
        </Card>
      </div>

      {/* 결제/환불 내역 탭 */}
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="payments">결제 내역 ({stats.paymentCount || 0})</TabsTrigger>
          <TabsTrigger value="refunds">환불 내역 ({stats.refundCount || 0})</TabsTrigger>
        </TabsList>
        
        {/* 결제 내역 */}
        <TabsContent value="payments">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">결제 내역</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold text-gray-700">결제일시</TableHead>
                      <TableHead className="font-semibold text-gray-700">사용자</TableHead>
                      <TableHead className="font-semibold text-gray-700">플랜</TableHead>
                      <TableHead className="font-semibold text-gray-700">금액</TableHead>
                      <TableHead className="font-semibold text-gray-700">결제수단</TableHead>
                      <TableHead className="font-semibold text-gray-700">상태</TableHead>
                      <TableHead className="font-semibold text-gray-700">결제키</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment: any) => (
                      <TableRow key={payment.id} className="border-gray-200 hover:bg-gray-50">
                        <TableCell className="font-mono text-sm">
                          {formatDateTime(payment.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{payment.user_email}</span>
                            <span className="text-xs text-gray-500">{payment.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {payment.user_plan?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          +{formatKRW(payment.amount)}
                        </TableCell>
                        <TableCell>{getPaymentMethodBadge(payment.payment_method)}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="font-mono text-xs text-gray-600 max-w-[200px] truncate">
                          {payment.payment_key || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 페이지네이션 */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page <= 1}
                  className="border-gray-300"
                >
                  이전
                </Button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  {page} / {pagination.totalPages || 1}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.totalPages || 1, p + 1))} 
                  disabled={page >= (pagination.totalPages || 1)}
                  className="border-gray-300"
                >
                  다음
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 환불 내역 */}
        <TabsContent value="refunds">
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">환불 내역</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-gray-200">
                      <TableHead className="font-semibold text-gray-700">환불일시</TableHead>
                      <TableHead className="font-semibold text-gray-700">사용자</TableHead>
                      <TableHead className="font-semibold text-gray-700">취소 플랜</TableHead>
                      <TableHead className="font-semibold text-gray-700">환불금액</TableHead>
                      <TableHead className="font-semibold text-gray-700">취소일</TableHead>
                      <TableHead className="font-semibold text-gray-700">사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {refunds.map((refund: any) => (
                      <TableRow key={refund.id} className="border-gray-200 hover:bg-gray-50">
                        <TableCell className="font-mono text-sm">
                          {formatDateTime(refund.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{refund.user_email}</span>
                            <span className="text-xs text-gray-500">{refund.user_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            {refund.plan_at_cancellation?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-red-600">
                          -{formatKRW(refund.refund_amount)}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-gray-600">
                          {refund.cancellation_date ? formatDateTime(refund.cancellation_date) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-gray-600" title={refund.reason}>
                          {refund.reason || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}