import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Vercel Cron Secret 검증
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 30일 주기 크레딧 초기화 시작')

    const supabase = await supabaseServer()
    
    // 1. 오늘 날짜
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    // 2. 크레딧 초기화가 필요한 사용자들 찾기 (next_grant_date가 오늘 이전인 사용자들)
    const { data: usersToReset, error: fetchError } = await supabase
      .from('credits')
      .select(`
        user_id,
        cycle_start_date,
        next_grant_date,
        monthly_grant,
        balance,
        profiles!inner (
          plan,
          created_at,
          subscription_start_date,
          last_payment_date
        )
      `)
      .lte('next_grant_date', today)
    
    if (fetchError) {
      console.error('❌ 초기화 대상 사용자 조회 실패:', fetchError)
      return NextResponse.json({ error: '사용자 조회 실패' }, { status: 500 })
    }

    if (!usersToReset || usersToReset.length === 0) {
      console.log('✅ 크레딧 초기화가 필요한 사용자가 없습니다')
      return NextResponse.json({ 
        success: true, 
        message: '초기화 대상 없음',
        resetCount: 0 
      })
    }

    console.log(`📊 초기화 대상 사용자: ${usersToReset.length}명`)

    let resetCount = 0
    const resetDetails = []

    // 3. 각 사용자별로 크레딧 초기화 및 재지급
    for (const user of usersToReset) {
      try {
        const profiles = Array.isArray(user.profiles) ? user.profiles[0] : user.profiles
        const plan = profiles?.plan || 'free'
        const userCreatedAt = profiles?.created_at
        const subscriptionStartDate = profiles?.subscription_start_date
        const lastPaymentDate = profiles?.last_payment_date

        // 4. 새로운 크레딧 양 결정 (플랜별)
        let newCreditAmount = 0
        switch (plan) {
          case 'free':
            newCreditAmount = 250
            break
          case 'starter':
            newCreditAmount = 2000
            break
          case 'pro':
            newCreditAmount = 5000
            break
          case 'premium':
            newCreditAmount = 10000
            break
          default:
            newCreditAmount = 250 // 기본값
        }

        // 5. 다음 주기 시작일 계산
        let newCycleStartDate: string
        let newNextGrantDate: string

        if (plan === 'free') {
          // FREE 플랜: 가입일 기준 30일 주기
          const baseDate = new Date(userCreatedAt)
          let currentCycle = new Date(user.cycle_start_date || userCreatedAt)
          
          // 현재 날짜까지 30일씩 더해가며 최신 주기 찾기
          while (currentCycle <= new Date(today)) {
            currentCycle.setDate(currentCycle.getDate() + 30)
          }
          
          newCycleStartDate = new Date(currentCycle.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          newNextGrantDate = currentCycle.toISOString().split('T')[0]
        } else {
          // 유료 플랜: 결제일 기준 30일 주기
          const paymentDate = lastPaymentDate || subscriptionStartDate || userCreatedAt
          let currentCycle = new Date(user.cycle_start_date || paymentDate)
          
          // 현재 날짜까지 30일씩 더해가며 최신 주기 찾기
          while (currentCycle <= new Date(today)) {
            currentCycle.setDate(currentCycle.getDate() + 30)
          }
          
          newCycleStartDate = new Date(currentCycle.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          newNextGrantDate = currentCycle.toISOString().split('T')[0]
        }

        // 6. 크레딧 초기화 및 재지급
        const { error: updateError } = await supabase
          .from('credits')
          .update({
            balance: newCreditAmount, // 잔여 크레딧 초기화하고 새 크레딧 지급
            monthly_grant: newCreditAmount,
            cycle_start_date: newCycleStartDate,
            next_grant_date: newNextGrantDate,
            last_grant_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id)

        if (updateError) {
          console.error(`❌ 사용자 ${user.user_id} 크레딧 초기화 실패:`, updateError)
          continue
        }

        resetCount++
        resetDetails.push({
          user_id: user.user_id,
          plan,
          old_balance: user.balance,
          new_balance: newCreditAmount,
          new_cycle_start: newCycleStartDate,
          next_grant_date: newNextGrantDate
        })

        console.log(`✅ ${user.user_id} (${plan}): ${user.balance} → ${newCreditAmount} 크레딧`)

      } catch (userError) {
        console.error(`❌ 사용자 ${user.user_id} 처리 중 오류:`, userError)
        continue
      }
    }

    console.log(`🎉 30일 주기 크레딧 초기화 완료: ${resetCount}명 처리됨`)

    return NextResponse.json({
      success: true,
      message: `${resetCount}명의 크레딧이 30일 주기로 초기화되었습니다`,
      resetCount,
      details: resetDetails
    })

  } catch (error) {
    console.error('❌ 30일 주기 크레딧 초기화 전체 오류:', error)
    return NextResponse.json({ 
      error: '크레딧 초기화 실패',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
