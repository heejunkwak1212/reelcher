import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
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

        // 서비스 역할 클라이언트로 auth.users에서 모든 사용자 조회
    const svc = supabaseService()
    console.log('🔍 서비스 클라이언트로 사용자 목록 조회 시작')
    const { data: authUsersData, error: authUsersError } = await svc.auth.admin.listUsers()

    if (authUsersError) {
      console.error('사용자 목록 조회 오류:', authUsersError)
      return NextResponse.json(
        { error: '사용자 정보를 불러올 수 없습니다.' },
        { status: 500 }
      )
    }

    const allUsers = authUsersData?.users || []
    console.log(`✅ 총 ${allUsers.length}명의 사용자 발견`)

    // 각 사용자의 프로필, 크레딧, 검색 통계를 별도로 조회 (서비스 클라이언트 사용)
    const users = await Promise.all(allUsers.map(async (authUser) => {
      const [profileRes, creditsRes, countersRes] = await Promise.all([
        svc
          .from('profiles')
          .select('display_name, role, plan, phone_number')
          .eq('user_id', authUser.id)
          .single(),
        svc
          .from('credits')
          .select('balance, reserved')
          .eq('user_id', authUser.id)
          .single(),
        svc
          .from('search_counters')
          .select('today_count, month_count')
          .eq('user_id', authUser.id)
          .single()
      ])

      return {
        user_id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        display_name: profileRes.data?.display_name || null,
        role: profileRes.data?.role || 'user',
        plan: profileRes.data?.plan || 'free',
        phone_number: profileRes.data?.phone_number || null,
        credits: creditsRes.data || { balance: 0, reserved: 0 },
        search_counters: countersRes.data || { today_count: 0, month_count: 0 }
      }
    }))

    const usersError = null // 에러 변수 초기화

    if (usersError) {
      console.error('사용자 조회 오류:', usersError)
      return NextResponse.json(
        { error: '사용자 정보를 불러올 수 없습니다.' },
        { status: 500 }
      )
    }

    // 각 사용자의 최근 30일 크레딧 사용량 계산
    const now = new Date()
    const monthStart = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    const monthStartIso = monthStart.toISOString()

    const usersWithStats = await Promise.all(users.map(async (user) => {
      // 최근 30일 크레딧 사용량 계산 (search_history 테이블 사용)
      const { data: monthCredits } = await svc
        .from('search_history')
        .select('credits_used')
        .eq('user_id', user.user_id)
        .gte('created_at', monthStartIso)
        .not('credits_used', 'is', null)

      const totalMonthCredits = (monthCredits || []).reduce((sum, r) => sum + (r.credits_used || 0), 0)

      // 최근 30일 검색 수 계산
      const { data: monthSearches } = await svc
        .from('search_history')
        .select('id')
        .eq('user_id', user.user_id)
        .gte('created_at', monthStartIso)

      return {
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        plan: user.plan,
        phone_number: user.phone_number,
        created_at: user.created_at,
        credits_balance: user.credits?.balance || 0,
        credits_reserved: user.credits?.reserved || 0,
        today_searches: user.search_counters?.today_count || 0,
        month_searches: user.search_counters?.month_count || 0,
        month_credits_used: totalMonthCredits,
        total_searches: (monthSearches || []).length
      }
    }))

    return NextResponse.json({
      users: usersWithStats,
      totalUsers: users.length
    })

  } catch (error) {
    console.error('관리자 사용자 조회 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    // 요청 본문 파싱
    const { email, creditDelta } = await request.json()

    if (!email || !creditDelta) {
      return NextResponse.json(
        { error: '이메일과 크레딧 금액이 필요합니다.' },
        { status: 400 }
      )
    }

    console.log(`🔍 크레딧 충전 요청: ${email}에게 ${creditDelta} 크레딧`)

    // 서비스 클라이언트로 이메일로 사용자 찾기
    const svc = supabaseService()
    const { data: authUsersData, error: authUsersError } = await svc.auth.admin.listUsers()

    if (authUsersError) {
      console.error('사용자 목록 조회 오류:', authUsersError)
      return NextResponse.json(
        { error: '사용자 목록을 조회할 수 없습니다.' },
        { status: 500 }
      )
    }

    const targetUser = authUsersData?.users?.find(u => u.email === email)
    
    if (!targetUser) {
      console.warn(`⚠️ 사용자를 찾을 수 없음: ${email}`)
      return NextResponse.json(
        { error: '해당 이메일의 사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log(`✅ 사용자 발견: ${targetUser.id} (${email})`)

    // 크레딧 업데이트
    const { data: currentCredit, error: getCreditError } = await svc
      .from('credits')
      .select('balance')
      .eq('user_id', targetUser.id)
      .single()

    if (getCreditError) {
      console.error('현재 크레딧 조회 오류:', getCreditError)
      
      // 크레딧 레코드가 없는 경우 새로 생성
      if (getCreditError.code === 'PGRST116') {
        console.log(`📝 새 크레딧 레코드 생성: ${targetUser.id}`)
        // 30일 주기 설정으로 크레딧 레코드 생성
        const today = new Date()
        const cycleStartDate = today.toISOString().split('T')[0]
        const nextGrantDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        const { error: insertError } = await svc
          .from('credits')
          .insert({
            user_id: targetUser.id,
            balance: creditDelta,
            reserved: 0,
            monthly_grant: 250,
            last_grant_at: new Date().toISOString(),
            cycle_start_date: cycleStartDate,
            next_grant_date: nextGrantDate
          })

        if (insertError) {
          console.error('크레딧 레코드 생성 실패:', insertError)
          return NextResponse.json(
            { error: '크레딧 레코드 생성에 실패했습니다.' },
            { status: 500 }
          )
        }

        console.log(`✅ 크레딧 충전 완료: ${email}에게 ${creditDelta} 크레딧 충전`)
        return NextResponse.json({ success: true, message: '크레딧이 충전되었습니다.' })
      }

      return NextResponse.json(
        { error: '크레딧 정보를 조회할 수 없습니다.' },
        { status: 500 }
      )
    }

    // 기존 크레딧에 추가
    const newBalance = (currentCredit?.balance || 0) + creditDelta
    const { error: updateError } = await svc
      .from('credits')
      .update({ balance: newBalance })
      .eq('user_id', targetUser.id)

    if (updateError) {
      console.error('크레딧 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: '크레딧 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log(`✅ 크레딧 충전 완료: ${email}에게 ${creditDelta} 크레딧 충전 (새 잔액: ${newBalance})`)
    return NextResponse.json({ 
      success: true, 
      message: '크레딧이 충전되었습니다.',
      newBalance 
    })

  } catch (error) {
    console.error('크레딧 충전 오류:', error)
    return NextResponse.json(
      { error: '크레딧 충전 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}