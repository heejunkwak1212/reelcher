import Link from 'next/link'
import QueryProvider from '@/components/QueryProvider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <main>
        <QueryProvider>{children}</QueryProvider>
      </main>
    </div>
  )
}


