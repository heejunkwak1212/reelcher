'use client'

import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import NavAnchor from '@/components/layout/NavAnchor'
import { useEffect, useState } from 'react'
import { ResponsiveLogo } from '@/components/ui/logo'
import { useRouter } from 'next/navigation'

export default function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  useEffect(() => {
    const supabase = supabaseBrowser()
    
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
      setLoading(false)
    }
    
    getUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    
    return () => subscription.unsubscribe()
  }, [])

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 grid grid-cols-3 items-center">
        <div className="flex items-center">
          <Link href="/" prefetch={true} className="hover:opacity-80 transition-opacity">
            <ResponsiveLogo />
          </Link>
        </div>
        <nav className="hidden md:flex items-center justify-center gap-10 text-base font-medium" style={{ color: '#3A3B3F' }}>
          <NavAnchor target="top">메인</NavAnchor>
          <NavAnchor target="features">기능</NavAnchor>
          <NavAnchor target="pricing">가격</NavAnchor>
          <NavAnchor target="faq">FAQ</NavAnchor>
        </nav>
        <div className="flex items-center justify-end gap-3">
          {loading ? (
            <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
          ) : !user ? (
            <Link href="/sign-in" prefetch={true} className="text-sm" style={{ color: '#3A3B3F' }}>로그인</Link>
          ) : (
            <Link href="/dashboard" prefetch={true} className="text-sm font-medium" style={{ color: '#3A3B3F' }}>대시보드</Link>
          )}
          <Link href={user ? '/search' : '/sign-in'} prefetch={true}>
            <Button className="h-9 px-4 rounded-full bg-black text-white hover:bg-black/90 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
              {loading ? '로딩...' : user ? '검색 바로가기' : '무료로 시작하기'}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}


