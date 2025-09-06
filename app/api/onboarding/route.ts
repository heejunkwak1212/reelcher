import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const bodySchema = z.object({
  displayName: z.string().trim().min(1),
  howFound: z.string().trim().optional().default(''),
  role: z.literal('user'),
  phoneNumber: z.string().trim().optional(), // 전화번호 추가
  agreeMarketing: z.boolean().optional().default(false), // 마케팅 수신동의 추가
})

export async function POST(req: Request) {
  try {
    const input = bodySchema.parse(await req.json())
    const supabase = await supabaseServer()
    const supabaseAdmin = supabaseService()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // 전화번호가 있는 경우 이전 탈퇴 기록 확인
    let previousCreditBalance = 0
    if (input.phoneNumber) {
      try {
        const { data: previousBalance, error: checkError } = await supabaseAdmin.rpc('check_previous_credit_balance', {
          p_phone_number: input.phoneNumber
        })
        
        if (!checkError && previousBalance !== null) {
          previousCreditBalance = previousBalance
          console.log(`이전 탈퇴 기록 발견: 전화번호 ${input.phoneNumber}, 이전 잔액: ${previousBalance}`)
        }
      } catch (error) {
        console.error('이전 크레딧 잔액 확인 중 오류:', error)
        // 에러가 있어도 온보딩은 계속 진행
      }
    }

    // 프로필 업서트 (role은 'user'로 강제)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        display_name: input.displayName,
        how_found: input.howFound,
        role: 'user',
        phone_number: input.phoneNumber || null,
        marketing_consent: input.agreeMarketing,
        onboarding_completed: true,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (profileError) {
      console.error('프로필 생성/업데이트 실패:', profileError)
      return Response.json({ error: 'Profile creation failed' }, { status: 500 })
    }

    // 크레딧 초기화 (가입일 기준 30일 주기로 설정)
    const signupDate = new Date(user.created_at)
    const currentDate = new Date()
    
    // 가입일 기준으로 현재 주기 계산
    let currentCycle = new Date(signupDate)
    while (currentCycle <= currentDate) {
      currentCycle.setDate(currentCycle.getDate() + 30)
    }
    
    const cycleStartDate = new Date(currentCycle.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const nextGrantDate = currentCycle.toISOString().split('T')[0]
    
    // 이전 탈퇴 기록이 있으면 해당 잔액으로, 없으면 250 크레딧으로 시작
    const initialBalance = previousCreditBalance > 0 ? previousCreditBalance : 250

    const { error: creditsError } = await supabase
      .from('credits')
      .upsert({
        user_id: user.id,
        balance: initialBalance,
        reserved: 0,
        monthly_grant: 250,
        last_grant_at: new Date().toISOString(),
        cycle_start_date: cycleStartDate,
        next_grant_date: nextGrantDate
      }, {
        onConflict: 'user_id'
      })

    if (creditsError) {
      console.error('크레딧 생성/업데이트 실패:', creditsError)
      return Response.json({ error: 'Credits creation failed' }, { status: 500 })
    }

    // 이전 탈퇴 기록이 있었다면 로그 출력
    if (previousCreditBalance > 0) {
      console.log(`재가입 사용자 크레딧 복구 방지: ${input.phoneNumber} - 이전 잔액 ${previousCreditBalance}로 설정`)
    }

    return Response.json({ 
      ok: true,
      restoredCredits: previousCreditBalance > 0 ? previousCreditBalance : null
    })
  } catch (e) {
    const err: any = e
    console.error('온보딩 처리 중 오류:', err)
    if (Array.isArray(err?.issues)) return Response.json({ error: 'ValidationError', issues: err.issues }, { status: 400 })
    return Response.json({ error: err?.message || 'BadRequest' }, { status: 400 })
  }
}

export async function GET(req: Request) {
  // 닉네임 중복 체크 비활성화 - 항상 사용 가능으로 반환
  return Response.json({ ok: true })
}


