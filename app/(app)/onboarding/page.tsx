"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function OnboardingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [howFound, setHowFound] = useState('')
  const [role, setRole] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!displayName || !role) { alert('이름과 역할을 입력해주세요.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, howFound, role }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `요청 실패 (${res.status})`)
      }
      router.replace('/dashboard')
    } catch (e) {
      alert((e as Error).message)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-lg font-semibold">온보딩</h1>
      <div className="space-y-3">
        <label className="block">
          <span className="block text-sm mb-1">이름</span>
          <input className="w-full border rounded px-3 py-2" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm mb-1">어디서 알게 되었나요? (선택)</span>
          <input className="w-full border rounded px-3 py-2" value={howFound} onChange={e=>setHowFound(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm mb-1">역할</span>
          <select className="w-full border rounded px-3 py-2" value={role} onChange={e=>setRole(e.target.value)}>
            <option value="">선택하세요</option>
            <option value="user">사용자</option>
            <option value="admin">관리자</option>
          </select>
        </label>
      </div>
      <Button onClick={submit} disabled={submitting}>{submitting ? '저장 중…' : '완료'}</Button>
    </div>
  )
}


