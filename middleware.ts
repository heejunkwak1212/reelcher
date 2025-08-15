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
    const isPublic = pathname.startsWith('/sign-in') || pathname.startsWith('/callback') || pathname === '/'

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

  // 4. 사용자의 프로필 정보(온보딩 여부, 역할)를 한 번에 가져옵니다.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed, role')
    .eq('user_id', user.id)
    .single()

  // 5. 온보딩(Onboarding) 관련 로직을 처리합니다.
  const onboardingCompleted = profile?.onboarding_completed === true

  if (onboardingCompleted) {
    // 온보딩을 마친 사용자가 /onboarding 페이지에 접근하면 대시보드로 보냅니다.
    if (pathname.startsWith('/onboarding')) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } else {
    // 온보딩을 마치지 않은 사용자는 /onboarding 페이지로 강제 이동시킵니다.
    if (!pathname.startsWith('/onboarding')) {
      const url = req.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  // 6. 관리자(Admin) 페이지 접근을 제어합니다.
  if (pathname.startsWith('/admin')) {
    // 프로필 역할이 'admin'이 아니면 홈페이지로 보냅니다.
    if (profile?.role !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // 7. 모든 검사를 통과한 경우, 요청을 그대로 진행합니다.
  return res
}

// 8. 미들웨어가 실행될 경로를 지정합니다.
// 불필요한 경로(이미지, 정적 파일 등)에서는 실행되지 않아 성능이 최적화됩니다.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}