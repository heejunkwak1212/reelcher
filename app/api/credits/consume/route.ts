import { z } from 'zod'
import { db } from '@/db'
import { credits } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

const bodySchema = z.object({
  userId: z.string().uuid(),
  reserve: z.number().int().nonnegative().default(0),
  commit: z.number().int().nonnegative().default(0),
  rollback: z.number().int().nonnegative().default(0),
})

// MVP: simple non-transactional flow per request. Later: wrap in SERIALIZABLE tx with SKIP LOCKED.
export async function POST(req: Request) {
  try {
    const data = bodySchema.parse(await req.json())
    const [row] = await db.select().from(credits).where(eq(credits.userId, data.userId))
    if (!row) return Response.json({ error: 'NotFound' }, { status: 404 })

    let balance = row.balance || 0
    let reserved = row.reserved || 0
    // Monthly grant: if month changed since lastGrantAt, top up to monthlyGrant
    const monthlyGrant = row.monthlyGrant || 0
    if (monthlyGrant > 0) {
      const now = new Date()
      const last = row.lastGrantAt ? new Date(row.lastGrantAt as any) : null
      const changed = !last || (last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth())
      if (changed) {
        balance += monthlyGrant
      }
    }

    if (data.reserve) {
      if (balance < data.reserve) return Response.json({ error: 'Insufficient' }, { status: 402 })
      balance -= data.reserve
      reserved += data.reserve
    }
    if (data.commit) {
      if (reserved < data.commit) return Response.json({ error: 'BadCommit' }, { status: 400 })
      reserved -= data.commit
    }
    if (data.rollback) {
      const giveBack = Math.min(reserved, data.rollback)
      reserved -= giveBack
      balance += giveBack
    }

    await db.update(credits).set({ balance, reserved, lastGrantAt: new Date() as any }).where(eq(credits.userId, data.userId))
    return Response.json({ balance, reserved })
  } catch (e) {
    return Response.json({ error: 'BadRequest' }, { status: 400 })
  }
}

