import { supabaseServer } from '@/lib/supabase/server'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns'

export async function GET() {
  try {
    const supabase = supabaseServer()
    
    // 기본 통계
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    const { count: searchCount } = await supabase.from('search_history').select('*', { count: 'exact', head: true })
    
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
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 주간/월간 검색 수
    const { count: weeklySearches } = await supabase
      .from('search_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    const { count: monthlySearches } = await supabase
      .from('search_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo)

    // MRR 계산 (최근 6개월)
    const mrrData = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(monthStart)
      const monthKey = format(monthStart, 'yyyy-MM')

      // 해당 월의 활성 유료 구독자 수 (실제 결제 데이터가 있는 경우만)
      const { data: activeSubscriptions } = await supabase
        .from('profiles')
        .select('plan, last_payment_date')
        .not('plan', 'eq', 'free')
        .not('last_payment_date', 'is', null)
        .gte('last_payment_date', monthStart.toISOString())
        .lte('last_payment_date', monthEnd.toISOString())

      // 플랜별 MRR 계산
      let monthlyMRR = 0
      activeSubscriptions?.forEach(sub => {
        const plan = sub.plan
        const planPrices = {
          starter: 2000,
          pro: 7000,
          business: 12500
        }
        monthlyMRR += planPrices[plan as keyof typeof planPrices] || 0
      })

      mrrData.push({
        month: format(monthStart, 'MM월'),
        mrr: monthlyMRR
      })
    }

    return Response.json({
      stats: {
        userCount: userCount || 0,
        searchCount: searchCount || 0,
        weeklySearches: weeklySearches || 0,
        monthlySearches: monthlySearches || 0,
        planCounts
      },
      mrrData
    })

  } catch (error) {
    console.error('대시보드 데이터 조회 오류:', error)
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
