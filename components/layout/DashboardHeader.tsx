"use client"

import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

export function DashboardHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60" style={{ height: '57px' }}>
      <div className="max-w-7xl mx-auto px-6 h-full">
        <div className="flex h-full items-center justify-between">
          {/* 좌측 로고 */}
          <div className="flex items-center -ml-6">
            <Link href="/" className="flex items-center space-x-2">
              <Logo />
            </Link>
          </div>

          {/* 우측 새 검색 시작 버튼 */}
          <div className="flex items-center">
            <Link href="/search">
              <Button size="sm" className="gap-2">
                <Search className="h-4 w-4" />
                새 검색 시작
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
