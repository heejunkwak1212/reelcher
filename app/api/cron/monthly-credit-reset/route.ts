import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Vercel Cron Job - 매월 1일 00:00 UTC에 실행
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Secret 검증
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 월별 크레딧 초기화 시작:', new Date().toISOString())

    const supabase = await supabaseServer()
    
    // 1. 모든 사용자의 프로필과 현재 크레딧 정보 조회
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('user_id, plan')
    
    if (usersError) {
      console.error('❌ 사용자 조회 실패:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    if (!users || users.length === 0) {
      console.log('⚠️ 초기화할 사용자가 없습니다')
      return NextResponse.json({ success: true, message: 'No users to reset' })
    }

    // 2. 플랜별 크레딧 설정
    const planCredits = {
      free: 250,
      starter: 2000,
      pro: 7000,
      business: 20000
    }

    let successCount = 0
    let errorCount = 0

    // 3. 각 사용자의 크레딧 초기화
    for (const user of users) {
      try {
        const plan = user.plan || 'free'
        const newCredits = planCredits[plan as keyof typeof planCredits] || 250
        const monthlyGrant = newCredits

        console.log(`🔄 크레딧 초기화: ${user.user_id} (${plan} 플랜) → ${newCredits} 크레딧`)

        // 크레딧 테이블 업데이트 (기존 레코드가 있으면 업데이트, 없으면 생성)
        const { error: upsertError } = await supabase
          .from('credits')
          .upsert({
            user_id: user.user_id,
            balance: newCredits,
            reserved: 0,
            monthly_grant: monthlyGrant,
            last_grant_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (upsertError) {
          console.error(`❌ 크레딧 초기화 실패 - 사용자: ${user.user_id}:`, upsertError)
          errorCount++
        } else {
          console.log(`✅ 크레딧 초기화 성공 - 사용자: ${user.user_id}`)
          successCount++
        }
      } catch (error) {
        console.error(`❌ 사용자 ${user.user_id} 처리 중 오류:`, error)
        errorCount++
      }
    }

    const result = {
      success: true,
      message: '월별 크레딧 초기화 완료',
      totalUsers: users.length,
      successCount,
      errorCount,
      timestamp: new Date().toISOString()
    }

    console.log('✅ 월별 크레딧 초기화 완료:', result)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ 월별 크레딧 초기화 오류:', error)
    return NextResponse.json({ 
      error: '월별 크레딧 초기화 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
