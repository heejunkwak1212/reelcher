"use client"
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [credit, setCredit] = useState<number | null>(null)
  const [recent, setRecent] = useState<number | null>(null)
  const [searches, setSearches] = useState<any[]>([])
  const [sevenDayUsage, setSevenDayUsage] = useState<number>(0)
  const [fourteenDayUsage, setFourteenDayUsage] = useState<number>(0)
  const [thirtyDayUsage, setThirtyDayUsage] = useState<number>(0)
  const [remainingCredits, setRemainingCredits] = useState<number>(0)
  const [sevenDaySearchCount, setSevenDaySearchCount] = useState<number>(0)
  const [fourteenDaySearchCount, setFourteenDaySearchCount] = useState<number>(0)
  const [thirtyDaySearchCount, setThirtyDaySearchCount] = useState<number>(0)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 데이터 로딩 함수 분리
  const loadDashboardData = async () => {
      try {
        setLoading(true)
      const supabase = supabaseBrowser()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) {
          console.error('❌ 대시보드 인증 오류:', authError)
          return
        }
        
        if (!user) {
          console.warn('⚠️ 대시보드 사용자 없음')
          return
        }
        
        console.log('🔄 대시보드 데이터 로딩 시작:', user.id)
      
        // 1. 잔여 크레딧 조회
        const { data: credits, error: creditsError } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        
        if (creditsError) {
          console.error('❌ 크레딧 조회 오류:', creditsError)
          setCredit(0)
          setRemainingCredits(0)
        } else {
          const remainingBalance = credits?.balance ?? 0
          setCredit(remainingBalance)
          setRemainingCredits(remainingBalance)
          console.log('✅ 크레딧 로드 완료:', remainingBalance)
        }

        // 2. 기간별 검색 횟수와 크레딧 사용량을 분리하여 조회
        // 검색 횟수: 자막 추출 제외, 크레딧 사용량: 자막 추출 포함
        const queries = [
          // 검색 횟수 (자막 추출 제외)
          supabase
            .from('search_history')
            .select('credits_used, status, search_type')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .neq('search_type', 'subtitle_extraction')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

          supabase
            .from('search_history')
            .select('credits_used, status, search_type')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .neq('search_type', 'subtitle_extraction')
            .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),

          supabase
            .from('search_history')
            .select('credits_used, status, search_type')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .neq('search_type', 'subtitle_extraction')
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

          // 크레딧 사용량 (자막 추출 포함)
          supabase
            .from('search_history')
            .select('credits_used')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          
          supabase
            .from('search_history')
            .select('credits_used')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
          
          supabase
            .from('search_history')
            .select('credits_used')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ];

        // Promise.allSettled를 사용해서 하나가 실패해도 다른 쿼리들은 실행되도록 함
        const results = await Promise.allSettled(queries)
        const [search7d, search14d, search30d, credit7d, credit14d, credit30d] = results.map(result =>
          result.status === 'fulfilled' ? result.value : { data: null, error: result.reason }
        )

        // 크레딧 사용량 계산 (자막 추출 포함)
        const usage7dTotal = credit7d?.data?.reduce((sum, record) => sum + (record.credits_used || 0), 0) || 0
        const usage14dTotal = credit14d?.data?.reduce((sum, record) => sum + (record.credits_used || 0), 0) || 0
        const usage30dTotal = credit30d?.data?.reduce((sum, record) => sum + (record.credits_used || 0), 0) || 0

        setSevenDayUsage(usage7dTotal)
        setFourteenDayUsage(usage14dTotal)
        setThirtyDayUsage(usage30dTotal)

        // 검색 횟수 계산 (자막 추출 제외)
        const search7dCount = search7d?.data?.length || 0
        const search14dCount = search14d?.data?.length || 0
        const search30dCount = search30d?.data?.length || 0

        setSevenDaySearchCount(search7dCount)
        setFourteenDaySearchCount(search14dCount)
        setThirtyDaySearchCount(search30dCount)

        console.log('✅ 사용량/검색횟수 로드 완료:', { 
          usage: { usage7dTotal, usage14dTotal, usage30dTotal },
          searches: { search7dCount, search14dCount, search30dCount }
        })

        // 3. 최근 30일간 일별 크레딧 사용량 조회 (차트용)
        // ⚠️ 중요: 모든 상태 포함하여 실제 크레딧 차감을 반영
        const { data: dailyUsageData, error: dailyError } = await supabase
          .from('search_history')
          .select('created_at, credits_used, status')
          .eq('user_id', user.id)
          .gt('credits_used', 0) // credits_used > 0인 검색만 포함
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })

        if (dailyError) {
          console.error('❌ 일별 사용량 조회 오류:', dailyError)
        } else {
          // 일별 데이터 집계
          const dailyMap = new Map<string, number>()
          
          // 최근 30일 날짜 배열 생성
          const last30Days = []
          for (let i = 29; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            last30Days.push(dateStr)
            dailyMap.set(dateStr, 0)
          }

          // 실제 사용량 데이터 매핑
          dailyUsageData?.forEach(record => {
            const dateStr = new Date(record.created_at).toISOString().split('T')[0]
            const currentUsage = dailyMap.get(dateStr) || 0
            dailyMap.set(dateStr, currentUsage + (record.credits_used || 0))
          })

          // 차트 데이터 형태로 변환
          const chartData = last30Days.map(dateStr => ({
            date: dateStr,
            dateDisplay: new Date(dateStr).toLocaleDateString('ko-KR', { 
              month: 'short', 
              day: 'numeric' 
            }),
            usage: dailyMap.get(dateStr) || 0
          }))

          setChartData(chartData)
          console.log('✅ 차트 데이터 로드 완료:', chartData)
        }
        
        // 4. 검색 기록 조회
        const { data: searchHistoryData, error: searchError } = await supabase
          .from('search_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (searchError) {
          console.error('❌ 검색 기록 조회 오류:', searchError)
          setSearches([])
        } else {
          setSearches(searchHistoryData || [])
          console.log('✅ 검색 기록 로드 완료:', searchHistoryData?.length)
        }

        // 5. 최근 30일 검색량 조회 (자막 추출 제외)
        const { data: monthlySearches } = await supabase
          .from('search_history')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .neq('search_type', 'subtitle_extraction') // 자막 추출은 검색통계에서 제외
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

        setRecent(monthlySearches?.length || 0)

      } catch (error) {
        console.error('❌ 대시보드 전체 로딩 오류:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        // 에러 발생 시 기본값 설정
        setCredit(0)
        setSevenDayUsage(0)
        setFourteenDayUsage(0)
        setThirtyDayUsage(0)
        setRemainingCredits(0)
        setSevenDaySearchCount(0)
        setFourteenDaySearchCount(0)
        setThirtyDaySearchCount(0)
        setRecent(0)
        setSearches([])
        setChartData([])
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    // 초기 로드
    loadDashboardData()

    // 결제 성공 시 토스트 메시지 표시
    const subscription = searchParams.get('subscription')
    const plan = searchParams.get('plan')
    const action = searchParams.get('action')

    if (subscription === 'success' && plan && action) {
      const planNames = {
        starter: 'STARTER',
        pro: 'PRO',
        business: 'BUSINESS'
      }

      const planName = planNames[plan as keyof typeof planNames] || plan.toUpperCase()

      if (action === 'subscribe') {
        toast.success(`🎉 ${planName} 플랜으로 바로 이용이 가능해요!`, {
          duration: 5000,
          description: '이제 모든 기능을 자유롭게 사용해보세요.'
        })
      } else if (action === 'upgrade') {
        toast.success(`🎉 ${planName} 플랜으로 업그레이드 완료!`, {
          duration: 5000,
          description: '새로운 플랜의 모든 혜택을 누려보세요.'
        })
      }

      // 결제 완료 후 sessionStorage 정리
      setTimeout(() => {
        sessionStorage.removeItem('billingKey')
        sessionStorage.removeItem('customerKey')
        sessionStorage.removeItem('billingPlan')
        console.log('✅ 결제 완료 후 sessionStorage 정리 완료')
      }, 1000)
    }

    // 🔄 실시간 업데이트를 위한 윈도우 포커스 이벤트 리스너
    const handleFocus = () => {
      console.log('🔄 대시보드 포커스 이벤트 - 데이터 새로고침')
      loadDashboardData()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 대시보드 가시성 변경 - 데이터 새로고침')
        loadDashboardData()
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 주기적 업데이트 (30초마다)
    const intervalId = setInterval(() => {
      console.log('🔄 대시보드 주기적 업데이트 (30초)')
      loadDashboardData()
    }, 30000)

    // 정리 함수
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-gray-900">크레딧 사용 기록</h1>
            <p className="text-gray-600 text-sm mt-1">기간별 크레딧 사용량 확인</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-gray-200 shadow-none rounded-lg">
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-500">최근 7일</CardTitle>
              <div className="absolute top-3 right-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '-' : `${sevenDayUsage.toLocaleString()}`}
              </div>
              <p className="text-xs text-gray-500 mt-1">사용량</p>
            </CardContent>
          </Card>
          
          <Card className="border-gray-200 shadow-none rounded-lg">
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-500">최근 14일</CardTitle>
              <div className="absolute top-3 right-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '-' : `${fourteenDayUsage.toLocaleString()}`}
          </div>
              <p className="text-xs text-gray-500 mt-1">사용량</p>
            </CardContent>
          </Card>
          
          <Card className="border-gray-200 shadow-none rounded-lg">
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-500">최근 30일</CardTitle>
              <div className="absolute top-3 right-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '-' : `${thirtyDayUsage.toLocaleString()}`}
        </div>
              <p className="text-xs text-gray-500 mt-1">사용량</p>
            </CardContent>
          </Card>
          
          <Card className="border-gray-200 shadow-none rounded-lg">
            <CardHeader className="pb-2 relative">
              <CardTitle className="text-sm font-medium text-gray-500">잔여 크레딧</CardTitle>
              <div className="absolute top-3 right-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12s-1.536-.219-2.121-.659c-1.172-.879-1.172-2.303 0-3.182C10.464 7.69 11.232 7.471 12 7.471s1.536.219 2.121.659" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {loading ? '-' : `${remainingCredits.toLocaleString()}`}
              </div>
              <p className="text-xs text-gray-500 mt-1">사용 가능</p>
            </CardContent>
          </Card>
            </div>
            
        {/* Credit Usage Chart & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          {/* Chart */}
          <div className="lg:col-span-3">
            <Card className="border-gray-200 shadow-none rounded-lg">
              <CardHeader className="relative">
                <CardTitle className="text-lg font-semibold text-gray-900">최근 30일 크레딧 사용량</CardTitle>
                <p className="text-sm text-gray-600">일별 세부 크레딧 사용 패턴 확인</p>
                <Link href="/dashboard/history" className="absolute top-4 right-4">
                  <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-800 text-xs px-3 py-1.5">
                    자세히 보기
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-3 flex justify-center">
                {loading ? (
                  <div className="h-96 flex items-center justify-center w-full">
                    <div className="text-gray-500">로딩 중...</div>
                              </div>
                ) : chartData.length > 0 ? (
                  <ChartContainer
                    config={{
                      usage: {
                        label: "크레딧 사용량",
                        color: "#000000",
                      },
                    }}
                    className="h-96 w-full"
                  >
                    <BarChart 
                      data={chartData}
                      margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                    >
                      <XAxis 
                        dataKey="dateDisplay" 
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        tickFormatter={(value, index) => {
                          // 30일 데이터에서 마지막부터 5일 간격으로 표시
                          const totalDays = 30;
                          const interval = 5;
                          const shouldShow = (totalDays - 1 - index) % interval === 0;
                          return shouldShow ? value : '';
                        }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent 
                          formatter={(value: any, name: any, props: any) => [
                            `${value.toLocaleString()} 크레딧`,
                            '사용량'
                          ]}
                          labelFormatter={(label: any, payload: any) => {
                            if (payload && payload[0]) {
                              const fullDate = new Date(payload[0].payload.date)
                              return fullDate.toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })
                            }
                            return label
                          }}
                          indicator="dot"
                          hideLabel={false}
                        />}
                      />
                      <Bar 
                        dataKey="usage" 
                        fill="#000000"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center">
                    <div className="text-gray-500">사용 데이터가 없습니다</div>
                              </div>
                            )}
              </CardContent>
            </Card>
          </div>

                              {/* Search Count Cards */}
          <div className="lg:col-span-1">
            {/* Section Header */}
            <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">최근 검색 횟수</h2>
              <p className="text-sm text-gray-600 mt-1">기간별 검색 활동 확인</p>
            </div>
            
            <div className="space-y-6">
              {/* 7일 검색 횟수 */}
              <Card className="border-gray-200 shadow-none rounded-lg">
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-sm font-medium text-gray-500">최근 7일</CardTitle>
                  <div className="absolute top-4 right-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
                    </svg>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 flex items-end gap-1">
                    {loading ? '-' : sevenDaySearchCount.toLocaleString()}
                    <span className="text-sm font-medium text-gray-600 mb-1">회</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">검색 횟수</p>
                </CardContent>
              </Card>
              
              {/* 14일 검색 횟수 */}
              <Card className="border-gray-200 shadow-none rounded-lg">
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-sm font-medium text-gray-500">최근 14일</CardTitle>
                  <div className="absolute top-4 right-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 flex items-end gap-1">
                    {loading ? '-' : fourteenDaySearchCount.toLocaleString()}
                    <span className="text-sm font-medium text-gray-600 mb-1">회</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">검색 횟수</p>
                </CardContent>
              </Card>
              
              {/* 30일 검색 횟수 */}
              <Card className="border-gray-200 shadow-none rounded-lg">
                <CardHeader className="pb-2 relative">
                  <CardTitle className="text-sm font-medium text-gray-500">최근 30일</CardTitle>
                  <div className="absolute top-4 right-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25z" />
                    </svg>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900 flex items-end gap-1">
                    {loading ? '-' : thirtyDaySearchCount.toLocaleString()}
                    <span className="text-sm font-medium text-gray-600 mb-1">회</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">검색 횟수</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>


      </div>
    </div>
  )
}