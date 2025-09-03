import Link from 'next/link'
import QueryProvider from '@/components/QueryProvider'
import { Toaster } from '@/components/ui/sonner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <main>
        <QueryProvider>{children}</QueryProvider>
      </main>
      <Toaster />
    </div>
  )
}


