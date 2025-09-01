import { supabaseServer } from '@/lib/supabase/server'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns'

export default async function AdminPage() {
  const supabase = await supabaseServer()
  
  // 기본 통계
  const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: searchCount } = await supabase.from('searches').select('*', { count: 'exact', head: true })
  
  // 플랜별 사용자 수
  const { data: planStats } = await supabase
    .from('profiles')
    .select('plan')
    .not('plan', 'is', null)
  
  const planCounts = planStats?.reduce((acc: Record<string, number>, user) => {
    const plan = user.plan || 'free'
    acc[plan] = (acc[plan] || 0) + 1
    return acc
  }, {}) || {}

  // 시간 범위 계산
  const now = new Date()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 오늘 가입한 사용자
  const { count: todaySignups } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)

  // 활성 사용자 (지난 7일간 검색한 사용자)
  const { data: activeUsersData } = await supabase
    .from('searches')
    .select('user_id')
    .gte('created_at', weekAgo)
  
  const activeUsers = new Set(activeUsersData?.map(s => s.user_id) || []).size

  // 오늘 검색량
  const { count: todaySearches } = await supabase
    .from('searches')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today)

  // 최근 30일 검색량
  const { count: monthlySearches } = await supabase
    .from('searches')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', monthAgo)

  // MRR 차트 데이터 생성 (최근 6개월)
  const getMRRData = async () => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)
      
      // 해당 월의 유료 사용자 수 조회
      const { data: monthlyUsers } = await supabase
        .from('profiles')
        .select('plan, subscription_start_date')
        .not('plan', 'eq', 'free')
        .lte('subscription_start_date', monthEnd.toISOString())
        
      // 플랜별 수익 계산
      let monthlyRevenue = 0
      if (monthlyUsers) {
        monthlyUsers.forEach(user => {
          const subStart = new Date(user.subscription_start_date || monthStart)
          if (subStart <= monthEnd) {
            switch (user.plan) {
              case 'starter': monthlyRevenue += 2000; break
              case 'pro': monthlyRevenue += 7000; break
              case 'business': monthlyRevenue += 12500; break
            }
          }
        })
      }
      
      months.push({
        date: format(date, 'MMM yyyy'),
        revenue: monthlyRevenue,
        userCount: monthlyUsers?.length || 0
      })
    }
    return months
  }

  const mrrData = await getMRRData()

  // 비용 계산 (인스타그램 액터별 비용)
  const { data: searchesWithCost } = await supabase
    .from('searches')
    .select('cost_credits, platform, results_count, created_at')
    .gte('created_at', monthAgo)

  // 오늘 비용 계산
  const todayCost = searchesWithCost?.filter(s => s.created_at >= today)
    .reduce((sum, search) => {
      if (search.platform === 'instagram') {
        // 인스타그램: 1번(2.3$), 2번(2.7$), 3번(2.6$) 액터 평균 2.53$
        const results = search.results_count || 30
        const dollarCost = (results / 1000) * 2.53 // 평균 액터 비용
        return sum + dollarCost * 1450 // 환율 적용 (원화)
      }
      return sum + (search.cost_credits || 0) * 3.2 // 기본 크레딧당 3.2원
    }, 0) || 0

  // 최근 30일 비용 계산
  const monthlyCost = searchesWithCost?.reduce((sum, search) => {
    if (search.platform === 'instagram') {
      const results = search.results_count || 30
      const dollarCost = (results / 1000) * 2.53
      return sum + dollarCost * 1450
    }
    return sum + (search.cost_credits || 0) * 3.2
  }, 0) || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">시스템 현황</h1>
            <p className="text-gray-600 text-sm mt-1">실시간 사용자 활동과 시스템 성능을 모니터링하세요</p>
          </div>
          <Link href="/admin/users">
            <button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
              사용자 관리
            </button>
          </Link>
        </div>

        {/* MRR 차트 */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Monthly Recurring Revenue</h2>
              <p className="text-sm text-gray-600">최근 6개월 구독 매출 현황</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600">
                {mrrData[mrrData.length - 1]?.revenue.toLocaleString()}원
              </div>
              <div className="text-sm text-gray-500">이번 달 MRR</div>
            </div>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mrrData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K원`}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()}원`, 'MRR']}
                  labelFormatter={(label) => `${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - System Stats */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">시스템 통계</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Week</span>
                  <span>Month</span>
                  <span>Year</span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  <button className="text-gray-400 hover:text-gray-600">Export</button>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{userCount?.toLocaleString() || 0}</div>
                  <div className="text-xs text-gray-500">총 사용자</div>
                  <div className="text-xs text-green-600 mt-1">+{todaySignups} 오늘</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{activeUsers}</div>
                  <div className="text-xs text-gray-500">활성 사용자</div>
                  <div className="text-xs text-gray-500 mt-1">7일 기준</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{todaySearches || 0}</div>
                  <div className="text-xs text-gray-500">오늘 검색</div>
                  <div className="text-xs text-gray-500 mt-1">{monthlySearches || 0} 최근 30일</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0))}
                  </div>
                  <div className="text-xs text-gray-500">유료 사용자</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(((planCounts.starter || 0) + (planCounts.pro || 0) + (planCounts.business || 0)) / (userCount || 1) * 100)}% 전환율
                  </div>
                </div>
              </div>

              {/* Plan Distribution */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">플랜별 분포</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-gray-900">{planCounts.free || 0}</div>
                    <div className="text-xs text-gray-600">FREE</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-blue-900">{planCounts.starter || 0}</div>
                    <div className="text-xs text-blue-600">STARTER</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-green-900">{planCounts.pro || 0}</div>
                    <div className="text-xs text-green-600">PRO</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-purple-900">{planCounts.business || 0}</div>
                    <div className="text-xs text-purple-600">BUSINESS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">빠른 액션</h3>
              <div className="space-y-3">
                <Link href="/admin/users" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 5.197V9a3 3 0 00-6 0v2.053" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">사용자 관리</div>
                    <div className="text-sm text-gray-500">사용자 목록 및 권한</div>
                  </div>
                </Link>
                
                <Link href="/admin/searches" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">검색 분석</div>
                    <div className="text-sm text-gray-500">검색 통계 및 트렌드</div>
                  </div>
                </Link>
                
                <Link href="/admin/credits" className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">크레딧 관리</div>
                    <div className="text-sm text-gray-500">크레딧 사용량 모니터링</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}