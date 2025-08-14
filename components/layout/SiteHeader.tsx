import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import NavAnchor from '@/components/layout/NavAnchor'

export default async function SiteHeader() {
  const supabase = supabaseServer()
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }))
  const user = data?.user

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 grid grid-cols-3 items-center">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-6 rounded-full border flex items-center justify-center">
              <span className="text-xs">⚡</span>
            </div>
            <span className="font-semibold">Reelcher</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center justify-center gap-8 text-sm" style={{ color: '#3A3B3F' }}>
          <NavAnchor target="top">메인</NavAnchor>
          <NavAnchor target="features">기능</NavAnchor>
          <NavAnchor target="pricing">가격</NavAnchor>
        </nav>
        <div className="flex items-center justify-end gap-3">
          {!user ? (
            <Link href="/sign-in" className="text-sm" style={{ color: '#3A3B3F' }}>로그인</Link>
          ) : (
            <Link href="/dashboard" className="text-sm" style={{ color: '#3A3B3F' }}>대시보드</Link>
          )}
          <Link href={user ? '/search' : '/sign-in'}>
            <Button className="h-9 px-4 rounded-full bg-black text-white hover:bg-black/90">{user ? '검색 바로가기' : '무료로 시작하기'}</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}


