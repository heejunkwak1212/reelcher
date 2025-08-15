import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const secret = process.env.TOSS_SECRET_KEY
    if (!secret) return new Response('TOSS_SECRET_KEY missing', { status: 500 })

    const payload = await req.json()
    const { paymentKey, orderId, amount, creditDelta } = payload || ({} as any)
    if (!paymentKey || !orderId) return new Response('Bad Request', { status: 400 })

    let receipt: any = { ok: true }
    // DEMO: paymentKey === 'demo' 또는 환경변수 TOSS_DEMO_MODE=true 이면 Toss 확인 건너뜀
    const isDemo = paymentKey === 'demo' || process.env.TOSS_DEMO_MODE === 'true'
    if (!isDemo) {
      const auth = Buffer.from(`${secret}:`).toString('base64')
      const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        return new Response(err || 'Confirm failed', { status: 400 })
      }
      receipt = await res.json()
    }

    // Credit user balance
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    // Block Top-up on FREE plan
    const { data: prof } = await svc.from('profiles').select('plan').eq('user_id', user.id).single()
    if ((prof?.plan || 'free') === 'free') {
      return new Response('Top-up is not available on FREE plan. Please upgrade.', { status: 403 })
    }
    const { data: row } = await svc.from('credits').select('balance, reserved').eq('user_id', user.id).single()
    const current = (row?.balance || 0) as number
    const reserved = (row as any)?.reserved || 0
    // 금액→크레딧 변환: STARTER/PRO/BUSINESS 또는 Top-up 상품에 맞춰 클라이언트에서 orderId로 구분해 전달하는 것이 정석이지만,
    // MVP로는 amount(원화)를 그대로 크레딧으로 간주하지 않고, 프론트에서 전달한 creditDelta가 있으면 우선 사용합니다.
    const delta = Number(creditDelta || 0) || 0
    await svc.from('credits').upsert({ user_id: user.id as any, balance: current + delta, reserved })

    return Response.json({ ok: true, receipt })
  } catch (e) {
    return new Response('Bad Request', { status: 400 })
  }
}


