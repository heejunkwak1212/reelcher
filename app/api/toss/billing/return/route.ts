import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const querySchema = z.object({ 
  authKey: z.string().min(3), 
  customerKey: z.string().min(1),
  plan: z.string().optional()
})

// GET 요청 처리 (토스페이먼츠 리다이렉트)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const authKey = url.searchParams.get('authKey')
    const customerKey = url.searchParams.get('customerKey')
    const plan = url.searchParams.get('plan')

    if (!authKey || !customerKey) {
      return new Response('Missing required parameters', { status: 400 })
    }

    const secret = process.env.TOSS_SECRET_KEY
    if (!secret) return new Response('TOSS_SECRET_KEY missing', { status: 500 })

    // Exchange authKey -> billingKey (토스 공식 가이드 준수)
    const auth = Buffer.from(`${secret}:`).toString('base64')
    const res = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey, customerKey })
    })
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error('Billing key issue failed:', errorText)
      return new Response(errorText || 'Billing issue failed', { status: 400 })
    }
    
    const response = await res.json()
    const billingKey = response?.billingKey as string | undefined
    
    if (!billingKey) {
      return new Response('No billingKey in response', { status: 400 })
    }

    // 빌링키 발급 성공 → 결제 확인 페이지로 이동
    console.log('빌링키 발급 성공, 결제 확인 페이지로 이동:', { billingKey, customerKey, plan })
    
    // 구독 정보만 먼저 저장 (결제는 아직 안 함)
    try {
      const userId = customerKey.replace('user_', '')
      const supabase = await supabaseServer()
      
      // 구독 정보 저장 (status: pending)
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: plan || 'starter',
        billing_key: billingKey,
        status: 'pending', // 결제 대기 상태
        toss_customer_key: customerKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      console.log('구독 정보 저장 완료 (결제 대기 상태)')
      
    } catch (error) {
      console.error('구독 정보 저장 실패:', error)
    }

    // 결제 확인 페이지로 리다이렉트 (실제 결제는 사용자 확인 후)
    const confirmUrl = `${new URL(req.url).origin}/toss/payment/confirm?billingKey=${encodeURIComponent(billingKey)}&customerKey=${encodeURIComponent(customerKey)}&plan=${plan || 'starter'}`
    console.log('🔄 결제 확인 페이지로 리다이렉트:', confirmUrl)
    return Response.redirect(confirmUrl, 302)
  } catch (e) {
    console.error('Billing return error:', e)
    return new Response('Bad Request', { status: 400 })
  }
}

// 기존 POST 요청도 유지 (하위 호환성) - GET과 동일한 로직 적용
const bodySchema = z.object({ authKey: z.string().min(3), customerKey: z.string().min(1), plan: z.string().optional() })

export async function POST(req: Request) {
  try {
    const input = bodySchema.parse(await req.json())
    const { authKey, customerKey, plan } = input
    
    const secret = process.env.TOSS_SECRET_KEY
    if (!secret) return new Response('TOSS_SECRET_KEY missing', { status: 500 })

    // Exchange authKey -> billingKey
    const auth = Buffer.from(`${secret}:`).toString('base64')
    const res = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey, customerKey })
    })
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      console.error('POST - Billing key issue failed:', errorText)
      return new Response(errorText || 'Billing issue failed', { status: 400 })
    }
    
    const response = await res.json()
    const billingKey = response?.billingKey as string | undefined
    
    if (!billingKey) {
      return new Response('No billingKey in response', { status: 400 })
    }

    // 빌링키 발급 성공 → 결제 확인 페이지로 리다이렉트 (GET과 동일)
    console.log('POST - 빌링키 발급 성공, 결제 확인 페이지로 이동:', { billingKey, customerKey, plan })
    
    // 구독 정보만 먼저 저장 (결제는 아직 안 함)
    try {
      const userId = customerKey.replace('user_', '')
      const supabase = await supabaseServer()
      
      // 구독 정보 저장 (status: pending)
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: plan || 'starter',
        billing_key: billingKey,
        status: 'pending', // 결제 대기 상태
        toss_customer_key: customerKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      
      console.log('POST - 구독 정보 저장 완료 (결제 대기 상태)')
      
    } catch (error) {
      console.error('POST - 구독 정보 저장 실패:', error)
    }

    // 결제 확인 페이지 URL을 JSON으로 응답 (POST는 리다이렉트 불가)
    const confirmUrl = `${new URL(req.url).origin}/toss/payment/confirm?billingKey=${encodeURIComponent(billingKey)}&customerKey=${encodeURIComponent(customerKey)}&plan=${plan || 'starter'}`
    console.log('POST - 결제 확인 페이지 URL 응답:', confirmUrl)
    
    return Response.json({ 
      success: true,
      billingKey,
      customerKey,
      plan: plan || 'starter',
      redirectUrl: confirmUrl
    })
    
  } catch (e) {
    console.error('POST - Billing return error:', e)
    return new Response('Bad Request', { status: 400 })
  }
}


