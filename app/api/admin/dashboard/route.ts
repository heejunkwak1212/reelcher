import { supabaseServer } from '@/lib/supabase/server'
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek } from 'date-fns'

// 실제 Apify 액터별 비용 (2024년 기준, 환율: 1,350원/$)
const APIFY_COSTS = {
  // 플랫폼별 검색 1결과당 실제 Apify 비용 (원)
  instagram: {
    keyword: 8.91,   // 3개 액터 실행: hashtag($0.002) + scraper($0.0023) + profile($0.0023) = $0.0066 × 1350원
    profile: 3.105   // 1개 액터 실행: scraper task ($0.0023) × 1350원
  },
  youtube: {
    keyword: 0,      // YouTube는 Apify 액터 미사용
    url: 0           // YouTube는 Apify 액터 미사용
  },
  tiktok: {
    keyword: 4.05,   // TikTok scraper ($0.003) × 1350원
    profile: 4.05    // TikTok scraper ($0.003) × 1350원
  },
  captions: 51.3     // 자막 추출 액터 ($0.038) × 1350원 - 별도 기능
}

// 정확한 Apify 비용 계산 함수
function calculateApifyCost(platform: string, searchType: string, resultsCount: number): number {
  if (platform === 'youtube') {
    // YouTube는 Apify 액터를 사용하지 않음
    return 0
  }
  
  const platformCosts = APIFY_COSTS[platform as keyof typeof APIFY_COSTS]
  if (!platformCosts || typeof platformCosts === 'number') return 0
  
  const costPerResult = platformCosts[searchType as keyof typeof platformCosts] || 0
  return Math.round(resultsCount * costPerResult * 100) / 100 // 소수점 2자리 반올림
}

