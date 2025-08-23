import crypto from 'crypto'
import { z } from 'zod'
import { db } from '@/db'
import { credits } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const tossSchema = z.object({
  eventType: z.string(),
  data: z.object({
    paymentKey: z.string(),
    orderId: z.string(),
    amount: z.number().int().nonnegative(),
    status: z.string(),
    customerKey: z.string().optional(),
  })
})

function verifySignature(req: Request, body: string) {
  const secret = process.env.TOSS_WEBHOOK_SECRET || ''
  const sig = req.headers.get('x-toss-signature') || ''
  if (!secret || !sig) return false
  const h = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig))
}

export async function POST(req: Request) {
  const bodyText = await req.text()
  try {
    if (!verifySignature(req, bodyText)) return new Response('Invalid signature', { status: 401 })
    const payload = tossSchema.parse(JSON.parse(bodyText))

    // 토스 웹훅 이벤트 처리
    console.log('Toss webhook received:', payload)
    
    const { eventType, data } = payload
    const { orderId, amount, status, paymentKey } = data
    
    // 결제 완료 이벤트 처리
    if (eventType === 'PAYMENT_STATUS_CHANGED' && status === 'DONE') {
      console.log(`Payment completed: orderId=${orderId}, amount=${amount}`)
      
      // 구독 결제인 경우 (orderId가 subscription_으로 시작)
      if (orderId.startsWith('subscription_')) {
        // 이미 자동결제 API에서 크레딧 지급이 처리되므로 여기서는 로그만 기록
        console.log(`Subscription payment confirmed via webhook: ${orderId}`)
      }
      
      // 멱등성을 위해 orderId로 중복 처리 방지
      // 실제 구현에서는 processed_orders 테이블 등으로 관리할 수 있음
    }
    
    return Response.json({ ok: true })
  } catch (e) {
    const err: any = e
    if (Array.isArray(err?.issues)) return Response.json({ error: 'ValidationError', issues: err.issues }, { status: 400 })
    return Response.json({ error: err?.message || 'BadRequest' }, { status: 400 })
  }
}


