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
      console.log(`🔍 OAuth 콜백 - 사용자 ${user.id}, 프로필 존재:`, rows.length > 0)
      
      if (!rows.length || rows[0]?.onboardingCompleted !== true) {
        console.log(`📝 온보딩으로 리다이렉트: 프로필 없음=${!rows.length}, 온보딩 미완료=${rows[0]?.onboardingCompleted !== true}`)
        return Response.redirect(new URL('/onboarding', req.url))
      }
      console.log(`✅ 대시보드로 리다이렉트: 온보딩 완료된 사용자`)
      return Response.redirect(new URL(next || '/dashboard', req.url))
    }
  } catch (error) {
    console.error('🚫 OAuth 콜백 에러:', error)
  }
  return Response.redirect(new URL('/sign-in', req.url))
}


