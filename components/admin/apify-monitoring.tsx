// components/admin/apify-monitoring.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Activity, Server, Clock, BarChart3, Users, Zap } from 'lucide-react';
import { ApifyUsageInfo, ApifyUsageStats, ApifyRunInfo } from '@/lib/apify-monitor';
import ApifyMonitor from '@/lib/apify-monitor';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function ApifyMonitoring() {
  const [usageInfo, setUsageInfo] = useState<ApifyUsageInfo | null>(null);
  const [stats, setStats] = useState<ApifyUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 일별 상세보기
  const [selectedDayDetail, setSelectedDayDetail] = useState<string | null>(null);
  const [dayDetailData, setDayDetailData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [apifyMonitor, setApifyMonitor] = useState<ApifyMonitor | null>(null);

  // 일별 상세 데이터 가져오기
  const fetchDayDetail = async (date: string) => {
    try {
      console.log(`📊 ${date} 상세 데이터 조회 중...`)
      const res = await fetch(`/api/admin/apify/day-detail?date=${date}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('일별 상세 데이터 로드 실패')
      const data = await res.json()
      setDayDetailData(data.details || [])
    } catch (error) {
      console.error('일별 상세 데이터 조회 오류:', error)
      setDayDetailData([])
    }
  }

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      const [usageResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/apify/usage'),
        fetch('/api/admin/apify/stats?days=7'),
      ]);

      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        setUsageInfo(usageData);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      setLastUpdated(new Date());

      // ApifyMonitor 인스턴스 생성 (클라이언트 사이드에서는 토큰 없이)
      if (!apifyMonitor) {
        setApifyMonitor(new ApifyMonitor(''));
      }
    } catch (error) {
      console.error('Failed to fetch Apify data:', error);
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  }, [apifyMonitor]);

  // RAM 사용률 경고
  const getRAMWarning = () => {
    if (!usageInfo || !usageInfo.accountInfo?.limits) return null;
    const currentRam = usageInfo.currentMemoryUsage || 0;
    const maxRam = usageInfo.accountInfo.limits.maxCombinedActorMemoryMbytes || 1;
    const usage = (currentRam / maxRam) * 100;
    
    if (usage > 90) {
      return "🔴 위험: RAM 사용률이 90%를 초과했습니다. 새로운 액터 실행이 차단될 수 있습니다.";
    } else if (usage > 75) {
      return "🟡 경고: RAM 사용률이 75%를 초과했습니다. 주의가 필요합니다.";
    }
    return null;
  };

  useEffect(() => {
    fetchData();
    // 자동 새로고침 제거됨 - 수동 새로고침만 가능
  }, [fetchData]);

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-amber-600';
    return 'text-green-600';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'default';
      case 'SUCCEEDED': return 'secondary';
      case 'FAILED': return 'destructive';
      case 'TIMED-OUT': return 'outline';
      default: return 'outline';
    }
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${mb}MB`;
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!usageInfo) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Apify 데이터를 불러올 수 없습니다.</p>
        <Button onClick={() => fetchData(true)} className="mt-4">
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Apify 리소스 모니터링</h2>
          <p className="text-gray-600">실시간 액터 실행 상태 및 리소스 사용량 (수동 새로고침)</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <p className="text-sm text-gray-500">
              마지막 업데이트: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <Button 
            onClick={() => fetchData(true)} 
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* RAM 경고 표시 */}
      {getRAMWarning() && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="text-yellow-800 font-medium">
            {getRAMWarning()}
          </div>
        </div>
      )}

      {/* 주요 지표 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">메모리 사용률</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">
              <span className={getUsageColor(usageInfo.usagePercentage || 0)}>
                {(usageInfo.usagePercentage || 0).toFixed(1)}%
              </span>
            </div>
            <Progress value={usageInfo.usagePercentage || 0} className="mb-2" />
            <p className="text-xs text-muted-foreground">
              {formatMemory(usageInfo.currentMemoryUsage)} / {formatMemory(usageInfo.maxMemoryAllowed)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">실행 중인 액터</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageInfo.runningActorsCount}</div>
            <p className="text-xs text-muted-foreground">
              최대 {usageInfo.accountInfo.limits?.maxConcurrentActorRuns || 'N/A'}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">계정 플랜</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
                      <CardContent>
              <div className="text-2xl font-bold">{usageInfo.accountInfo.plan?.toString()?.toUpperCase() || 'FREE'}</div>
              <p className="text-xs text-muted-foreground">
                {usageInfo.accountInfo.username}
              </p>
              <div className="mt-2">
                <div className="text-sm text-gray-600">
                  RAM 사용률: {usageInfo.accountInfo?.limits ? 
                    ((usageInfo.currentMemoryUsage / usageInfo.accountInfo.limits.maxCombinedActorMemoryMbytes) * 100).toFixed(1) : '0'}%
                </div>
                <Progress 
                  value={usageInfo.accountInfo?.limits ? 
                    (usageInfo.currentMemoryUsage / usageInfo.accountInfo.limits.maxCombinedActorMemoryMbytes) * 100 : 0} 
                  className="h-2 mt-1"
                />
                <div className="text-xs text-gray-500 mt-1">
                  {usageInfo.currentMemoryUsage || 0}MB / {usageInfo.accountInfo?.limits?.maxCombinedActorMemoryMbytes || 0}MB
                </div>
              </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">계정 상태</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">정상</div>
            <p className="text-xs text-muted-foreground">
              {usageInfo.accountInfo.email}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 탭 컨텐츠 */}
      <Tabs defaultValue="running" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="running">실행 중인 액터</TabsTrigger>
          <TabsTrigger value="daily">일별 통계</TabsTrigger>
          <TabsTrigger value="hourly">시간별 통계</TabsTrigger>
        </TabsList>

        <TabsContent value="running" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                실행 중인 액터 ({usageInfo.runningActorsCount}개)
              </CardTitle>
              <CardDescription>
                현재 실행 중인 모든 액터의 상태와 리소스 사용량
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageInfo.runningActors.length === 0 ? (
                <p className="text-center py-8 text-gray-500">실행 중인 액터가 없습니다.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>액터 ID</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>메모리</TableHead>
                      <TableHead>실행 시간</TableHead>
                      <TableHead>CPU 사용률</TableHead>
                      <TableHead>컴퓨트 유닛</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageInfo.runningActors.map((actor) => (
                      <TableRow key={actor.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">
                              {apifyMonitor?.getActorDisplayName(actor.actId) || actor.actId}
                            </div>
                            <div className="font-mono text-xs text-gray-500">{actor.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(actor.status)}>
                            {actor.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatMemory(actor.options?.memoryMbytes || 0)}
                        </TableCell>
                        <TableCell>
                          {formatDuration(actor.stats?.durationMillis || 0)}
                        </TableCell>
                        <TableCell>
                          {actor.stats?.cpuCurrentUsage ? 
                            `${(actor.stats.cpuCurrentUsage * 100).toFixed(1)}%` : 
                            'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {actor.stats?.computeUnits?.toFixed(2) || '0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                일별 사용량 통계 (최근 7일)
              </CardTitle>
              <CardDescription>
                컴퓨트 유닛, 메모리 사용량, 액터 실행 횟수
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.daily && stats.daily.length > 0 ? (
                <div className="space-y-6">
                  {/* 액터 사용내역 차트 (최근 7일) */}
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.daily.slice(-7)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value, name) => [
                            `${value}회`,
                            name === 'actorRuns' ? '액터 실행' : name
                          ]}
                        />
                        <Bar 
                          dataKey="actorRuns" 
                          fill="#8884d8" 
                          name="액터 실행 횟수"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>날짜</TableHead>
                        <TableHead>컴퓨트 유닛</TableHead>
                        <TableHead>메모리 사용량</TableHead>
                        <TableHead>액터 실행 횟수</TableHead>
                        <TableHead>상세보기</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.daily.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">{day.date}</TableCell>
                          <TableCell>{day.computeUnits.toFixed(2)}</TableCell>
                          <TableCell>{formatMemory(day.memoryUsage)}</TableCell>
                          <TableCell>{day.actorRuns}</TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (selectedDayDetail === day.date) {
                                  setSelectedDayDetail(null)
                                } else {
                                  setSelectedDayDetail(day.date)
                                  fetchDayDetail(day.date)
                                }
                              }}
                            >
                              {selectedDayDetail === day.date ? '접기' : '상세보기'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* 선택된 날짜의 상세 정보 */}
                  {selectedDayDetail && (
                    <Card className="mt-6">
                      <CardHeader>
                        <CardTitle>{selectedDayDetail} 상세 사용 내역</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {dayDetailData.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>시간</TableHead>
                                <TableHead>사용자</TableHead>
                                <TableHead>액터명</TableHead>
                                <TableHead>실행 비용</TableHead>
                                <TableHead>상태</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dayDetailData.map((detail, index) => (
                                <TableRow key={index}>
                                  <TableCell>{detail.time}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{detail.userEmail}</TableCell>
                                  <TableCell>{detail.actorName}</TableCell>
                                  <TableCell className="text-red-600 font-mono">
                                    ${detail.cost.toFixed(4)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={detail.status === 'SUCCEEDED' ? 'default' : 'destructive'}>
                                      {detail.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-center py-8 text-gray-500">해당 날짜의 상세 데이터가 없습니다.</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">일별 통계 데이터가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                시간별 사용량 통계 (최근 24시간)
              </CardTitle>
              <CardDescription>
                시간대별 상세 사용량 패턴 분석
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.hourly && stats.hourly.length > 0 ? (
                <div className="space-y-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.hourly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="hour" 
                          tickFormatter={(value) => new Date(value).getHours() + ':00'}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleString()}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="computeUnits" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          name="컴퓨트 유닛"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>시간</TableHead>
                        <TableHead>컴퓨트 유닛</TableHead>
                        <TableHead>메모리 사용량</TableHead>
                        <TableHead>액터 실행 횟수</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.hourly.slice(-12).map((hour) => (
                        <TableRow key={hour.hour}>
                          <TableCell>
                            {new Date(hour.hour).toLocaleTimeString('ko-KR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </TableCell>
                          <TableCell>{hour.computeUnits.toFixed(2)}</TableCell>
                          <TableCell>{formatMemory(hour.memoryUsage)}</TableCell>
                          <TableCell>{hour.actorRuns}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">시간별 통계 데이터가 없습니다.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
