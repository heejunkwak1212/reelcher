import { z } from 'zod'
import { db } from '@/db'
import { profiles, users, credits } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const bodySchema = z.object({
  displayName: z.string().trim().min(1),
  howFound: z.string().trim().optional().default(''),
  role: z.literal('user'),
})

export async function POST(req: Request) {
  try {
    const input = bodySchema.parse(await req.json())
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Ensure users row exists (id/email)
    const uid = user.id as unknown as string
    const email = user.email || null
    const existingUser = await db.select().from(users).where(eq(users.id, uid as any))
    if (!existingUser.length) {
      await db.insert(users).values({ id: uid, email })
    }

    // 닉네임 중복 체크 제거 - 이메일만 고유하면 가입 가능

    // Upsert profile (role forced to 'user')
    const existingProfile = await db.select().from(profiles).where(eq(profiles.userId, uid as any))
    if (!existingProfile.length) {
      await db.insert(profiles).values({ userId: uid, displayName: input.displayName, howFound: input.howFound, role: 'user', onboardingCompleted: true })
    } else {
      await db.update(profiles).set({ displayName: input.displayName, howFound: input.howFound, role: 'user', onboardingCompleted: true }).where(eq(profiles.userId, uid))
    }

    // Ensure credits row exists with 30-day cycle setup
    const existingCredits = await db.select().from(credits).where(eq(credits.userId, uid as any))
    if (!existingCredits.length) {
      const today = new Date()
      const cycleStartDate = today.toISOString().split('T')[0] // YYYY-MM-DD
      const nextGrantDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      
      await db.insert(credits).values({ 
        userId: uid, 
        balance: 250, 
        reserved: 0, 
        monthlyGrant: 250, 
        lastGrantAt: new Date() as any,
        cycleStartDate: cycleStartDate,
        nextGrantDate: nextGrantDate
      })
    }

    return Response.json({ ok: true })
  } catch (e) {
    const err: any = e
    if (Array.isArray(err?.issues)) return Response.json({ error: 'ValidationError', issues: err.issues }, { status: 400 })
    return Response.json({ error: err?.message || 'BadRequest' }, { status: 400 })
  }
}

export async function GET(req: Request) {
  // 닉네임 중복 체크 비활성화 - 항상 사용 가능으로 반환
  return Response.json({ ok: true })
}


