import { supabaseServer } from '@/lib/supabase/server'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/dashboard'
  const supabase = await supabaseServer()
  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch {
      // fallthrough to sign-in on error
    }
  }
  // Decide destination: onboarding if not completed
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const rows = await db.select().from(profiles).where(eq(profiles.userId, user.id))
      if (!rows.length || rows[0]?.onboardingCompleted !== true) {
        return Response.redirect(new URL('/onboarding', req.url))
      }
      return Response.redirect(new URL(next || '/dashboard', req.url))
    }
  } catch {}
  return Response.redirect(new URL('/sign-in', req.url))
}


