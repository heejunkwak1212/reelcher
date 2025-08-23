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

    // 성공 시 리다이렉트 또는 JSON 응답
    return Response.json({ 
      success: true,
      billingKey,
      customerKey,
      plan 
    })
  } catch (e) {
    console.error('Billing return error:', e)
    return new Response('Bad Request', { status: 400 })
  }
}

// 기존 POST 요청도 유지 (하위 호환성)
const bodySchema = z.object({ authKey: z.string().min(3), customerKey: z.string().min(1) })

export async function POST(req: Request) {
  try {
    const input = bodySchema.parse(await req.json())
    const secret = process.env.TOSS_SECRET_KEY
    if (!secret) return new Response('TOSS_SECRET_KEY missing', { status: 500 })

    // Exchange authKey -> billingKey
    const auth = Buffer.from(`${secret}:`).toString('base64')
    const res = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey: input.authKey, customerKey: input.customerKey })
    })
    if (!res.ok) {
      const t = await res.text().catch(()=>'')
      return new Response(t || 'Billing issue failed', { status: 400 })
    }
    const j = await res.json()
    const billingKey = j?.billingKey as string | undefined
    if (!billingKey) return new Response('No billingKey', { status: 400 })
    return Response.json({ billingKey })
  } catch (e) {
    return new Response('Bad Request', { status: 400 })
  }
}


