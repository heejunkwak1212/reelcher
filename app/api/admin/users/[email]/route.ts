import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email: rawEmail } = await params
    let email = decodeURIComponent(rawEmail)
    
    // 추가 디코딩 시도 (이중 인코딩 문제 해결)
    try {
      const doubleDecoded = decodeURIComponent(email)
      if (doubleDecoded !== email) {
        email = doubleDecoded
        console.log('이중 인코딩 감지 및 해결:', email)
      }
    } catch (e) {
      // 이미 디코딩된 경우 무시
    }
    
    console.log(`📋 사용자 상세 정보 조회: ${email}`)
    console.log('원본 URL 파라미터:', rawEmail)
    console.log('최종 디코딩된 이메일:', email)

    // 관리자 권한 확인
    const ssr = await supabaseServer()
    const { data: { user }, error: authError } = await ssr.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: '인증 실패' }, { status: 401 })
    }

    const { data: adminProfile } = await ssr
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminProfile?.role !== 'admin') {
      return Response.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    // 서비스 역할로 모든 데이터 조회 (RLS 우회)
    const supabase = supabaseService()

    // 사용자 기본 정보 조회 - URL 디코딩 문제 해결
    console.log('실제 검색할 이메일:', email)
    console.log('원본 URL 파라미터:', rawEmail)
    
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single()

    if (profileError) {
      console.error('사용자 프로필 조회 실패:', profileError)
      
      // 해당 이메일로 사용자가 존재하는지 확인 (서비스 역할로 모든 사용자 조회)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('email')
        .limit(100)
      
      console.log('현재 등록된 사용자 이메일 목록 (서비스 역할):', allProfiles?.map(p => p.email))
      
      // 이메일 부분 일치 검색도 시도해보기
      const { data: similarProfiles } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', `%${email.split('@')[0]}%`)
      
      console.log('유사한 이메일들:', similarProfiles?.map(p => p.email))
      
      return Response.json({ 
        error: `사용자를 찾을 수 없습니다. 요청된 이메일: ${email}`,
        availableEmails: allProfiles?.map(p => p.email) || [],
        similarEmails: similarProfiles?.map(p => p.email) || []
      }, { status: 404 })
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

    // 결제 기록 조회 (결제 주기별 분석용)
    const { data: billingHistory } = await supabase
      .from('billing_webhook_logs')
      .select('*')
      .eq('customer_key', `user_${userProfile.user_id}`)
      .eq('status', 'DONE')
      .order('created_at', { ascending: false })

    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userProfile.user_id)
      .single()

    // 월별 통계 계산
    const monthlyStats = new Map<string, {
      month: string
      searchCount: number
      subtitleCount: number
      creditsUsed: number
      cost: number
      revenue: number
      netProfit: number
      plan: string
    }>()

    // 플랫폼별 기록 분류
    const platformRecords = {
      youtube: [] as any[],
      instagram: [] as any[],
      tiktok: [] as any[]
    }

    searchRecords.forEach(record => {
      // 결제 주기별 통계 (free: 가입일 기준, 유료: 결제일 기준 30일 주기)
      const recordDate = new Date(record.created_at)
      let cycleKey: string
      
      if (userProfile.plan === 'free') {
        // Free 플랜: 가입일 기준 월별
        const signupDate = new Date(userProfile.created_at)
        const monthsFromSignup = Math.floor((recordDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        const cycleStart = new Date(signupDate.getTime() + monthsFromSignup * 30 * 24 * 60 * 60 * 1000)
        cycleKey = `free-${format(cycleStart, 'yyyy-MM-dd')}`
      } else {
        // 유료 플랜: 첫 주기는 가입일 기준, 이후는 결제일 기준
        const signupDate = new Date(userProfile.created_at)
        const paymentDate = userProfile.last_payment_date ? new Date(userProfile.last_payment_date) : null
        
        if (!paymentDate) {
          // 결제 기록이 없는 경우 가입일 기준
          const monthsFromSignup = Math.floor((recordDate.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
          const cycleStart = new Date(signupDate.getTime() + monthsFromSignup * 30 * 24 * 60 * 60 * 1000)
          cycleKey = `signup-${format(cycleStart, 'yyyy-MM-dd')}`
        } else {
          // 결제 기록이 있는 경우
          const firstCycleEnd = new Date(signupDate.getTime() + 30 * 24 * 60 * 60 * 1000)
          
          if (recordDate <= firstCycleEnd) {
            // 첫 번째 주기: 가입일 기준
            cycleKey = `signup-${format(signupDate, 'yyyy-MM-dd')}`
          } else {
            // 두 번째 주기부터: 결제일 기준 30일 단위
            const daysFromPayment = Math.floor((recordDate.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24))
            const cycle = Math.floor(daysFromPayment / 30)
            const cycleStart = new Date(paymentDate.getTime() + cycle * 30 * 24 * 60 * 60 * 1000)
            cycleKey = `paid-${format(cycleStart, 'yyyy-MM-dd')}`
          }
        }
      }
      
      if (!monthlyStats.has(cycleKey)) {
        monthlyStats.set(cycleKey, {
          month: cycleKey,
          searchCount: 0,
          subtitleCount: 0,
          creditsUsed: 0,
          cost: 0,
          revenue: 0,
          netProfit: 0,
          plan: userProfile.plan || 'free'
        })
      }

      const monthStat = monthlyStats.get(cycleKey)!
      
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
      const revenue = calculateRevenue(record, userProfile, billingHistory || [])
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

    // 결제 주기별 분석 계산
    const billingCycles: any[] = []
    
    if (billingHistory && billingHistory.length > 0) {
      billingHistory.forEach(payment => {
        const paymentDate = new Date(payment.created_at)
        const monthKey = format(paymentDate, 'yyyy-MM')
        
        // 해당 월의 플랜 정보 추출 (결제 내역에서)
        const planInfo = payment.raw_payload?.toPlan || payment.raw_payload?.orderName || 'unknown'
        const amount = payment.amount || 0
        
        // 해당 월의 사용 원가 계산 (monthlyStats에서)
        const monthStat = monthlyStats.get(monthKey)
        const usageCost = monthStat?.cost || 0
        const netProfit = amount - usageCost
        
        billingCycles.push({
          month: monthKey,
          monthDisplay: format(paymentDate, 'yyyy년 MM월'),
          plan: planInfo,
          amount: amount,
          usageCost: usageCost,
          netProfit: netProfit,
          paymentDate: payment.created_at,
          paymentKey: payment.payment_key
        })
      })
    }

    return Response.json({
      email,
      plan: userProfile.plan || 'free',
      totalSearches: searchRecords.filter(r => r.search_type !== 'subtitle_extraction').length,
      totalSubtitles: searchRecords.filter(r => r.search_type === 'subtitle_extraction').length,
      monthlyStats: Array.from(monthlyStats.values()).map(stat => {
        let monthDisplay: string
        
        if (stat.month.startsWith('free-')) {
          const cycleDate = stat.month.replace('free-', '')
          monthDisplay = `${format(parseISO(cycleDate), 'yyyy년 MM월 dd일')} (가입 주기)`
        } else if (stat.month.startsWith('signup-')) {
          const cycleDate = stat.month.replace('signup-', '')
          monthDisplay = `${format(parseISO(cycleDate), 'yyyy년 MM월 dd일')} (가입 주기)`
        } else if (stat.month.startsWith('paid-')) {
          const cycleDate = stat.month.replace('paid-', '')
          monthDisplay = `${format(parseISO(cycleDate), 'yyyy년 MM월 dd일')} (결제 주기)`
        } else {
          // 기존 형식 (yyyy-MM)
          monthDisplay = format(parseISO(stat.month + '-01'), 'yyyy년 MM월')
        }
        
        return {
          ...stat,
          monthDisplay
        }
      }).sort((a, b) => b.month.localeCompare(a.month)),
      platformRecords,
      billingCycles: billingCycles.sort((a, b) => b.month.localeCompare(a.month)), // 최신순
      subscription,
      userProfile
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

// 수익 계산 함수 (실제 결제 기록 기반)
function calculateRevenue(record: any, userProfile: any, billingHistory: any[]): number {
  const plan = userProfile.plan
  
  if (plan === 'free') {
    return 0
  }
  
  // 실제 결제 기록이 있는지 확인
  const hasActualPayments = billingHistory && billingHistory.length > 0
  
  if (!hasActualPayments) {
    return 0 // 결제 기록이 없으면 수익 0
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
