import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr]">
      <header className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold" prefetch={false}>Relcher Admin</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" prefetch={false}>요약</Link>
            <Link href="/admin/users" prefetch={false}>사용자</Link>
            <Link href="/admin/searches" prefetch={false}>검색</Link>
            <Link href="/admin/credits" prefetch={false}>크레딧</Link>
            <Link href="/admin/payments" prefetch={false}>결제</Link>
          </nav>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  )
}


