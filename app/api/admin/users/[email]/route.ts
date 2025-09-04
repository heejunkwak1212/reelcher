import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email: rawEmail } = await params
    const email = decodeURIComponent(rawEmail)
    console.log(`📋 사용자 상세 정보 조회: ${email}`)

    const supabase = await supabaseServer()

    // 사용자 기본 정보 조회
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (profileError) {
      console.error('사용자 프로필 조회 실패:', profileError)
      return Response.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 최근 3개월간의 검색 기록 조회
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    const { data: searchRecords, error: recordsError } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', userProfile.user_id)
      .gte('created_at', threeMonthsAgo.toISOString())
      .order('created_at', { ascending: false })

    if (recordsError) {
      console.error('검색 기록 조회 실패:', recordsError)
      return Response.json({ error: '검색 기록을 불러올 수 없습니다.' }, { status: 500 })
    }

    // 월별 통계 계산
    const monthlyStats = new Map<string, {
      month: string
      searchCount: number
      subtitleCount: number
      creditsUsed: number
      cost: number
      revenue: number
      netProfit: number
    }>()

    // 플랫폼별 기록 분류
    const platformRecords = {
      youtube: [] as any[],
      instagram: [] as any[],
      tiktok: [] as any[]
    }

    searchRecords.forEach(record => {
      // 월별 통계
      const month = format(new Date(record.created_at), 'yyyy-MM')
      if (!monthlyStats.has(month)) {
        monthlyStats.set(month, {
          month,
          searchCount: 0,
          subtitleCount: 0,
          creditsUsed: 0,
          cost: 0,
          revenue: 0,
          netProfit: 0
        })
      }

      const monthStat = monthlyStats.get(month)!
      
      if (record.search_type === 'subtitle_extraction') {
        monthStat.subtitleCount++
      } else {
        monthStat.searchCount++
      }
      
      monthStat.creditsUsed += record.credits_used || 0
      
      // 원가 계산
      const cost = calculateApifyCost(record) * 1340
      monthStat.cost += cost
      
      // 수익 계산 (실제 결제 기반)
      const revenue = calculateRevenue(record, userProfile)
      monthStat.revenue += revenue
      monthStat.netProfit = monthStat.revenue - monthStat.cost

      // 플랫폼별 분류
      const platform = record.platform as keyof typeof platformRecords
      if (platformRecords[platform]) {
        platformRecords[platform].push({
          ...record,
          user_email: email
        })
      }
    })

    return Response.json({
      email,
      plan: userProfile.plan || 'free',
      totalSearches: searchRecords.filter(r => r.search_type !== 'subtitle_extraction').length,
      totalSubtitles: searchRecords.filter(r => r.search_type === 'subtitle_extraction').length,
      monthlyStats: Array.from(monthlyStats.values()).sort((a, b) => b.month.localeCompare(a.month)),
      platformRecords
    })

  } catch (error) {
    console.error('사용자 상세 정보 조회 오류:', error)
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 원가 계산 함수 (기존과 동일)
function calculateApifyCost(record: any): number {
  let effectiveCount = record.results_count || 0
  
  if ((record.status === 'cancelled' || record.status === 'pending') && record.credits_used) {
    if (record.requested_count) {
      effectiveCount = record.requested_count
    } else {
      const creditsUsed = record.credits_used
      if (creditsUsed <= 120) effectiveCount = 30
      else if (creditsUsed <= 240) effectiveCount = 60
      else if (creditsUsed <= 360) effectiveCount = 90
      else effectiveCount = 120
    }
  }
  
  const platform = record.platform
  const searchType = record.search_type
  
  // 자막 추출 비용
  if (searchType === 'subtitle_extraction') {
    if (platform === 'youtube') {
      return 0  // YouTube는 yt-dlp 사용으로 무료
    } else if (platform === 'instagram' || platform === 'tiktok') {
      return 0.038  // 인스타/틱톡 자막 추출: 1개당 $0.038
    }
    return 0
  }

  // 일반 검색 비용
  if (platform === 'instagram') {
    if (searchType === 'profile' || record.keyword?.startsWith('@')) {
      return effectiveCount * 0.0023  // 프로필 검색: 1개 결과당 $0.0023
    } else {
      // 키워드 검색 (3단계 실행: Hashtag + Scraper + Profile)
      return effectiveCount * (0.002 + 0.0023 + 0.0023)  // 1개 결과당 $0.0066
    }
  } else if (platform === 'tiktok') {
    return effectiveCount * 0.003  // 1개 결과당 $0.003
  } else if (platform === 'youtube') {
    return 0
  }

  return 0
}

// 수익 계산 함수 (기존과 동일)
function calculateRevenue(record: any, userProfile: any): number {
  const plan = userProfile.plan
  const hasValidPayment = userProfile.last_payment_date && new Date(userProfile.last_payment_date) > new Date('2024-01-01')
  
  if (!hasValidPayment || plan === 'free') {
    return 0
  }
  
  const creditsUsed = record.credits_used || 0
  
  const creditPrices = {
    starter: 1.0,
    pro: 1.0,
    business: 0.83,
  }

  const pricePerCredit = creditPrices[plan as keyof typeof creditPrices] || 0
  return creditsUsed * pricePerCredit
}
