"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { User } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [howFound, setHowFound] = useState('')
  const [role, setRole] = useState('user')
  const [submitting, setSubmitting] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)

  const submit = async () => {
    if (!displayName.trim()) {
      toast({
        title: '오류',
        description: '닉네임을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }
    if (!agreeTerms || !agreePrivacy) {
      toast({
        title: '오류',
        description: '필수 약관에 동의해 주세요.',
        variant: 'destructive',
      })
      return
    }
    
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, howFound, role, agreeMarketing }),
      })
      
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `요청 실패 (${res.status})`)
      }
      
      toast({
        title: '온보딩 완료',
        description: '환영합니다! 릴처를 시작해보세요.',
      })
      router.replace('/dashboard')
    } catch (e) {
      toast({
        title: '오류',
        description: (e as Error).message,
        variant: 'destructive',
      })
    } finally { 
      setSubmitting(false) 
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">릴처에 오신 것을 환영해요</h1>
            <p className="text-gray-600 text-sm">간단한 정보를 입력해주세요</p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Nickname Field */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium text-gray-700">
                닉네임
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10 h-12 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="사용하실 닉네임을 입력해주세요"
                />
              </div>
            </div>

            {/* How Found Field */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">
                어디서 알게 되셨나요?
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {['유튜브', '스레드', '인스타그램', '기타'].map((option) => (
                  <label 
                    key={option} 
                    className={`flex items-center justify-center gap-2 border-2 rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                      howFound === option 
                        ? 'border-black bg-black text-white' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="howFound"
                      value={option}
                      checked={howFound === option}
                      onChange={() => setHowFound(option)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{option}</span>
                  </label>
                ))}
              </div>
              {howFound === '기타' && (
                <Input
                  className="mt-2 h-12 border-gray-200 focus:border-black focus:ring-black"
                  placeholder="자세히 입력해주세요"
                  onChange={(e) => setHowFound(e.target.value ? `기타:${e.target.value}` : '기타')}
                />
              )}
            </div>

            {/* Terms Agreement */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreeTerms"
                  checked={agreeTerms}
                  onCheckedChange={(checked) => setAgreeTerms(!!checked)}
                  className="mt-1"
                />
                <Label htmlFor="agreeTerms" className="text-sm text-gray-600 leading-relaxed">
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-black underline hover:no-underline">
                    이용약관
                  </Link>
                  {' '}동의 (필수)
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreePrivacy"
                  checked={agreePrivacy}
                  onCheckedChange={(checked) => setAgreePrivacy(!!checked)}
                  className="mt-1"
                />
                <Label htmlFor="agreePrivacy" className="text-sm text-gray-600 leading-relaxed">
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-black underline hover:no-underline">
                    개인정보처리방침
                  </Link>
                  {' '}동의 (필수)
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agreeMarketing"
                  checked={agreeMarketing}
                  onCheckedChange={(checked) => setAgreeMarketing(!!checked)}
                  className="mt-1"
                />
                <Label htmlFor="agreeMarketing" className="text-sm text-gray-600 leading-relaxed">
                  마케팅 정보 수신 동의 (선택)
                </Label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 bg-black hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? '저장 중...' : '완료'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


