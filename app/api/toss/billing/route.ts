import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

// 크론잡에서 결제 실패 시 FREE 플랜으로 전환하는 함수
async function handlePaymentFailureInCron(userId: string, orderId: string, currentPlan: string, error: any, supabase: any) {
  try {
    console.log(`🔄 Converting user ${userId} to FREE plan due to payment failure`)

    // 1. 구독 상태 업데이트 (FREE 플랜으로 변경)
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        plan: 'free',
        status: 'payment_failed', // 결제 실패 상태로 변경
        billing_key: null, // 결제 실패 시 빌링키 제거하여 재시도 방지
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (subscriptionError) {
      console.error('❌ Failed to update subscription to FREE:', subscriptionError)
    }

    // 2. 프로필 플랜 업데이트
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        plan: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (profileError) {
      console.error('❌ Failed to update profile to FREE:', profileError)
    }

    // 3. 사용자 가입일 조회 (FREE 플랜 크레딧 주기 계산용)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('user_id', userId)
      .single()

    // 4. 크레딧을 FREE 플랜으로 초기화 (가입일 기준 30일 주기)
    const signupDate = new Date(userProfile?.created_at || new Date())
    const currentDate = new Date()
    
    // 가입일 기준으로 현재 주기 계산
    let currentCycle = new Date(signupDate)
    while (currentCycle <= currentDate) {
      currentCycle.setDate(currentCycle.getDate() + 30)
    }
    
    const cycleStartDate = new Date(currentCycle.getTime() - 30 * 24 * 60 * 60 * 1000)
    const nextGrantDate = currentCycle

    const { error: creditError } = await supabase
      .from('credits')
      .update({
        balance: 250,
        monthly_grant: 250,
        last_grant_at: new Date().toISOString(),
        cycle_start_date: cycleStartDate.toISOString().split('T')[0],
        next_grant_date: nextGrantDate.toISOString().split('T')[0],
        plan_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (creditError) {
      console.error('❌ Failed to reset credits to FREE plan:', creditError)
    }

    // 5. 플랜 변경 로그 기록 (기존 시스템과 일관성 유지)
    try {
      // plan_change_logs에 기록하여 기존 시스템과 일관성 유지
      const { error: planChangeLogError } = await supabase
        .from('plan_change_logs')
        .insert({
          user_id: userId,
          from_plan: currentPlan,
          to_plan: 'free',
          change_type: 'payment_failed',
          credits_before_change: 0, // 크론잡에서는 정확한 값을 모르므로 0
          credits_after_change: 250,
          credits_used_before_change: 0,
          is_first_paid_subscription: false,
          created_at: new Date().toISOString()
        })

      if (planChangeLogError) {
        console.error('❌ Failed to log plan change:', planChangeLogError)
      }
    } catch (logError) {
      console.error('❌ Failed to create plan change log:', logError)
    }

    console.log(`✅ Successfully converted user ${userId} from ${currentPlan} to FREE plan due to payment failure`)

  } catch (conversionError) {
    console.error(`💥 Failed to handle payment failure for user ${userId}:`, conversionError)
  }
}

// 취소된 구독의 다음 결제일 만료 시 FREE 플랜으로 전환하는 함수
async function handleCanceledSubscriptionExpiry(userId: string, currentPlan: string, nextChargeDate: Date, supabase: any) {
  try {
    console.log(`🔄 Converting canceled subscription to FREE plan for user ${userId}`)

    // 1. 구독 상태 업데이트 (FREE 플랜으로 변경)
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        plan: 'free',
        status: 'expired', // 만료된 상태로 변경
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (subscriptionError) {
      console.error('❌ Failed to update subscription to FREE:', subscriptionError)
    }

    // 2. 프로필 플랜 업데이트
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        plan: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (profileError) {
      console.error('❌ Failed to update profile to FREE:', profileError)
    }

    // 3. 크레딧을 FREE 플랜으로 초기화 (다음 결제일 기준 30일 주기)
    const currentDate = new Date()
    
    // 다음 결제일 기준으로 현재 주기 계산
    let currentCycle = new Date(nextChargeDate)
    while (currentCycle <= currentDate) {
      currentCycle.setDate(currentCycle.getDate() + 30)
    }
    
    const cycleStartDate = new Date(currentCycle.getTime() - 30 * 24 * 60 * 60 * 1000)
    const nextGrantDate = currentCycle

    const { error: creditError } = await supabase
      .from('credits')
      .update({
        balance: 250,
        monthly_grant: 250,
        last_grant_at: new Date().toISOString(),
        cycle_start_date: cycleStartDate.toISOString().split('T')[0],
        next_grant_date: nextGrantDate.toISOString().split('T')[0],
        plan_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (creditError) {
      console.error('❌ Failed to reset credits to FREE plan:', creditError)
    }

    // 4. 플랜 변경 로그 기록
    try {
      const { error: planChangeLogError } = await supabase
        .from('plan_change_logs')
        .insert({
          user_id: userId,
          from_plan: currentPlan,
          to_plan: 'free',
          change_type: 'subscription_expired',
          credits_before_change: 0,
          credits_after_change: 250,
          credits_used_before_change: 0,
          is_first_paid_subscription: false,
          created_at: new Date().toISOString()
        })

      if (planChangeLogError) {
        console.error('❌ Failed to log plan change:', planChangeLogError)
      }
    } catch (logError) {
      console.error('❌ Failed to create plan change log:', logError)
    }

    console.log(`✅ Successfully converted canceled subscription to FREE plan for user ${userId}`)

  } catch (conversionError) {
    console.error(`💥 Failed to handle canceled subscription expiry for user ${userId}:`, conversionError)
  }
}
import { db } from '@/db'
import { subscriptions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const saveSchema = z.object({ plan: z.enum(['starter','pro','business']), billingKey: z.string().min(3) })

// Save billing key for current user
export async function POST(req: Request) {
  try {
    const payload = saveSchema.safeParse(await req.json())
    if (!payload.success) return new Response('Bad Request', { status: 400 })
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    const now = new Date()
    const next = new Date(now)
    next.setUTCMonth(next.getUTCMonth() + 1)
    // 일반 유저의 상향(업그레이드)만 허용. 다운그레이드는 대시보드의 변경 플로우로 제한
    const { data: cur } = await svc.from('subscriptions').select('plan').eq('user_id', user.id).single()
    const rank = (p?: string) => (p==='business'?3: p==='pro'?2: p==='starter'?1:0)
    const isAdmin = (await svc.from('profiles').select('role').eq('user_id', user.id).single()).data?.role === 'admin'
    if (cur?.plan && !isAdmin && rank(payload.data.plan) < rank(cur.plan)) {
      return new Response('Downgrade is not allowed here', { status: 403 })
    }
    await svc.from('subscriptions').upsert({ user_id: user.id as any, plan: payload.data.plan, billing_key: payload.data.billingKey, status: 'active', renewed_at: now.toISOString(), next_charge_at: next.toISOString() })
    return Response.json({ ok: true })
  } catch (e) {
    return new Response('Bad Request', { status: 400 })
  }
}

// Cron-like monthly charge (invoke by scheduler)
export async function PUT(req: Request) {
  try {
    const svc = supabaseService()
    const { data: rows } = await svc.from('subscriptions').select('user_id, plan, billing_key, status, next_charge_at')
    const planToCredits: Record<string, number> = { starter: 2000, pro: 7000, business: 20000 }
    const now = new Date()
    
    // 1. 먼저 취소된 구독 중 next_charge_at이 지난 것들을 FREE 플랜으로 전환
    for (const s of rows || []) {
      if (s.status === 'canceled' && s.next_charge_at) {
        const nextChargeDate = new Date(s.next_charge_at)
        if (nextChargeDate <= now) {
          console.log(`🔄 Converting canceled subscription to FREE plan: user ${s.user_id}`)
          await handleCanceledSubscriptionExpiry(s.user_id, s.plan, nextChargeDate, svc)
        }
      }
    }
    
    // 2. 기존 자동결제 로직 (활성 구독만)
    for (const s of rows || []) {
      if (!s.billing_key || s.status !== 'active') continue
      
      // 토스 공식 가이드에 따른 빌링키로 자동결제 승인 (월간만 지원)
      const planToPrices: Record<string, number> = { starter: 19900, pro: 49900, business: 119900 }
      const amount = planToPrices[s.plan as keyof typeof planToPrices] || 0
      const delta = planToCredits[s.plan as keyof typeof planToCredits] || 0
      
      if (!delta) continue
      
      if (amount > 0) {
        const secret = process.env.TOSS_SECRET_KEY
        if (!secret) continue
        
        const orderId = `subscription_${s.user_id}_${Date.now()}`
        const auth = Buffer.from(`${secret}:`).toString('base64')
        
        try {
          // 빌링키로 자동결제 승인 API 호출
          const paymentRes = await fetch(`https://api.tosspayments.com/v1/billing/${s.billing_key}`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerKey: `customer_${s.user_id}`,
              amount: amount,
              orderId: orderId,
              orderName: `릴처 ${s.plan.toUpperCase()} 플랜 월간 구독료`
            })
          })
          
          if (!paymentRes.ok) {
            console.error(`Auto payment failed for user ${s.user_id}:`, await paymentRes.text())
            continue
          }
          
          const paymentResult = await paymentRes.json()
          console.log(`Auto payment success for user ${s.user_id}:`, paymentResult)
          
          // 결제 성공 시에만 크레딧 지급 및 구독 갱신 (월간만 지원)
          const next = new Date(now)
          next.setUTCMonth(next.getUTCMonth() + 1)
          
          const { data: cr } = await svc.from('credits').select('balance,reserved').eq('user_id', s.user_id).single()
          await svc.from('credits').upsert({ user_id: s.user_id as any, balance: (cr?.balance || 0) + delta, reserved: cr?.reserved || 0 })
          await svc.from('subscriptions').update({ renewed_at: now.toISOString(), next_charge_at: next.toISOString() }).eq('user_id', s.user_id)
        } catch (error) {
          console.error(`❌ Auto payment failed for user ${s.user_id}:`, error)
          
          // 결제 실패 시 자동으로 FREE 플랜으로 전환
          await handlePaymentFailureInCron(s.user_id, orderId, s.plan, error, svc)
        }
      }
    }
    return Response.json({ ok: true })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}

// Cancel subscription: stop auto charge; keep plan usable until next_charge_at
export async function DELETE(req: Request) {
  try {
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    const { data: sub } = await svc.from('subscriptions').select('status,next_charge_at,plan').eq('user_id', user.id).single()
    if (!sub) return new Response('Not Found', { status: 404 })
    // Mark as canceled; do not change next_charge_at so user keeps benefits until that date
    await svc.from('subscriptions').update({ status: 'canceled' }).eq('user_id', user.id)
    // Optional: also clear billing_key to prevent accidental re-charge
    // await svc.from('subscriptions').update({ billing_key: null }).eq('user_id', user.id)
    return Response.json({ ok: true, until: sub.next_charge_at, plan: sub.plan })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}