export async function GET() {
  try {
    const supabase = await supabaseServer()
    
    // 시간 범위 계산
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    // ===========================================
    // 1. 기본 통계 (활성 사용자 수만 포함)
    // ===========================================
    const { count: totalUserCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    // ===========================================
    // 2. 플랜별 사용자 현황 (정확한 집계)
    // ===========================================
    const { data: planStats } = await supabase
      .from('profiles')
      .select('plan')
    
    const planCounts = planStats?.reduce((acc: Record<string, number>, user) => {
      const plan = user.plan || 'free'
      acc[plan] = (acc[plan] || 0) + 1
      return acc
    }, {}) || {}

    // ===========================================
    // 3. 주간/월간 검색 수 (자막추출 제외, 정확한 기간)
    // ===========================================
    // 주간: 정확히 7일 전부터 현재까지
    const exactWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const { count: weeklySearches } = await supabase
      .from('search_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', exactWeekAgo.toISOString())
      .lt('created_at', now.toISOString()) // lte -> lt로 변경
      .eq('status', 'completed')
      .in('platform', ['instagram', 'youtube', 'tiktok']) // 자막추출 제외

    // 월간: 이번 달 1일부터 말일까지
    const { count: monthlySearches } = await supabase
      .from('search_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', currentMonthStart.toISOString())
      .lt('created_at', now.toISOString()) // 현재까지만
      .eq('status', 'completed')
      .in('platform', ['instagram', 'youtube', 'tiktok']) // 자막추출 제외

    // ===========================================
    // 4. 총 수익 계산 (실제 결제 - 환불 금액)
    // ===========================================
    const { data: allPayments } = await supabase
      .from('billing_webhook_logs')
      .select('amount')
      .eq('event_type', 'PAYMENT')
      .not('payment_key', 'is', null)
      .eq('processed', true)

    const totalPayments = allPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0

    // 환불된 금액 계산
    const { data: allRefunds } = await supabase
      .from('cancellation_logs')
      .select('refund_amount')
      .eq('refund_processed', true)

    const totalRefunds = allRefunds?.reduce((sum, refund) => sum + (refund.refund_amount || 0), 0) || 0

    // 실제 순수익 = 총 결제 - 총 환불
    const totalRevenue = totalPayments - totalRefunds

    // ===========================================
    // 5. 이번달 순수익 (결제 - 환불)
    // ===========================================
    const { data: currentMonthPayments } = await supabase
      .from('billing_webhook_logs')
      .select('amount')
      .eq('event_type', 'PAYMENT')
      .not('payment_key', 'is', null)
      .eq('processed', true)
      .gte('created_at', currentMonthStart.toISOString())
      .lte('created_at', currentMonthEnd.toISOString())

    const currentMonthPaymentTotal = currentMonthPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0

    // 이번달 환불 금액
    const { data: currentMonthRefunds } = await supabase
      .from('cancellation_logs')
      .select('refund_amount')
      .eq('refund_processed', true)
      .gte('cancellation_date', currentMonthStart.toISOString())
      .lte('cancellation_date', currentMonthEnd.toISOString())

    const currentMonthRefundTotal = currentMonthRefunds?.reduce((sum, refund) => sum + (refund.refund_amount || 0), 0) || 0

    // 이번달 실제 순수익 = 이번달 결제 - 이번달 환불
    const currentMonthRevenue = currentMonthPaymentTotal - currentMonthRefundTotal

    // ===========================================
    // 6. 이번달 Apify 비용 계산
    // ===========================================
    const { data: currentMonthSearches } = await supabase
      .from('search_history')
      .select('platform, search_type, results_count')
      .eq('status', 'completed')
      .gte('created_at', currentMonthStart.toISOString())
      .lte('created_at', currentMonthEnd.toISOString())

    let currentMonthApifyCost = 0
    currentMonthSearches?.forEach(search => {
      if (search.platform && search.search_type && search.results_count) {
        currentMonthApifyCost += calculateApifyCost(
          search.platform,
          search.search_type,
          search.results_count
        )
      }
    })

    // ===========================================
    // 7. 전체 Apify 비용 계산
    // ===========================================
    const { data: allSearches } = await supabase
      .from('search_history')
      .select('platform, search_type, results_count')
      .eq('status', 'completed')

    let totalApifyCost = 0
    allSearches?.forEach(search => {
      if (search.platform && search.search_type && search.results_count) {
        totalApifyCost += calculateApifyCost(
          search.platform,
          search.search_type,
          search.results_count
        )
      }
    })

    // ===========================================
    // 8. 이번달 순수익 = 이번달 수익 - 이번달 Apify 비용
    // ===========================================
    const currentMonthNetProfit = currentMonthRevenue - currentMonthApifyCost

    // ===========================================
    // 9. 사용자당 평균 순수익 계산
    // ===========================================
    const netRevenue = totalRevenue - totalApifyCost
    const averageRevenuePerUser = (totalUserCount || 0) > 0 ? Math.round(netRevenue / (totalUserCount || 1)) : 0

    // ===========================================
    // 10. MRR 계산 (2025년 9월부터, 월 1일-말일 기준)
    // ===========================================
    const mrrData = []
    const serviceStartDate = new Date('2025-09-01') // 서비스 시작일
    
    // 현재 월부터 최대 6개월 전까지 (하지만 서비스 시작일 이후만)
    for (let i = 0; i < 6; i++) {
      const monthStart = startOfMonth(subMonths(now, i))
      const monthEnd = endOfMonth(monthStart)
      
      // 2025년 9월 이전 데이터는 제외
      if (monthStart < serviceStartDate) break
      const monthKey = format(monthStart, 'yyyy-MM')

      // 해당 월의 실제 순수익 (결제 - 환불)
      const { data: monthPayments } = await supabase
        .from('billing_webhook_logs')
        .select('amount')
        .eq('event_type', 'PAYMENT')
        .not('payment_key', 'is', null)
        .eq('processed', true)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())

      const monthPaymentTotal = monthPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0

      // 해당 월의 환불 금액
      const { data: monthRefunds } = await supabase
        .from('cancellation_logs')
        .select('refund_amount')
        .eq('refund_processed', true)
        .gte('cancellation_date', monthStart.toISOString())
        .lte('cancellation_date', monthEnd.toISOString())

      const monthRefundTotal = monthRefunds?.reduce((sum, refund) => sum + (refund.refund_amount || 0), 0) || 0

      // 해당 월의 실제 순수익
      const monthRevenue = monthPaymentTotal - monthRefundTotal

      mrrData.unshift({ // unshift로 최신 데이터가 뒤에 오도록
        month: format(monthStart, 'MM월'),
        mrr: monthRevenue,
        period: monthKey
      })
    }

    // ===========================================
    // 11. 주간 MRR 계산 (최근 8주)
    // ===========================================
    const weeklyMrrData = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000))
      const weekEnd = new Date(weekStart.getTime() + (6 * 24 * 60 * 60 * 1000))
      
      // 2025년 9월 이전 데이터는 제외
      if (weekStart < serviceStartDate) continue

      // 해당 주의 실제 순수익 (결제 - 환불)
      const { data: weekPayments } = await supabase
        .from('billing_webhook_logs')
        .select('amount')
        .eq('event_type', 'PAYMENT')
        .not('payment_key', 'is', null)
        .eq('processed', true)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())

      const weekPaymentTotal = weekPayments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0

      // 해당 주의 환불 금액
      const { data: weekRefunds } = await supabase
        .from('cancellation_logs')
        .select('refund_amount')
        .eq('refund_processed', true)
        .gte('cancellation_date', weekStart.toISOString())
        .lte('cancellation_date', weekEnd.toISOString())

      const weekRefundTotal = weekRefunds?.reduce((sum, refund) => sum + (refund.refund_amount || 0), 0) || 0

      // 해당 주의 실제 순수익
      const weekRevenue = weekPaymentTotal - weekRefundTotal

      weeklyMrrData.unshift({ // unshift로 최신 데이터가 뒤에 오도록
        week: format(weekStart, 'MM/dd'),
        mrr: weekRevenue,
        period: format(weekStart, 'yyyy-MM-dd')
      })
    }

    return Response.json({
      stats: {
        totalUserCount: totalUserCount || 0,
        weeklySearches: weeklySearches || 0,
        monthlySearches: monthlySearches || 0,
        planCounts,
        totalRevenue,
        currentMonthRevenue,
        currentMonthApifyCost,
        currentMonthNetProfit,
        totalApifyCost,
        averageRevenuePerUser
      },
      mrrData,
      weeklyMrrData
    })

  } catch (error) {
    console.error('대시보드 데이터 조회 오류:', error)
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}