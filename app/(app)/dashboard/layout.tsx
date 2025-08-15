'use client'

import { supabaseServer } from '@/lib/supabase/server'
import { DashboardSidebar } from '@/components/ui/dashboard-sidebar'
import { useEffect, useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [plan, setPlan] = useState('free')
  const [balance, setBalance] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)

  useEffect(() => {
    async function loadUserData() {
      try {
        const [userRes, profileRes, creditRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/me'),
          fetch('/api/me')
        ])
        
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData)
          setPlan(userData.plan || 'free')
          setBalance(userData.credits || 0)
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
      }
    }

    loadUserData()
  }, [])

  const handleSidebarChange = (isCollapsed: boolean) => {
    setIsSidebarCollapsed(isCollapsed);
  };

  return (
    <div className="min-h-screen flex">
      <DashboardSidebar 
        user={user} 
        plan={plan} 
        balance={balance} 
        onSidebarChange={handleSidebarChange}
      />
      <main className={`flex-1 transition-all duration-200 p-4 md:p-6 ${
        isSidebarCollapsed ? 'ml-12' : 'ml-60'
      }`}>
        {children}
      </main>
    </div>
  )
}


