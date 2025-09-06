"use client"

import { useCallback, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/ui/logo'
import { toast } from '@/hooks/use-toast'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<'email' | 'google' | 'kakao' | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [emailError, setEmailError] = useState('')

  // Check for email verification message
  const message = searchParams.get('message')

  // 로그인된 사용자는 middleware에서 자동 리다이렉트됨

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('') // Clear previous error
    
    if (!formData.email || !formData.password) {
      toast({
        title: '입력 오류',
        description: '이메일과 비밀번호를 모두 입력해주세요',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading('email')
      const supabase = supabaseBrowser()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        throw error
      }

      if (data.user) {
        toast({
          title: '로그인 성공',
          description: '환영합니다!',
        })
        router.push('/dashboard')
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      if (error.message === 'Invalid login credentials') {
        setEmailError('이메일이 올바르지 않습니다.')
      } else if (error.message === 'Email not confirmed') {
        // 자동으로 이메일 확인 처리 후 바로 로그인
        try {
          const confirmResponse = await fetch('/api/auth/confirm-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: formData.email }),
          })

          if (confirmResponse.ok) {
            // 확인 처리 완료 후 자동으로 다시 로그인 시도
            const supabase = supabaseBrowser()
            const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
              email: formData.email,
              password: formData.password,
            })

            if (retryError) {
              setEmailError('로그인에 실패했습니다. 다시 시도해주세요.')
            } else if (retryData.user) {
              toast({
                title: '로그인 성공',
                description: '환영합니다!',
              })
              router.push('/dashboard')
            }
          } else {
            setEmailError('계정 활성화에 문제가 있습니다.')
          }
        } catch (retryError) {
          setEmailError('로그인 중 오류가 발생했습니다.')
        }
      } else {
        toast({
          title: '로그인 실패',
          description: error.message || '로그인 중 오류가 발생했습니다',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(null)
    }
  }

  const signInWithProvider = useCallback(async (provider: 'google' | 'kakao') => {
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-9">
            <div className="flex justify-center mb-2">
              <Logo size="2xl" showText={true} />
            </div>
            <div className="space-y-2.5">
              <h1 className="text-xl font-semibold">간편하게 시작해보세요</h1>
              <p className="text-sm font-normal text-neutral-600">
                카카오 계정으로 빠르게 로그인하고<br />
                모든 기능을 이용해보세요
              </p>
            </div>
          </div>

          {/* Signup success message */}
          {message === 'signup-success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm text-center">
                회원가입이 완료되었습니다! 바로 로그인하세요.
              </p>
            </div>
          )}
          {message === 'check-email' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm text-center">
                가입이 완료됐어요! 로그인해주세요.
              </p>
            </div>
          )}

          {/* Email/Password Form - TEMPORARILY DISABLED */}
          {/* 
          <form onSubmit={signInWithEmail} className="space-y-5 mb-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="pl-10 h-12 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="이메일을 입력해주세요"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                비밀번호
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10 pr-10 h-12 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="비밀번호를 입력해주세요"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className={`space-y-4 ${emailError ? 'mt-6' : 'mt-5'}`}>
              {emailError && (
                <div className="flex justify-center">
                  <p className="text-red-500 text-xs font-medium text-center">
                    {emailError}
                  </p>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading === 'email'}
                className="w-full h-12 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
              >
                {loading === 'email' ? '로그인 중...' : '로그인'}
              </Button>
            </div>
          </form>

          <div className="text-center mb-6">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <Link href="/sign-up" className="text-black font-medium hover:underline">
                회원가입
              </Link>
            </p>
          </div>

          <div className="flex items-center mb-6">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-sm text-gray-500">또는</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>
          */}

          {/* Social Login Buttons - Only Kakao */}
          <div className="mb-6">
            <Button
              type="button"
              onClick={(e) => { e.preventDefault(); signInWithProvider('kakao') }}
              disabled={!!loading}
              className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
              </svg>
              {loading === 'kakao' ? 'Kakao로 이동 중...' : 'Kakao로 계속하기'}
            </Button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-4"></div>

          {/* Footer Links */}
          <div className="text-center space-x-4">
            <button 
              type="button"
              onClick={() => window.open('/terms', '_blank', 'noopener,noreferrer')}
              className="text-sm font-normal text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              이용약관
            </button>
            <button 
              type="button"
              onClick={() => window.open('/privacy', '_blank', 'noopener,noreferrer')}
              className="text-sm font-normal text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              개인정보처리방침
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


