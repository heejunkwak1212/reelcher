import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { format, parseISO } from 'date-fns'

// Apify 비용 계산 함수
function calculateApifyCost(record: any): number {
  const { search_type, results_count = 0, credits_used = 0 } = record
  
  if (search_type === 'subtitle_extraction') {
    return 0.0001 // 자막 추출: $0.0001
  }
  
  // 검색 결과 수에 따른 비용 계산
  if (results_count <= 30) return 0.05
  if (results_count <= 60) return 0.1
  if (results_count <= 90) return 0.15
  if (results_count <= 120) return 0.2
  return 0.25 // 120개 초과
}

// 수익 계산 함수 - 실제 결제 기록 기반으로 수익 계산
function calculateRevenue(record: any, userProfile: any, billingHistory: any[]): number {
  const { plan } = userProfile
  
  if (plan === 'free') return 0
  
  if (!billingHistory || billingHistory.length === 0) return 0
  
  // 검색 시점 기준으로 가장 가까운 결제 기록 찾기
  const recordDate = new Date(record.created_at)
  
  // 검색 시점 이전의 가장 최근 결제 기록 찾기
  const relevantPayment = billingHistory
    .filter(payment => {
      const paymentDate = new Date(payment.created_at)
      return paymentDate <= recordDate && (payment.status === 'DONE' || payment.status === 'COMPLETE')
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  
  if (!relevantPayment) {
    // 결제 기록이 없으면 현재 플랜 기준으로 fallback (무료 사용자 등)
    const planRevenue: Record<string, number> = {
      starter: 29000,
      pro: 49000,
      business: 99000
    }
    return planRevenue[plan] || 0
  }
  
  // 실제 결제 금액 기준으로 수익 계산
  return relevantPayment.amount || 0
}

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 관리자 권한 확인
    const { data: adminData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminData?.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { userId } = params
    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const svc = supabaseService()
    
    // 사용자 프로필 조회
    const { data: userProfile, error: profileError } = await svc
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 검색 기록 조회
    const { data: searchRecords, error: searchError } = await svc
      .from('search_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (searchError) {
      console.error('검색 기록 조회 오류:', searchError)
      return NextResponse.json(
        { error: '검색 기록 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 결제 기록 조회
    const { data: billingHistory, error: billingError } = await svc
      .from('billing_webhook_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'DONE')
      .order('created_at', { ascending: false })

    if (billingError) {
      console.error('결제 기록 조회 오류:', billingError)
    }

    // 월별 통계 계산
    const monthlyStats = new Map()
    const platformRecords = {
      instagram: [] as any[],
      tiktok: [] as any[],
      youtube: [] as any[]
    }

    searchRecords?.forEach((record: any) => {
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
          user_email: userProfile.email
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
      userId,
      email: userProfile.email,
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
      }).sort((a, b) => a.month.localeCompare(b.month)),
      billingCycles: billingCycles.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
      platformRecords,
      searchRecords: searchRecords || []
    })

  } catch (error) {
    console.error('사용자 정보 조회 오류:', error)
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 관리자 권한 확인
    const { data: adminData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminData?.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { userId } = params
    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const svc = supabaseService()
    
    // 사용자 존재 확인
    const { data: targetUser } = await svc.auth.admin.getUserById(userId)
    if (!targetUser?.user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 자기 자신을 삭제하는 것 방지
    if (userId === user.id) {
      return NextResponse.json(
        { error: '자기 자신을 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 사용자 관련 모든 데이터 삭제
    const deletePromises = [
      // 검색 기록 삭제
      svc.from('search_history').delete().eq('user_id', userId),
      svc.from('search_queue').delete().eq('user_id', userId),
      svc.from('platform_searches').delete().eq('user_id', userId),
      svc.from('searches').delete().eq('user_id', userId),
      
      // 크레딧 관련 삭제
      svc.from('credits').delete().eq('user_id', userId),
      svc.from('monthly_credit_usage').delete().eq('user_id', userId),
      svc.from('search_counters').delete().eq('user_id', userId),
      
      // 구독 및 결제 관련 삭제
      svc.from('subscriptions').delete().eq('user_id', userId),
      
      // 기타 사용자 데이터 삭제
      svc.from('certification_requests').delete().eq('user_id', userId),
      svc.from('user_api_keys').delete().eq('user_id', userId),
      svc.from('inquiries').delete().eq('user_id', userId),
      
      // 프로필 삭제
      svc.from('profiles').delete().eq('user_id', userId),
    ]

    // 모든 관련 데이터 삭제
    await Promise.allSettled(deletePromises)

    // Auth 사용자 삭제
    const { error: deleteAuthError } = await svc.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error('Auth 사용자 삭제 오류:', deleteAuthError)
      return NextResponse.json(
        { error: 'Auth 사용자 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: '사용자가 성공적으로 삭제되었습니다.' })

  } catch (error) {
    console.error('사용자 삭제 오류:', error)
    return NextResponse.json(
      { error: '사용자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
