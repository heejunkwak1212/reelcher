'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';

interface CancellationLog {
  id: string;
  user_id: string;
  action_type: 'subscription_cancel' | 'account_delete';
  reason: string;
  plan_at_cancellation: string;
  credits_at_cancellation: number;
  refund_eligible: boolean;
  refund_amount: number;
  refund_processed: boolean;
  signup_date: string;
  cancellation_date: string;
  user_display_name: string;
  user_phone_number: string;
  user_email: string;
  created_at: string;
}

interface CancellationStats {
  total_cancellations: number;
  subscription_cancels: number;
  account_deletes: number;
  refunds_processed: number;
  total_refund_amount: number;
  today_cancellations: number;
  this_week_cancellations: number;
  this_month_cancellations: number;
  common_reasons: Array<{ reason: string; count: number }>;
}

export default function CancellationsPage() {
  const [logs, setLogs] = useState<CancellationLog[]>([]);
  const [stats, setStats] = useState<CancellationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, activeTab]);

  const fetchLogs = async () => {
    try {
      const filterParam = activeTab !== 'all' ? `&action_type=${activeTab}` : '';
      const response = await fetch(`/api/admin/cancellation-logs?page=${page}&limit=${pageSize}${filterParam}`);
      
      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setLogs(data.logs);
        } else {
          setLogs(prev => [...prev, ...data.logs]);
        }
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('취소 로그 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/cancellation-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('취소 통계 조회 실패:', error);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(1);
    setLogs([]);
    setIsLoading(true);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const getActionTypeBadge = (actionType: string) => {
    switch (actionType) {
      case 'subscription_cancel':
        return <Badge variant="destructive">구독 취소</Badge>;
      case 'account_delete':
        return <Badge variant="secondary">회원 탈퇴</Badge>;
      default:
        return <Badge variant="outline">{actionType}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    const planColors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      business: 'bg-yellow-100 text-yellow-800',
    };
    
    return (
      <Badge className={planColors[plan] || 'bg-gray-100 text-gray-800'}>
        {plan.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">취소 및 탈퇴 관리</h1>
        <p className="text-gray-600 mt-2">구독 취소 및 회원탈퇴 현황을 확인할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">총 취소/탈퇴</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(stats.total_cancellations)}</div>
              <div className="text-xs text-gray-500 mt-1">
                구독취소: {stats.subscription_cancels} | 회원탈퇴: {stats.account_deletes}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">환불 처리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(stats.refunds_processed)}</div>
              <div className="text-xs text-gray-500 mt-1">
                총 환불액: {formatAmount(stats.total_refund_amount)}원
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">오늘</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(stats.today_cancellations)}</div>
              <div className="text-xs text-gray-500 mt-1">
                이번주: {stats.this_week_cancellations} | 이번달: {stats.this_month_cancellations}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">주요 취소 사유</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {stats.common_reasons.slice(0, 3).map((reason, index) => (
                  <div key={index} className="text-xs">
                    <span className="font-medium">{reason.count}건</span>
                    <span className="text-gray-500 ml-1">{reason.reason}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 취소/탈퇴 로그 */}
      <Card>
        <CardHeader>
          <CardTitle>취소 및 탈퇴 내역</CardTitle>
          <CardDescription>
            사용자들의 구독 취소 및 회원탈퇴 상세 내역을 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="subscription_cancel">구독 취소</TabsTrigger>
              <TabsTrigger value="account_delete">회원 탈퇴</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>사용자</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>플랜</TableHead>
                      <TableHead>크레딧</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>환불</TableHead>
                      <TableHead>가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          {isLoading ? '로딩 중...' : '데이터가 없습니다.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {formatDate(log.cancellation_date)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{log.user_display_name || '이름 없음'}</div>
                              <div className="text-xs text-gray-500">{log.user_email}</div>
                              <div className="text-xs text-gray-500">{log.user_phone_number}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getActionTypeBadge(log.action_type)}
                          </TableCell>
                          <TableCell>
                            {getPlanBadge(log.plan_at_cancellation)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatAmount(log.credits_at_cancellation)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={log.reason}>
                              {log.reason}
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.refund_eligible ? (
                              <div className="space-y-1">
                                <Badge variant={log.refund_processed ? "default" : "destructive"}>
                                  {log.refund_processed ? "완료" : "실패"}
                                </Badge>
                                {log.refund_amount > 0 && (
                                  <div className="text-xs text-gray-500">
                                    {formatAmount(log.refund_amount)}원
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline">해당없음</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {formatDate(log.signup_date)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {hasMore && !isLoading && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={loadMore}>
                    더 보기
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
