import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  // Sidebar cards data (best-effort)
  let plan: string = 'free'
  let balance = 0
  try {
    const { data: prof } = await ssr.from('profiles').select('plan').single()
    plan = (prof?.plan as string) || 'free'
  } catch {}
  try {
    const { data: cr } = await ssr.from('credits').select('balance').single()
    balance = Number(cr?.balance || 0)
  } catch {}

  const NavItem = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
    <Link href={href} className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-neutral-100 text-sm text-neutral-800">
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  )

  const IconHistory = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/><path d="M12 7v5l3 3"/>
    </svg>
  )
  const IconBilling = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
    </svg>
  )
  const IconSettings = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 2.8l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10 1.68V1a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.07 1.51h.01c.55.22 1.18.1 1.62-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.43.44-.55 1.07-.33 1.62v.01c.22.55.72.94 1.27 1.07H21a2 2 0 1 1 0 4h-.09c-.71 0-1.31.39-1.51 1Z"/>
    </svg>
  )

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="border-r bg-white">
        <div className="px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-neutral-900">
            <span className="inline-block w-5 h-5 rounded-sm bg-black" aria-hidden />
            <span>릴처</span>
          </Link>
        </div>
        <div className="h-px bg-neutral-200 mx-4" />
        <nav className="px-2 py-3 space-y-1">
          <NavItem href="/dashboard/history" icon={IconHistory} label="사용 이력" />
          <NavItem href="/dashboard/billing" icon={IconBilling} label="구독 관리" />
          <NavItem href="/dashboard/settings" icon={IconSettings} label="설정" />
        </nav>
        <div className="px-4 py-4">
          <div className="border rounded-lg p-3 text-sm">
            <div className="text-neutral-500">플랜</div>
            <div className="font-medium mb-2 capitalize">{plan}</div>
            <div className="text-neutral-500">잔액</div>
            <div className="font-semibold">{balance.toLocaleString()}</div>
            <div className="mt-3">
              <Link href="/dashboard/billing" className="inline-flex items-center justify-center w-full px-3 py-2 text-sm rounded-md bg-neutral-900 text-white hover:bg-neutral-800">구독/충전</Link>
            </div>
          </div>
        </div>
      </aside>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  )
}


