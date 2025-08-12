import crypto from 'crypto'
import { z } from 'zod'
import { db } from '@/db'
import { credits } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const tossSchema = z.object({
  eventType: z.string(),
  orderId: z.string(),
  userId: z.string(),
  amount: z.number().int().nonnegative(),
  creditDelta: z.number().int().nonnegative().default(0),
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

    // Idempotency: use orderId as natural key via upsert-like safe update
    // For MVP, we just apply creditDelta if any
    if (payload.creditDelta > 0) {
      const [row] = await db.select().from(credits).where(eq(credits.userId, payload.userId))
      if (row) {
        await db.update(credits).set({ balance: (row.balance || 0) + payload.creditDelta }).where(eq(credits.userId, payload.userId))
      }
    }
    return Response.json({ ok: true })
  } catch (e) {
    const err: any = e
    if (Array.isArray(err?.issues)) return Response.json({ error: 'ValidationError', issues: err.issues }, { status: 400 })
    return Response.json({ error: err?.message || 'BadRequest' }, { status: 400 })
  }
}


