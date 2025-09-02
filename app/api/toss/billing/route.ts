import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
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
    const { data: rows } = await svc.from('subscriptions').select('user_id, plan, billing_key, status')
    const planToCredits: Record<string, number> = { starter: 2000, pro: 7000, business: 20000 }
    const now = new Date()
    const next = new Date(now)
    next.setUTCMonth(next.getUTCMonth() + 1)
    for (const s of rows || []) {
      if (!s.billing_key || s.status !== 'active') continue
      const delta = planToCredits[s.plan as keyof typeof planToCredits] || 0
      if (!delta) continue
      // 토스 공식 가이드에 따른 빌링키로 자동결제 승인 (테스트용: 스타터 100원)
      const planToPrices: Record<string, number> = { starter: 100, pro: 49000, business: 119000 }
      const amount = planToPrices[s.plan as keyof typeof planToPrices] || 0
      
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
              orderName: `릴처 ${s.plan.toUpperCase()} 플랜 월 구독료`
            })
          })
          
          if (!paymentRes.ok) {
            console.error(`Auto payment failed for user ${s.user_id}:`, await paymentRes.text())
            continue
          }
          
          const paymentResult = await paymentRes.json()
          console.log(`Auto payment success for user ${s.user_id}:`, paymentResult)
          
          // 결제 성공 시에만 크레딧 지급 및 구독 갱신
          const { data: cr } = await svc.from('credits').select('balance,reserved').eq('user_id', s.user_id).single()
          await svc.from('credits').upsert({ user_id: s.user_id as any, balance: (cr?.balance || 0) + delta, reserved: cr?.reserved || 0 })
          await svc.from('subscriptions').update({ renewed_at: now.toISOString(), next_charge_at: next.toISOString() }).eq('user_id', s.user_id)
        } catch (error) {
          console.error(`Auto payment error for user ${s.user_id}:`, error)
          // 결제 실패 시 구독 상태를 일시정지로 변경할 수 있음
          // await svc.from('subscriptions').update({ status: 'payment_failed' }).eq('user_id', s.user_id)
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


