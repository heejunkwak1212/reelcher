import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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


