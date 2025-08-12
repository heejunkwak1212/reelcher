import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr]">
      <header className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">Relcher</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard">대시보드</Link>
            <Link href="/search-test">검색 테스트</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}


