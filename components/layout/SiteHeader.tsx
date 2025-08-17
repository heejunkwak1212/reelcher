import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import NavAnchor from '@/components/layout/NavAnchor'

export default async function SiteHeader() {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }))
  const user = data?.user

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <Link href="/" prefetch={true} className="flex items-center gap-0.1 hover:opacity-80 transition-opacity">
            <picture>
              <source srcSet="/logo.svg" type="image/svg+xml" />
              <img 
                src="/icon-64" 
                alt="Reelcher" 
                className="w-10 h-10"
              />
            </picture>
            <span className="font-bold text-xl">Reelcher</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center justify-center gap-10 text-base font-medium" style={{ color: '#3A3B3F' }}>
          <NavAnchor target="top">메인</NavAnchor>
          <NavAnchor target="features">기능</NavAnchor>
          <NavAnchor target="pricing">가격</NavAnchor>
        </nav>
        <div className="flex items-center justify-end gap-3">
          {!user ? (
            <Link href="/sign-in" prefetch={true} className="text-sm" style={{ color: '#3A3B3F' }}>로그인</Link>
          ) : (
            <Link href="/dashboard" prefetch={true} className="text-sm" style={{ color: '#3A3B3F' }}>대시보드</Link>
          )}
          <Link href={user ? '/search' : '/sign-in'} prefetch={true}>
            <Button className="h-9 px-4 rounded-full bg-black text-white hover:bg-black/90 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">{user ? '검색 바로가기' : '무료로 시작하기'}</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}


