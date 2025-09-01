"use client"
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface SearchRecord {
  id: string
  created_at: string
  user_id: string
  user_email: string
  user_plan: string
  platform: string
  search_type?: string
  keyword?: string
  requested_count?: number
  results_count?: number
  credits_used?: number
  status: string
  subscription_start_date?: string
  last_payment_date?: string
}

export default function AdminSearches() {
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: queryData, isLoading, refetch } = useQuery({
    queryKey: ['admin-searches', page, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '100' })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/admin/searches?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('load failed')
      return res.json() as Promise<{ items: SearchRecord[]; total: number }>
    },
  })

  const records = queryData?.items || []

  // 정확한 플랫폼별 원가 계산 함수 (취소된 검색 대응)
  const calculateApifyCost = (record: SearchRecord): number => {
    // 취소된/pending 검색의 경우 요청수 또는 크레딧 기반 추정
    let effectiveCount = record.results_count || 0
    
    if ((record.status === 'cancelled' || record.status === 'pending') && record.credits_used) {
      if (record.requested_count) {
        effectiveCount = record.requested_count
      } else {
        // credits_used를 기반으로 요청수 추정
        const creditsUsed = record.credits_used
        if (creditsUsed <= 120) effectiveCount = 30      // 100크레딧 기준
        else if (creditsUsed <= 240) effectiveCount = 60  // 200크레딧 기준
        else if (creditsUsed <= 360) effectiveCount = 90  // 300크레딧 기준  
        else effectiveCount = 120                         // 400크레딧 기준
      }
    }
    const platform = record.platform
    const searchType = record.search_type
    
    // PRD 문서 기준 플랫폼별 Apify 액터 비용 (1,000건당 USD)
    const costs = {
      instagram: {
        hashtag: 2.30,    // Instagram Hashtag Scraper (upscale_jiminy/instagram-hashtag-scraper-task)
        details: 2.70,    // Instagram Scraper (upscale_jiminy/instagram-scraper-task)  
        profile: 2.30,    // Instagram Profile Scraper (upscale_jiminy/instagram-profile-scraper-task)
        subtitle: 3.80,   // Subtitle Extractor for Instagram (CVQmx5Se22zxPaWc1)
      },
      tiktok: {
        scraper: 0,       // TikTok Scraper (clockworks/free-tiktok-scraper) - FREE
        subtitle: 3.80,   // Subtitle Extractor 
      },
      youtube: {
        api: 0,           // YouTube Data v3 API (구글 자체 제공) - 무료
        subtitle: 3.80,   // Subtitle Extractor 
      }
    }

    // 자막 추출 비용 계산
    if (searchType === 'subtitle_extraction') {
      if (platform === 'youtube') {
        return 0  // YouTube는 yt-dlp 사용으로 무료
      } else if (platform === 'instagram' || platform === 'tiktok') {
        return 0.038  // 인스타/틱톡 자막 추출: 1개당 $0.038
      }
      return 0
    }

    // 일반 검색 비용 계산
    if (platform === 'instagram') {
      // Instagram 검색 타입별 비용
      if (searchType === 'profile' || record.keyword?.startsWith('@')) {
        return effectiveCount * 0.0026  // 프로필 검색: 1개 결과당 $0.0026
      } else {
        // 키워드 검색
        return effectiveCount * 0.0076  // 키워드 검색: 1개 결과당 $0.0076
      }
    } else if (platform === 'tiktok') {
      // TikTok: 키워드/프로필 검색 모두 동일 비용
      return effectiveCount * 0.005  // 1개 결과당 $0.005
    } else if (platform === 'youtube') {
      // YouTube: Google API 무료
      return 0
    }

    return 0
  }

  // 실제 결제 기반 수익 계산 (유료 플랜 + 실제 결제 완료된 경우만)
  const calculateRevenue = (record: SearchRecord): number => {
    const plan = record.user_plan
    const hasValidPayment = record.last_payment_date && new Date(record.last_payment_date) > new Date('2024-01-01')
    
    // 실제 결제가 없는 경우 수익 없음
    if (!hasValidPayment || plan === 'free') {
      return 0
    }
    
    // 유료 플랜이지만 실제 결제 확인이 되지 않은 경우도 수익 없음
    // TODO: 실제 토스 결제 연동 완료 후 payment 테이블 확인 로직 추가
    // 현재는 last_payment_date가 있는 경우만 실제 결제로 간주
    
    const creditsUsed = record.credits_used || 0
    
    // 플랜별 크레딧 가격 (실제 결제된 경우만 적용)
    const creditPrices = {
      starter: 1.0,   // ₩2,000 / 2,000 크레딧 = ₩1/크레딧
      pro: 1.0,       // ₩7,000 / 7,000 크레딧 = ₩1/크레딧  
      business: 0.83, // ₩12,500 / 15,000 크레딧 = ₩0.83/크레딧
    }

    const pricePerCredit = creditPrices[plan as keyof typeof creditPrices] || 0
    return creditsUsed * pricePerCredit
  }

  // 플랜별 총 크레딧 계산
  const getPlanTotalCredits = (plan: string): number => {
    const planCredits = {
      free: 0,
      starter: 2000,
      pro: 7000,
      business: 20000,
    }
    return planCredits[plan as keyof typeof planCredits] || 0
  }

  // 현재 결제 주기 기준 필터링
  const getCurrentCycleRecords = (records: SearchRecord[], userId: string) => {
    const userRecords = records.filter(r => r.user_id === userId)
    if (userRecords.length === 0) return []
    
    const lastPaymentDate = userRecords[0].last_payment_date
    if (!lastPaymentDate) return userRecords // 무료 사용자는 모든 기록
    
    const cycleStart = new Date(lastPaymentDate)
    const cycleEnd = new Date(cycleStart)
    cycleEnd.setDate(cycleEnd.getDate() + 30) // 30일 주기
    
    return userRecords.filter(record => {
      const recordDate = new Date(record.created_at)
      return recordDate >= cycleStart && recordDate <= cycleEnd
    })
  }

  // 사용자별 통계 계산
  const userStats = useMemo(() => {
    const stats = new Map<string, {
      email: string
      plan: string
      searchCount: number
      subtitleCount: number
      totalCredits: number
      usedCreditsInCycle: number
      totalCreditsInPlan: number
      totalApifyCost: number
      totalRevenue: number
      netProfit: number
      subscriptionStart?: string
      lastPayment?: string
    }>()

    records.forEach(record => {
      const userId = record.user_id
      if (!stats.has(userId)) {
        stats.set(userId, {
          email: record.user_email,
          plan: record.user_plan,
          searchCount: 0,
          subtitleCount: 0,
          totalCredits: 0,
          usedCreditsInCycle: 0,
          totalCreditsInPlan: getPlanTotalCredits(record.user_plan),
          totalApifyCost: 0,
          totalRevenue: 0,
          netProfit: 0,
          subscriptionStart: record.subscription_start_date,
          lastPayment: record.last_payment_date,
        })
      }

      const userStat = stats.get(userId)!
      const apifyCostUSD = calculateApifyCost(record)
      const apifyCostKRW = apifyCostUSD * 1340 // USD to KRW
      const revenue = calculateRevenue(record)

      if (record.search_type === 'subtitle_extraction') {
        userStat.subtitleCount++
      } else {
        userStat.searchCount++
      }

      userStat.totalCredits += (record.credits_used || 0)
      userStat.totalApifyCost += apifyCostKRW
      userStat.totalRevenue += revenue
      userStat.netProfit = userStat.totalRevenue - userStat.totalApifyCost
    })

    // 현재 결제 주기 크레딧 사용량 계산
    stats.forEach((user, userId) => {
      const cycleRecords = getCurrentCycleRecords(records, userId)
      user.usedCreditsInCycle = cycleRecords.reduce((sum, record) => sum + (record.credits_used || 0), 0)
    })

    return Array.from(stats.values()).sort((a, b) => b.netProfit - a.netProfit)
  }, [records])

  // 전체 통계
  const totalStats = useMemo(() => {
    const total = userStats.reduce((acc, user) => ({
      totalApifyCost: acc.totalApifyCost + user.totalApifyCost,
      totalRevenue: acc.totalRevenue + user.totalRevenue,
      totalNetProfit: acc.totalNetProfit + user.netProfit,
      userCount: acc.userCount + 1,
    }), { totalApifyCost: 0, totalRevenue: 0, totalNetProfit: 0, userCount: 0 })

    return {
      ...total,
      avgNetProfit: total.userCount > 0 ? total.totalNetProfit / total.userCount : 0
    }
  }, [userStats])

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'yyyy-MM-dd HH:mm')
  }

  const formatKRW = (amount: number) => {
    return `${Math.round(amount).toLocaleString()}원`
  }

  const getPlatformBadge = (platform: string) => {
    const colors = {
      youtube: 'bg-red-100 text-red-800',
      instagram: 'bg-pink-100 text-pink-800', 
      tiktok: 'bg-black text-white'
    }
    return <Badge className={colors[platform as keyof typeof colors] || 'bg-gray-100'}>{platform.toUpperCase()}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      failed: 'bg-red-100 text-red-800'
    }
    const labels = {
      completed: '완료',
      pending: '진행중',
      cancelled: '취소',
      failed: '실패'
    }
    return <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100'}>
      {labels[status as keyof typeof labels] || status}
    </Badge>
  }

  const getPlanBadge = (plan: string) => {
    const colors = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      business: 'bg-orange-100 text-orange-800'
    }
    return <Badge className={colors[plan as keyof typeof colors] || 'bg-gray-100'}>{plan.toUpperCase()}</Badge>
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">검색 기록 관리</h1>
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={from} 
            onChange={e => setFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <span>~</span>
          <input 
            type="date" 
            value={to} 
            onChange={e => setTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <Button onClick={() => refetch()}>조회</Button>
        </div>
      </div>

      {/* 전체 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">총 원가</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatKRW(totalStats.totalApifyCost)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">총 수익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatKRW(totalStats.totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">총 순이익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalStats.totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatKRW(totalStats.totalNetProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">평균 순이익</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalStats.avgNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatKRW(totalStats.avgNetProfit)}
      </div>
          </CardContent>
        </Card>
      </div>

      {/* 사용자별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>사용자별 수익성 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>플랜</TableHead>
                <TableHead>검색</TableHead>
                <TableHead>자막</TableHead>
                <TableHead>크레딧</TableHead>
                <TableHead>원가</TableHead>
                <TableHead>수익</TableHead>
                <TableHead>순이익</TableHead>
                <TableHead>구독시작</TableHead>
                <TableHead>최근결제</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userStats.map((user, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{getPlanBadge(user.plan)}</TableCell>
                  <TableCell>{user.searchCount}회</TableCell>
                  <TableCell>{user.subtitleCount}회</TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {user.usedCreditsInCycle.toLocaleString()}
                      <span className="text-gray-500">/{user.totalCreditsInPlan.toLocaleString()}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-red-600">{formatKRW(user.totalApifyCost)}</TableCell>
                  <TableCell className="text-blue-600">{formatKRW(user.totalRevenue)}</TableCell>
                  <TableCell className={user.netProfit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {formatKRW(user.netProfit)}
                  </TableCell>
                  <TableCell>{user.subscriptionStart ? formatDateTime(user.subscriptionStart) : '-'}</TableCell>
                  <TableCell>{user.lastPayment ? formatDateTime(user.lastPayment) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 상세 검색 기록 */}
      <Card>
        <CardHeader>
          <CardTitle>상세 검색 기록</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>검색일시</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>플랫폼</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>키워드</TableHead>
                <TableHead>요청수</TableHead>
                <TableHead>결과수</TableHead>
                <TableHead>크레딧</TableHead>
                <TableHead>원가</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{formatDateTime(record.created_at)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{record.user_email}</TableCell>
                  <TableCell>{getPlatformBadge(record.platform)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {record.search_type === 'subtitle_extraction' ? '자막' : '검색'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">{record.keyword || '-'}</TableCell>
                  <TableCell>{record.requested_count || '-'}</TableCell>
                  <TableCell>{record.results_count || '-'}</TableCell>
                  <TableCell>{record.credits_used || '-'}</TableCell>
                  <TableCell className="text-red-600 font-mono text-sm">
                    {formatKRW(calculateApifyCost(record) * 1340)}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-2">
        <Button 
          variant="outline" 
          onClick={() => setPage(p => Math.max(1, p - 1))} 
          disabled={page <= 1}
        >
          이전
        </Button>
        <span className="px-4 py-2 text-sm">페이지 {page}</span>
        <Button 
          variant="outline" 
          onClick={() => setPage(p => p + 1)} 
          disabled={records.length < 100}
        >
          다음
        </Button>
      </div>
    </div>
  )
}


