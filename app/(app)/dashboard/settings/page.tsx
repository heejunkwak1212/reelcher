'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, Settings as SettingsIcon } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { relcherAlert } from '@/components/ui/relcher-dialog'
import DeleteAccountButton from '@/components/auth/DeleteAccountButton'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/sign-in')
          return
        }

        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name, how_found, plan, created_at')
          .eq('user_id', user.id)
          .single()

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, plan, billing_key')
          .eq('user_id', user.id)
          .single()

        setUser(user)
        setProfile(prof)
        setSubscription(sub)
      } catch (error) {
        console.error('데이터 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const handleLogout = async () => {
    try {
      const supabase = supabaseBrowser()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error) {
      console.error('로그아웃 실패:', error)
      await relcherAlert('로그아웃에 실패했습니다.')
    }
  }

  const hasActiveSubscription = subscription?.status === 'active'

  const getPlanInfo = (plan: string) => {
    switch (plan) {
      case 'starter':
        return { name: 'STARTER 플랜', description: '월 2,000 크레딧' }
      case 'pro':
        return { name: 'PRO 플랜', description: '월 7,000 크레딧' }
      case 'business':
        return { name: 'BUSINESS 플랜', description: '월 20,000 크레딧' }
      default:
        return { name: '무료 플랜', description: '현재 FREE 플랜 적용 중' }
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  const currentPlan = profile?.plan || 'free'
  const planInfo = getPlanInfo(currentPlan)

  return (
    <div className="max-w-4xl mx-auto space-y-8 pt-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-700">설정</h1>
        <p className="text-sm font-medium text-gray-600 mt-1">계정 정보를 확인 및 관리하세요</p>
      </div>

      {/* 계정 정보 섹션 */}
      <Card className="border-gray-200" style={{ backgroundColor: '#F3F4F6' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-700">계정 정보</CardTitle>
          <p className="text-sm font-medium text-gray-600">가입 당시 설정한 계정 정보</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-gray-200 text-gray-600">
                {profile?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">
                {profile?.display_name || '김컴피'}
              </h3>
              <p className="text-sm text-gray-600">
                {user?.email || 'kimcomfy@email.com'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 구독 정보 섹션 */}
      <Card className="border-gray-200" style={{ backgroundColor: '#F3F4F6' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-700">구독 정보</CardTitle>
          <p className="text-sm font-medium text-gray-600">현재 플랜 및 구독 상태를 확인하세요</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex items-center justify-between p-4 bg-white rounded-lg">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-white text-gray-700 border-gray-300">
                {currentPlan.toUpperCase()}
              </Badge>
              <div>
                <h3 className="font-semibold text-gray-800">{planInfo.name}</h3>
                <p className="text-sm text-gray-600">{planInfo.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-sm border-gray-300 hover:bg-gray-50"
                onClick={() => router.push('/dashboard/billing')}
              >
                <SettingsIcon className="w-4 h-4 mr-1" />
                구독 관리
              </Button>
              <Button
                size="sm"
                className="text-sm bg-black text-white hover:bg-gray-800"
                onClick={() => router.push('/pricing')}
              >
                업그레이드 ↗
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 로그아웃 및 회원탈퇴 */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="text-sm border-gray-300 hover:bg-gray-50"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-1" />
          로그아웃
        </Button>
        <DeleteAccountButton hasActiveSubscription={hasActiveSubscription} />
      </div>
    </div>
  )
}


