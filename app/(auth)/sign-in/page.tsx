"use client"

import { useCallback, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function SignInPage() {
  const [loading, setLoading] = useState<'google' | 'kakao' | null>(null)
  const signIn = useCallback(async (provider: 'google' | 'kakao') => {
    try {
      setLoading(provider)
      const supabase = supabaseBrowser()
      const redirectTo = typeof window !== 'undefined' ? `${location.origin}/callback` : undefined
      await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    } finally {
      setLoading(null)
    }
  }, [])

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm border rounded-lg p-6 space-y-4">
        <h1 className="text-lg font-semibold">로그인</h1>
        <p className="text-sm text-neutral-600">구글 또는 카카오로 로그인하세요.</p>
        <div className="space-y-2">
          <Button className="w-full" onClick={() => signIn('google')} disabled={!!loading}>
            {loading === 'google' ? '구글로 이동 중…' : 'Google로 계속하기'}
          </Button>
          <Button className="w-full" variant="outline" onClick={() => signIn('kakao')} disabled={!!loading}>
            {loading === 'kakao' ? '카카오로 이동 중…' : 'Kakao로 계속하기'}
          </Button>
        </div>
      </div>
    </div>
  )
}


