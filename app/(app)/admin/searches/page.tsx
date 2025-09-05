"use client"
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

interface UserDetailData {
  userId: string
  email: string
  plan: string
  totalSearches: number
  totalSubtitles: number
  monthlyStats?: any[]
  billingCycles?: any[]
  platformRecords?: Record<string, any[]>
  userProfile?: any
  subscription?: any
}

export default function AdminSearches() {
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  
  // 사용자별 분석 페이지네이션
  const [userAnalysisPage, setUserAnalysisPage] = useState(1)
  const USERS_PER_PAGE = 10
  
  // 상세 검색 기록 페이지네이션  
  const [detailRecordsPage, setDetailRecordsPage] = useState(1)
  const DAYS_PER_PAGE = 10
  
  // 사용자 상세 모달
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userModalOpen, setUserModalOpen] = useState(false)

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
        return effectiveCount * 0.0023  // 프로필 검색: 1개 결과당 $0.0023
      } else {
        // 키워드 검색 (3단계 실행: Hashtag + Scraper + Profile)
        return effectiveCount * (0.002 + 0.0023 + 0.0023)  // 1개 결과당 $0.0066
      }
    } else if (platform === 'tiktok') {
      // TikTok: 키워드/프로필 검색 모두 동일 비용
      return effectiveCount * 0.003  // 1개 결과당 $0.003
    } else if (platform === 'youtube') {
      // YouTube: Google API 무료
      return 0
    }

    return 0
  }

  // 실제 결제 기반 수익 계산 (유료 플랜 + 실제 결제 완료된 경우만)
  // 주의: 이 함수는 개별 결제 기록에 접근할 수 없으므로 현재 플랜 기준으로 계산
  // 정확한 수익 계산은 사용자 상세 모달에서 billing_webhook_logs를 참조
  const calculateRevenue = (record: SearchRecord): number => {
    const plan = record.user_plan
    const hasValidPayment = record.last_payment_date && new Date(record.last_payment_date) > new Date('2024-01-01')
    
    // 실제 결제가 없는 경우 수익 없음
    if (!hasValidPayment || plan === 'free') {
      return 0
    }
    
    // 플랜별 월 구독료 (현재 플랜 기준 - 플랜 변경 시 부정확할 수 있음)
    // 정확한 계산을 위해서는 billing_webhook_logs의 실제 결제 금액 참조 필요
    const planRevenue = {
      starter: 29000,  // 수정된 STARTER 플랜 월 구독료
      pro: 49900,      // PRO 플랜 월 구독료  
      business: 99000, // BUSINESS 플랜 월 구독료
    }

    // 결제한 구독료 전액이 기본 수익 (사용량과 무관)
    // TODO: 플랜 변경 시 정확한 수익 계산을 위해 실제 결제 기록 참조 필요
    return planRevenue[plan as keyof typeof planRevenue] || 0
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
    
    const userPlan = userRecords[0].user_plan
    const lastPaymentDate = userRecords[0].last_payment_date
    const subscriptionStartDate = userRecords[0].subscription_start_date
    
    let cycleStart: Date
    let cycleEnd: Date
    
    if (userPlan === 'free') {
      // Free 플랜: 가입일 기준 30일 단위로 현재 주기 계산
      if (!subscriptionStartDate) return userRecords // 가입일이 없으면 모든 기록
      
      const signupDate = new Date(subscriptionStartDate)
      const now = new Date()
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24))
      const currentCycle = Math.floor(daysSinceSignup / 30)
      
      cycleStart = new Date(signupDate.getTime() + (currentCycle * 30 * 24 * 60 * 60 * 1000))
      cycleEnd = new Date(cycleStart.getTime() + (30 * 24 * 60 * 60 * 1000) - 1)
    } else {
      // 유료 플랜: 첫 주기는 가입일 기준, 이후는 결제일 기준
      if (!subscriptionStartDate) return [] // 가입일이 없으면 빈 배열
      
      const signupDate = new Date(subscriptionStartDate)
      const now = new Date()
      
      if (!lastPaymentDate) {
        // 결제 기록이 없는 경우 가입일 기준
        const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24))
        const currentCycle = Math.floor(daysSinceSignup / 30)
        cycleStart = new Date(signupDate.getTime() + (currentCycle * 30 * 24 * 60 * 60 * 1000))
        cycleEnd = new Date(cycleStart.getTime() + (30 * 24 * 60 * 60 * 1000) - 1)
      } else {
        // 결제 기록이 있는 경우
        const paymentDate = new Date(lastPaymentDate)
        const firstCycleEnd = new Date(signupDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        if (now <= firstCycleEnd) {
          // 현재 시점이 첫 번째 주기 내: 가입일 기준
          cycleStart = signupDate
          cycleEnd = new Date(firstCycleEnd.getTime() - 1)
        } else {
          // 두 번째 주기부터: 결제일 기준 30일 단위
          const daysSincePayment = Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24))
          const currentCycle = Math.floor(daysSincePayment / 30)
          cycleStart = new Date(paymentDate.getTime() + (currentCycle * 30 * 24 * 60 * 60 * 1000))
          cycleEnd = new Date(cycleStart.getTime() + (30 * 24 * 60 * 60 * 1000) - 1)
        }
      }
    }
    
    return userRecords.filter(record => {
      const recordDate = new Date(record.created_at)
      return recordDate >= cycleStart && recordDate <= cycleEnd
    })
  }

  // 사용자별 통계 계산
  const userStats = useMemo(() => {
    const stats = new Map<string, {
      userId: string
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
          userId: userId,
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

  // 사용자별 분석 페이지네이션 적용
  const paginatedUserStats = useMemo(() => {
    const startIndex = (userAnalysisPage - 1) * USERS_PER_PAGE
    const endIndex = startIndex + USERS_PER_PAGE
    return userStats.slice(startIndex, endIndex)
  }, [userStats, userAnalysisPage])

  const totalUserPages = Math.ceil(userStats.length / USERS_PER_PAGE)

  // 상세 검색 기록을 일자별로 그룹핑 (실제 검색 기록만)
  const dailyRecords = useMemo(() => {
    const grouped = new Map<string, SearchRecord[]>()
    
    records
      .filter(record => record.status !== 'no_search_history') // 더미 레코드 제외
      .forEach(record => {
        const date = format(new Date(record.created_at), 'yyyy-MM-dd')
        if (!grouped.has(date)) {
          grouped.set(date, [])
        }
        grouped.get(date)!.push(record)
      })
    
    // 날짜별로 정렬 (최신순)
    return Array.from(grouped.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
  }, [records])

  // 일자별 페이지네이션 적용
  const paginatedDailyRecords = useMemo(() => {
    const startIndex = (detailRecordsPage - 1) * DAYS_PER_PAGE
    const endIndex = startIndex + DAYS_PER_PAGE
    return dailyRecords.slice(startIndex, endIndex)
  }, [dailyRecords, detailRecordsPage])

  const totalDayPages = Math.ceil(dailyRecords.length / DAYS_PER_PAGE)
  
  // 선택된 날짜의 상세 기록
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 선택된 사용자의 전체 기록 조회
  const { data: userDetailData, error: userDetailError } = useQuery<UserDetailData>({
    queryKey: ['user-detail', selectedUser],
    queryFn: async () => {
      if (!selectedUser) return null
      console.log('사용자 상세 정보 요청:', selectedUser)
      const res = await fetch(`/api/admin/users/${selectedUser}`, { 
        cache: 'no-store'
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error('사용자 상세 정보 로드 실패:', errorData)
        throw new Error(`사용자 상세 정보 로드 실패: ${res.status}`)
      }
      const data = await res.json()
      console.log('사용자 상세 정보 응답:', data)
      return data
    },
    enabled: !!selectedUser && userModalOpen,
    staleTime: 2 * 60 * 1000 // 2분간 fresh
  })

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

  const getPlatformBadge = (platform: string | null) => {
    if (!platform) {
      return <Badge className="bg-gray-100 text-gray-600">미사용</Badge>
    }
    
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
        <h1 className="text-2xl font-semibold text-gray-900">검색 기록 관리</h1>
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


      {/* 사용자별 통계 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>사용자별 수익성 분석</CardTitle>
          <div className="text-sm text-gray-500">
            전체 {userStats.length}명 중 {((userAnalysisPage - 1) * USERS_PER_PAGE) + 1}-{Math.min(userAnalysisPage * USERS_PER_PAGE, userStats.length)}명 표시
          </div>
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
              {paginatedUserStats.map((user, index) => (
                <TableRow key={index}>
                  <TableCell 
                    className="font-medium cursor-pointer hover:text-blue-600 hover:underline"
                    onClick={() => {
                      setSelectedUser(user.userId)
                      setUserModalOpen(true)
                    }}
                  >
                    {user.email}
                  </TableCell>
                  <TableCell>{getPlanBadge(user.plan)}</TableCell>
                  <TableCell>{user.searchCount}회</TableCell>
                  <TableCell>{user.subtitleCount}회</TableCell>
                  <TableCell>
                    <span className="font-mono">
                      {user.usedCreditsInCycle.toLocaleString()}
                      <span className="text-gray-500">/{user.totalCreditsInPlan.toLocaleString()}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-700 text-sm">{formatKRW(user.totalApifyCost)}</TableCell>
                  <TableCell className="text-gray-700 text-sm">{formatKRW(user.totalRevenue)}</TableCell>
                  <TableCell className="text-gray-900 font-medium text-sm">
                    {formatKRW(user.netProfit)}
                  </TableCell>
                  <TableCell>{user.subscriptionStart ? formatDateTime(user.subscriptionStart) : '-'}</TableCell>
                  <TableCell>{user.lastPayment ? formatDateTime(user.lastPayment) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* 사용자별 분석 페이지네이션 */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setUserAnalysisPage(p => Math.max(1, p - 1))} 
              disabled={userAnalysisPage <= 1}
            >
              이전
            </Button>
            <span className="px-4 py-2 text-sm">
              {userAnalysisPage} / {totalUserPages}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setUserAnalysisPage(p => Math.min(totalUserPages, p + 1))} 
              disabled={userAnalysisPage >= totalUserPages}
            >
              다음
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 상세 검색 기록 (일자별) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>상세 검색 기록 (일자별)</CardTitle>
          <div className="text-sm text-gray-500">
            전체 {dailyRecords.length}일 중 {((detailRecordsPage - 1) * DAYS_PER_PAGE) + 1}-{Math.min(detailRecordsPage * DAYS_PER_PAGE, dailyRecords.length)}일 표시
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>총 검색</TableHead>
                <TableHead>총 자막</TableHead>
                <TableHead>총 크레딧</TableHead>
                <TableHead>총 원가</TableHead>
                <TableHead>주요 플랫폼</TableHead>
                <TableHead>상세보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDailyRecords.map(([date, dayRecords]) => {
                const searchCount = dayRecords.filter(r => r.search_type !== 'subtitle_extraction').length
                const subtitleCount = dayRecords.filter(r => r.search_type === 'subtitle_extraction').length
                const totalCredits = dayRecords.reduce((sum, r) => sum + (r.credits_used || 0), 0)
                const totalCost = dayRecords.reduce((sum, r) => sum + calculateApifyCost(r) * 1340, 0)
                const platforms = [...new Set(dayRecords.map(r => r.platform))]
                
                return (
                  <TableRow key={date}>
                    <TableCell className="font-medium">{date}</TableCell>
                    <TableCell>{searchCount}회</TableCell>
                    <TableCell>{subtitleCount}회</TableCell>
                    <TableCell>{totalCredits.toLocaleString()}</TableCell>
                    <TableCell className="text-red-600 font-mono">{formatKRW(totalCost)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {platforms.map(platform => (
                          <div key={platform}>{getPlatformBadge(platform)}</div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                      >
                        {selectedDate === date ? '접기' : '상세보기'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          
          {/* 일자별 페이지네이션 */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDetailRecordsPage(p => Math.max(1, p - 1))} 
              disabled={detailRecordsPage <= 1}
            >
              이전
            </Button>
            <span className="px-4 py-2 text-sm">
              {detailRecordsPage} / {totalDayPages}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setDetailRecordsPage(p => Math.min(totalDayPages, p + 1))} 
              disabled={detailRecordsPage >= totalDayPages}
            >
              다음
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 선택된 날짜의 상세 기록 */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedDate} 상세 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시간</TableHead>
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
                {dailyRecords
                  .find(([date]) => date === selectedDate)?.[1]
                  ?.filter(record => record.status !== 'no_search_history') // 실제 검색 기록만 표시
                  ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{format(new Date(record.created_at), 'HH:mm:ss')}</TableCell>
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
                                        <TableCell className="text-gray-700 font-mono text-xs">
                    {formatKRW(calculateApifyCost(record) * 1340)}
                  </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 사용자 상세 모달 */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] min-h-[90vh] max-h-[95vh] overflow-y-auto overflow-x-auto p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold text-gray-900">{selectedUser} 사용자 상세 분석</DialogTitle>
          </DialogHeader>
          
          {userDetailError && (
            <div className="text-red-600 p-4 bg-red-50 rounded-lg">
              <p className="font-semibold">데이터 로드 실패</p>
              <p className="text-sm mt-1">사용자 정보를 불러올 수 없습니다. 이메일이 올바른지 확인해주세요.</p>
              <p className="text-xs mt-2 text-gray-600">오류: {userDetailError.message}</p>
            </div>
          )}
          
          {userDetailData && (
            <div className="space-y-8">
              {/* 사용자 기본 정보 */}
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">기본 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-500">이메일</div>
                      <div className="font-semibold text-gray-900 break-all">{userDetailData.email}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-500">현재 플랜</div>
                      <div className="flex items-center">{getPlanBadge(userDetailData.plan)}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-500">총 검색</div>
                      <div className="text-xl font-bold text-blue-600">{userDetailData.totalSearches}회</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-500">총 자막 추출</div>
                      <div className="text-xl font-bold text-purple-600">{userDetailData.totalSubtitles}회</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 월별 사용 내역 */}
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">월별 사용 내역 및 수익성</CardTitle>
                </CardHeader>
                                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold text-gray-700 py-3">월</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-3">검색</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-3">자막</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-3">크레딧 사용</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-3">원가</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-3">수익</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-3">순이익</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userDetailData.monthlyStats?.map((month: any) => (
                          <TableRow key={month.month} className="hover:bg-gray-50">
                            <TableCell className="font-medium py-4">{month.month}</TableCell>
                            <TableCell className="py-4">{month.searchCount}회</TableCell>
                            <TableCell className="py-4">{month.subtitleCount}회</TableCell>
                            <TableCell className="py-4 font-mono">{month.creditsUsed.toLocaleString()}</TableCell>
                            <TableCell className="text-red-600 py-4 font-semibold">{formatKRW(month.cost)}</TableCell>
                            <TableCell className="text-blue-600 py-4 font-semibold">{formatKRW(month.revenue)}</TableCell>
                            <TableCell className={`py-4 font-bold ${month.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatKRW(month.netProfit)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 결제 주기별 분석 */}
              {userDetailData.billingCycles && userDetailData.billingCycles.length > 0 && (
                <Card className="shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-gray-800">결제 주기별 분석</CardTitle>
                    <div className="text-sm text-gray-600 mt-2">
                      첫 결제부터 각 주기마다의 구독 플랜, 결제금액, 사용원가, 순수익 분석
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="font-semibold text-gray-700 py-3 min-w-[140px]">결제 월</TableHead>
                            <TableHead className="font-semibold text-gray-700 py-3">구독 플랜</TableHead>
                            <TableHead className="font-semibold text-gray-700 py-3">결제 금액</TableHead>
                            <TableHead className="font-semibold text-gray-700 py-3">사용 원가</TableHead>
                            <TableHead className="font-semibold text-gray-700 py-3">순수익</TableHead>
                            <TableHead className="font-semibold text-gray-700 py-3 min-w-[140px]">결제일시</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userDetailData.billingCycles.map((cycle: any, index: number) => (
                            <TableRow key={index} className="hover:bg-gray-50">
                              <TableCell className="font-medium py-4">{cycle.monthDisplay}</TableCell>
                              <TableCell className="py-4">
                                <Badge variant="outline" className="px-3 py-1">
                                  {cycle.plan?.toUpperCase() || 'UNKNOWN'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-blue-600 py-4 font-bold">{cycle.amount.toLocaleString()}원</TableCell>
                              <TableCell className="text-red-600 py-4 font-bold">{cycle.usageCost.toFixed(0)}원</TableCell>
                              <TableCell className={`py-4 font-bold ${cycle.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {cycle.netProfit.toFixed(0)}원
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 py-4 font-mono">
                                {format(new Date(cycle.paymentDate), 'yyyy-MM-dd HH:mm')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 최근 3개월 검색 기록 상세 */}
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold text-gray-800">최근 3개월 검색 기록 상세</CardTitle>
                  <div className="text-sm text-gray-600 mt-2">
                    날짜, 시간, 플랫폼, 키워드, 원가를 포함한 상세 기록
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-6">
                      <TabsTrigger value="all" className="text-sm">전체</TabsTrigger>
                      <TabsTrigger value="youtube" className="text-sm">YouTube</TabsTrigger>
                      <TabsTrigger value="instagram" className="text-sm">Instagram</TabsTrigger>
                      <TabsTrigger value="tiktok" className="text-sm">TikTok</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="font-semibold text-gray-700 py-3 min-w-[120px]">날짜/시간</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3">플랫폼</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3">유형</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3 min-w-[150px]">키워드</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3">요청수</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3">결과수</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3">크레딧</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3 min-w-[100px]">원가</TableHead>
                              <TableHead className="font-semibold text-gray-700 py-3">상태</TableHead>
                            </TableRow>
                          </TableHeader>
                        <TableBody>
                          {(() => {
                            // 모든 플랫폼의 기록을 합쳐서 날짜순으로 정렬
                            const allRecords = [
                              ...(userDetailData.platformRecords?.youtube || []),
                              ...(userDetailData.platformRecords?.instagram || []),
                              ...(userDetailData.platformRecords?.tiktok || [])
                            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                            
                            return allRecords.map((record: any) => (
                              <TableRow key={record.id} className="hover:bg-gray-50">
                                <TableCell className="font-mono text-sm py-4">
                                  <div className="font-medium">{format(new Date(record.created_at), 'MM/dd')}</div>
                                  <div className="text-xs text-gray-500">
                                    {format(new Date(record.created_at), 'HH:mm')}
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">{getPlatformBadge(record.platform)}</TableCell>
                                <TableCell className="py-4">
                                  <Badge variant="outline" className="px-3 py-1">
                                    {record.search_type === 'subtitle_extraction' ? '자막' : '검색'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate py-4" title={record.keyword || '-'}>
                                  {record.keyword || '-'}
                                </TableCell>
                                <TableCell className="py-4 text-center">{record.requested_count || '-'}</TableCell>
                                <TableCell className="py-4 text-center">{record.results_count || '-'}</TableCell>
                                <TableCell className="py-4 font-mono text-center">{record.credits_used || '-'}</TableCell>
                                <TableCell className="text-red-600 font-mono text-sm py-4 font-semibold">
                                  {record.platform === 'youtube' && record.search_type !== 'subtitle_extraction' 
                                    ? '₩0 (무료)' 
                                    : formatKRW(calculateApifyCost(record) * 1340)
                                  }
                                </TableCell>
                                <TableCell className="py-4">{getStatusBadge(record.status)}</TableCell>
                              </TableRow>
                            ))
                          })()}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                    
                    {['youtube', 'instagram', 'tiktok'].map(platform => (
                      <TabsContent key={platform} value={platform}>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                <TableHead className="font-semibold text-gray-700 py-3 min-w-[120px]">날짜/시간</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3">유형</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3 min-w-[150px]">키워드</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3">요청수</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3">결과수</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3">크레딧</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3 min-w-[100px]">원가</TableHead>
                                <TableHead className="font-semibold text-gray-700 py-3">상태</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {userDetailData.platformRecords?.[platform]?.map((record: any) => (
                                <TableRow key={record.id} className="hover:bg-gray-50">
                                  <TableCell className="font-mono text-sm py-4">
                                    <div className="font-medium">{format(new Date(record.created_at), 'MM/dd')}</div>
                                    <div className="text-xs text-gray-500">
                                      {format(new Date(record.created_at), 'HH:mm')}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    <Badge variant="outline" className="px-3 py-1">
                                      {record.search_type === 'subtitle_extraction' ? '자막' : '검색'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[150px] truncate py-4" title={record.keyword || '-'}>
                                    {record.keyword || '-'}
                                  </TableCell>
                                  <TableCell className="py-4 text-center">{record.requested_count || '-'}</TableCell>
                                  <TableCell className="py-4 text-center">{record.results_count || '-'}</TableCell>
                                  <TableCell className="py-4 font-mono text-center">{record.credits_used || '-'}</TableCell>
                                  <TableCell className="text-red-600 font-mono text-sm py-4 font-semibold">
                                    {platform === 'youtube' && record.search_type !== 'subtitle_extraction' 
                                      ? '₩0 (무료)' 
                                      : formatKRW(calculateApifyCost(record) * 1340)
                                    }
                                  </TableCell>
                                  <TableCell className="py-4">{getStatusBadge(record.status)}</TableCell>
                                </TableRow>
                              )) || []}
                            </TableBody>
                          </Table>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
      

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


