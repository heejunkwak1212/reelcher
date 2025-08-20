import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // 1. 응답(response) 객체를 생성하고, Edge에 최적화된 Supabase 클라이언트를 초기화합니다.
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )

  // 2. 사용자의 세션 정보를 가져옵니다.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = req.nextUrl

  // 3. 로그아웃 상태일 때의 로직을 처리합니다.
  if (!user) {
    // 공개된 경로인지 확인합니다.
    const isPublic = pathname.startsWith('/sign-in') || 
                     pathname.startsWith('/sign-up') || 
                     pathname.startsWith('/callback') || 
                     pathname === '/' ||
                     pathname.startsWith('/terms') ||
                     pathname.startsWith('/privacy') ||
                     pathname.startsWith('/pricing') ||
                     pathname.startsWith('/contact') ||
                     pathname.startsWith('/faq')

    // 공개된 경로가 아니라면 로그인 페이지로 보냅니다.
    if (!isPublic) {
      const url = req.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }

    // 공개된 경로라면 그대로 통과시킵니다.
    return res
  }

  // --- 여기서부터는 로그인한 사용자만 실행됩니다. ---

  // 4. 프로필 정보를 조회합니다 (인증된 사용자의 접근 제어를 위해)
  let profile = null
  const needsProfileCheck = !pathname.startsWith('/callback')
  
  if (needsProfileCheck) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('onboarding_completed, role, is_verified')
      .eq('user_id', user.id)
      .single()
    profile = profileData
  }

  // 5. 인증 완료된 사용자가 sign-up, verify 페이지 접근시 대시보드로 리다이렉트
  if (profile?.is_verified && (pathname.startsWith('/sign-up') || pathname.startsWith('/verify'))) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // 6. 온보딩(Onboarding) 관련 로직을 처리합니다.
  if (pathname.startsWith('/onboarding')) {
    const onboardingCompleted = profile?.onboarding_completed === true
    if (onboardingCompleted) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } else if (needsProfileCheck && profile?.onboarding_completed === false) {
    // 온보딩이 완료되지 않은 사용자는 온보딩 페이지로 리다이렉트
    const url = req.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // 7. 관리자(Admin) 페이지 접근을 제어합니다.
  if (pathname.startsWith('/admin')) {
    if (profile?.role !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // 8. 모든 검사를 통과한 경우, 요청을 그대로 진행합니다.
  return res
}

// 9. 미들웨어가 실행될 경로를 지정합니다.
// 불필요한 경로(이미지, 정적 파일 등)에서는 실행되지 않아 성능이 최적화됩니다.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}