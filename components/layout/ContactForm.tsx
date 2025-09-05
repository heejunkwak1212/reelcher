"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { toast } from 'sonner'

const TYPES = [
  '버그/시스템 오류',
  '건의사항',
  '결제/크레딧',
  '계정/보안',
  '기타',
] as const

export default function ContactForm() {
  const [type, setType] = useState<typeof TYPES[number]>('건의사항')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [showErrors, setShowErrors] = useState(false)
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!email.trim()) {
      newErrors.email = '이메일을 입력해주세요.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '올바른 이메일 형식을 입력해주세요.'
    }
    
    if (!message.trim()) {
      newErrors.message = '문의 내용을 입력해주세요.'
    } else if (message.trim().length < 5) {
      newErrors.message = '문의 내용은 5자 이상 입력해주세요.'
    }
    
    setErrors(newErrors)
    setShowErrors(Object.keys(newErrors).length > 0)
    return Object.keys(newErrors).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    const res = await fetch('/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, email, message }) })
    setLoading(false)
    if (!res.ok) {
      toast.error('전송 실패')
      return
    }
    setEmail(''); setMessage('')
    setErrors({})
    setShowErrors(false)
    toast.success('접수되었습니다. 최대한 빨리 답변드릴게요!')
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <label className="flex flex-col gap-2">
          <span 
            className="text-gray-700"
            style={{
              fontSize: 'var(--text-regular-size)',
              lineHeight: 'var(--text-regular-line-height)',
              letterSpacing: 'var(--text-regular-letter-spacing)',
              fontWeight: 'var(--font-weight-medium)'
            }}
          >
            문의 유형
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="h-10 w-full justify-between border-gray-300 bg-white hover:bg-gray-50 focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                style={{
                  fontSize: 'var(--text-regular-size)',
                  lineHeight: 'var(--text-regular-line-height)',
                  letterSpacing: 'var(--text-regular-letter-spacing)'
                }}
              >
                {type}
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full">
              {TYPES.map(t => (
                <DropdownMenuItem 
                  key={t} 
                  onClick={() => setType(t)}
                  className="cursor-pointer"
                >
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </label>
        <label className="flex flex-col gap-2">
          <span 
            className="text-gray-700"
            style={{
              fontSize: 'var(--text-regular-size)',
              lineHeight: 'var(--text-regular-line-height)',
              letterSpacing: 'var(--text-regular-letter-spacing)',
              fontWeight: 'var(--font-weight-medium)'
            }}
          >
            답변 받을 이메일
          </span>
          <Input
            type="email"
            value={email}
            onChange={(value) => {
              setEmail(value)
              // 텍스트 입력시 에러 초기화
              if (showErrors && errors.email) {
                setErrors({...errors, email: ''})
                if (!errors.message) setShowErrors(false)
              }
            }}
            placeholder="you@example.com"
            error={showErrors ? errors.email : undefined}
          />
        </label>
      </div>
      <label className="flex flex-col gap-2 mt-2">
        <span 
          className="text-gray-700"
          style={{
            fontSize: 'var(--text-regular-size)',
            lineHeight: 'var(--text-regular-line-height)',
            letterSpacing: 'var(--text-regular-letter-spacing)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          문의 내용
        </span>
        <Input
          isTextarea
          value={message}
          onChange={(value) => {
            setMessage(value)
            // 텍스트 입력시 에러 초기화
            if (showErrors && errors.message) {
              setErrors({...errors, message: ''})
              if (!errors.email) setShowErrors(false)
            }
          }}
          placeholder="어떤 점이 궁금하신가요?"
                      error={showErrors ? errors.message : undefined}
          className="min-h-[140px]"
        />
      </label>
      <Button 
        className="h-12 px-8 rounded-full bg-black text-white hover:bg-black/90 btn-animate" 
        disabled={loading} 
        type="submit"
      >
        <span 
          style={{
            fontSize: 'var(--text-regular-size)',
            lineHeight: 'var(--text-regular-line-height)',
            letterSpacing: 'var(--text-regular-letter-spacing)',
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          {loading ? '전송 중…' : '문의 보내기'}
        </span>
      </Button>
    </form>
  )
}


