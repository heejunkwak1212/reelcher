'use client'

import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import NavAnchor from '@/components/layout/NavAnchor'
import { useEffect, useState } from 'react'

export default function SiteHeader() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
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
        <div className="flex items-center gap-2">
          <Link href="/" prefetch={true} className="flex items-center gap-0.05 hover:opacity-80 transition-opacity">
            <picture>
              <source srcSet="/logo.svg" type="image/svg+xml" />
              <source srcSet="/favicon-64x64.png" type="image/png" />
              <img 
                src="/icon-64" 
                alt="Reelcher Logo" 
                className="w-10 h-10 flex-shrink-0"
                loading="eager"
                decoding="sync"
                style={{
                  imageRendering: 'crisp-edges'
                } as React.CSSProperties & {
                  WebkitImageRendering?: string;
                  MozImageRendering?: string;
                  msImageRendering?: string;
                }}
                onError={(e) => {
                  // Fallback chain
                  const target = e.target as HTMLImageElement;
                  if (target.src.includes('icon-64')) {
                    target.src = '/favicon-64x64.png';
                  } else if (target.src.includes('favicon-64x64.png')) {
                    target.src = '/favicon-32x32.png';
                  } else if (target.src.includes('favicon-32x32.png')) {
                    // Last resort: create a simple text-based logo
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.text-logo-fallback')) {
                      const textLogo = document.createElement('div');
                      textLogo.className = 'text-logo-fallback w-10 h-10 bg-black text-white rounded flex items-center justify-center font-bold text-sm';
                      textLogo.textContent = 'R';
                      parent.insertBefore(textLogo, target);
                    }
                  }
                }}
              />
            </picture>
            <span className="font-bold text-xl text-black">Reelcher</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center justify-center gap-10 text-base font-medium" style={{ color: '#3A3B3F' }}>
          <NavAnchor target="top">메인</NavAnchor>
          <NavAnchor target="features">기능</NavAnchor>
          <NavAnchor target="pricing">가격</NavAnchor>
        </nav>
        <div className="flex items-center justify-end gap-3">
          {loading ? (
            <div className="w-12 h-6 bg-gray-200 rounded animate-pulse"></div>
          ) : !user ? (
            <Link href="/sign-in" prefetch={true} className="text-sm" style={{ color: '#3A3B3F' }}>로그인</Link>
          ) : (
            <Link href="/dashboard" prefetch={true} className="text-sm" style={{ color: '#3A3B3F' }}>대시보드</Link>
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


