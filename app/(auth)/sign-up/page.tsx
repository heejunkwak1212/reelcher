'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { supabaseBrowser } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Eye, EyeOff, Mail, Lock, User, CheckCircle, XCircle } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [emailChecked, setEmailChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Check if user is already logged in and redirect to dashboard
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.replace('/dashboard')
      }
    }
    checkUser()
  }, [supabase, router])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요'
    }

    if (!formData.email.trim()) {
      newErrors.email = '이메일을 입력해주세요'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '유효한 이메일 형식이 아닙니다'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '전화번호를 입력해주세요'
    } else if (!/^010-\d{4}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = '010-0000-0000 형식으로 입력해주세요'
    }

    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요'
    } else if (formData.password.length < 8) {
      newErrors.password = '8자 이상의 비밀번호를 입력해주세요'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호 확인을 입력해주세요'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다'
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = '이용약관 및 개인정보처리방침에 동의해주세요'
    }

    if (!emailChecked || emailStatus !== 'available') {
      newErrors.email = '이메일 중복 확인을 완료해주세요'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const checkEmailDuplicate = async () => {
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: '오류',
        description: '유효한 이메일을 입력해주세요',
        variant: 'destructive',
      })
      return
    }

    setEmailStatus('checking')
    setEmailChecked(false)

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check email')
      }

      if (data.isDuplicate) {
        setEmailStatus('taken')
        setEmailChecked(false)
      } else {
        setEmailStatus('available')
        setEmailChecked(true)
      }
    } catch (error) {
      console.error('Email check error:', error)
      setEmailStatus('idle')
      setEmailChecked(false)
      toast({
        title: '오류',
        description: '이메일 확인 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    }
  }

  const handleEmailChange = (email: string) => {
    // 한글 및 특수문자 필터링 (이메일에 허용되는 문자만 허용)
    const filteredEmail = email.replace(/[^a-zA-Z0-9@._-]/g, '')
    setFormData(prev => ({ ...prev, email: filteredEmail }))
    if (emailChecked) {
      setEmailStatus('idle')
      setEmailChecked(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)

    try {
      // Admin client로 이메일 확인 없이 직접 사용자 생성
      const adminResponse = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        }),
      })

      const result = await adminResponse.json()

      if (!adminResponse.ok) {
        throw new Error(result.error || 'Failed to create user')
      }

      const { data, error } = result

      if (error) {
        throw error
      }

      if (data.user) {
        toast({
          title: '회원가입 완료',
          description: '가입이 완료되었습니다. 바로 로그인할 수 있습니다.',
        })
        router.push('/sign-in?message=signup-success')
      }
    } catch (error: any) {
      console.error('Sign up error:', error)
      toast({
        title: '회원가입 실패',
        description: error.message || '회원가입 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSocialAuth = async (provider: 'google' | 'kakao') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        throw error
      }
    } catch (error: any) {
      console.error('Social auth error:', error)
      toast({
        title: '소셜 로그인 실패',
        description: error.message || '소셜 로그인 중 오류가 발생했습니다',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">릴처 회원가입</h1>
          </div>

          {/* Required Info Section */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-sm font-medium text-gray-700">필수정보입력</span>
            </div>
            <div className="w-full h-px bg-gray-200"></div>
          </div>

          {/* Form */}
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                이름
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="pl-10 h-10 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="실명을 입력해주세요"
                />
              </div>
              {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
            </div>

            {/* Phone Field */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                전화번호
              </Label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    // 전화번호 형식 자동 변환
                    let value = e.target.value.replace(/[^\d]/g, '')
                    if (value.length >= 3) {
                      value = value.replace(/(\d{3})(\d{0,4})(\d{0,4})/, (match, p1, p2, p3) => {
                        if (p3) return `${p1}-${p2}-${p3}`
                        if (p2) return `${p1}-${p2}`
                        return p1
                      })
                    }
                    setFormData(prev => ({ ...prev, phone: value }))
                  }}
                  className="pl-10 h-10 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="010-0000-0000"
                  maxLength={13}
                />
              </div>
              {errors.phone && <p className="text-red-500 text-xs">{errors.phone}</p>}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                이메일
              </Label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="pl-10 h-10 border-gray-200 focus:border-black focus:ring-black"
                    placeholder="이메일을 입력해주세요"
                  />
                  {emailStatus === 'available' && (
                    <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {emailStatus === 'taken' && (
                    <XCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
                  )}
                </div>
                <Button
                  type="button"
                  onClick={checkEmailDuplicate}
                  disabled={emailStatus === 'checking' || !formData.email || emailStatus === 'available'}
                  className={`h-10 px-3 border transition-colors text-xs ${
                    emailStatus === 'available' 
                      ? 'bg-green-50 border-green-200 text-green-700 cursor-not-allowed' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                  }`}
                  variant="outline"
                >
                  {emailStatus === 'checking' ? '확인 중...' : 
                   emailStatus === 'available' ? '확인 완료' : '중복확인'}
                </Button>
              </div>
              {emailStatus === 'available' && (
                <p className="text-green-600 text-xs">
                  중복 확인 완료
                </p>
              )}
              {emailStatus === 'taken' && (
                <p className="text-red-500 text-xs">
                  중복된 이메일입니다.
                </p>
              )}
              {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
            </div>

            {/* Password Field */}
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
                  className="pl-10 pr-10 h-10 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="8자 이상의 비밀번호를 입력해주세요"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">8자 이상의 비밀번호를 입력해주세요</p>
              {errors.password && <p className="text-red-500 text-xs">{errors.password}</p>}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                비밀번호 확인
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="pl-10 pr-10 h-10 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="비밀번호를 다시 입력해주세요"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs">{errors.confirmPassword}</p>}
            </div>

            {/* Terms Agreement */}
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreeTerms"
                  checked={formData.agreeTerms}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreeTerms: !!checked }))}
                  className="mt-1"
                />
                <Label htmlFor="agreeTerms" className="text-sm text-gray-600 leading-relaxed">
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-black underline hover:no-underline">
                    이용약관
                  </Link>
                  {' '}및{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-black underline hover:no-underline">
                    개인정보처리방침
                  </Link>
                  에 동의합니다
                </Label>
              </div>
              {errors.agreeTerms && <p className="text-red-500 text-xs">{errors.agreeTerms}</p>}
            </div>

            {/* Sign Up Button */}
            <Button
              type="submit"
              disabled={loading || !emailChecked || emailStatus !== 'available'}
              className="w-full h-10 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? '가입 중...' : '회원가입'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="px-4 text-sm text-gray-500">또는</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Social Auth Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => handleSocialAuth('google')}
              className="w-full h-10 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-medium rounded-lg transition-colors"
              variant="outline"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 가입하기
            </Button>

            <Button
              type="button"
              onClick={() => handleSocialAuth('kakao')}
              className="w-full h-10 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
              </svg>
              Kakao로 가입하기
            </Button>
          </div>

          {/* Sign In Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <Link href="/sign-in" className="text-black font-medium hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
