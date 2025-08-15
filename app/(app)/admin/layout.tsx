'use client'

import { AdminSidebar } from '@/components/ui/admin-sidebar'
import { useEffect, useState } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)

  useEffect(() => {
    async function loadUserData() {
      try {
        const userRes = await fetch('/api/me')
        
        if (userRes.ok) {
          const userData = await userRes.json()
          setUser(userData)
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
      <AdminSidebar 
        user={user} 
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


