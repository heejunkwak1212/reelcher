import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Public routes
  const isPublic = pathname.startsWith('/sign-in') || pathname.startsWith('/callback') || pathname === '/'
  // Only gate app pages (not APIs here)
  const isApi = pathname.startsWith('/api')
  if (isApi) return NextResponse.next()

  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return req.cookies.get(name)?.value },
        set(name: string, value: string, options: any) { res.cookies.set({ name, value, ...options }) },
        remove(name: string, options: any) { res.cookies.set({ name, value: '', ...options, maxAge: 0 }) },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

  if (!user) {
    if (!isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }
    return res
  }

  // If user signed-in but onboarding not complete, force to /onboarding (except when already there)
  if (!pathname.startsWith('/onboarding')) {
    try {
      const { data, error } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', user.id).single()
      if (!error && (!data || data.onboarding_completed !== true)) {
        const url = req.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
    } catch {}
  }

  // If onboarding already completed, block manual access to /onboarding
  if (pathname.startsWith('/onboarding')) {
    try {
      const { data, error } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', user.id).single()
      if (!error && data && data.onboarding_completed === true) {
        const url = req.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } catch {}
  }

  // Admin gate
  if (pathname.startsWith('/admin')) {
    try {
      const { data, error } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
      const role = !error ? data?.role : undefined
      if (role !== 'admin') {
        const url = req.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    } catch {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = { matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'] }


