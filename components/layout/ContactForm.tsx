"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'

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
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/inquiries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, email, message }) })
    setLoading(false)
    if (!res.ok) return alert('전송 실패')
    setEmail(''); setMessage('')
    alert('접수되었습니다. 최대한 빨리 답변드릴게요!')
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">문의 유형</span>
          <select className="border rounded px-3 h-10" value={type} onChange={(e)=>setType(e.target.value as any)}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-neutral-600">답변 받을 이메일</span>
          <input className="border rounded px-3 h-10" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-600">문의 내용</span>
        <textarea className="border rounded px-3 py-2 min-h-[140px]" required value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="어떤 점이 궁금하신가요?" />
      </label>
      <Button className="h-10 px-5 rounded-full bg-black text-white hover:bg-black/90 btn-animate" disabled={loading} type="submit">
        {loading ? '전송 중…' : '문의 보내기'}
      </Button>
    </form>
  )
}


