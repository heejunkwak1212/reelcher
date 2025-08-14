"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function OnboardingPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [howFound, setHowFound] = useState('')
  const [role, setRole] = useState('user')
  const [submitting, setSubmitting] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)

  // duplication check removed per request

  const submit = async () => {
    if (!displayName) { alert('닉네임을 입력해주세요.'); return }
    if (!agreeTerms || !agreePrivacy) { alert('필수 약관에 동의해 주세요.'); return }
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
          <span className="block text-sm mb-1">닉네임</span>
          <input className="w-full border rounded px-3 py-2" value={displayName} onChange={e=>setDisplayName(e.target.value)} />
        </label>
        <div className="block">
          <span className="block text-sm mb-2">어디서 알게 되었나요? (필수)</span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['유튜브','스레드','인스타그램','기타'].map(opt => (
              <label key={opt} className="flex items-center gap-2 border rounded px-3 py-2 cursor-pointer">
                <input type="radio" name="howFound" value={opt} checked={howFound===opt} onChange={()=>setHowFound(opt)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {howFound==='기타' && (
            <input className="mt-2 w-full border rounded px-3 py-2" placeholder="자세히 입력해주세요" onChange={e=>setHowFound(e.target.value ? `기타:${e.target.value}` : '기타')} />
          )}
        </div>
      </div>
      <div className="space-y-2 text-xs text-neutral-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={agreeTerms} onChange={e=>setAgreeTerms(e.target.checked)} />
          <span>이용약관 동의 (필수) <a className="underline" href="/terms" target="_blank">보기</a></span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={agreePrivacy} onChange={e=>setAgreePrivacy(e.target.checked)} />
          <span>개인정보처리방침 동의 (필수) <a className="underline" href="/privacy" target="_blank">보기</a></span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={agreeMarketing} onChange={e=>setAgreeMarketing(e.target.checked)} />
          <span>마케팅 정보 수신 동의 (선택)</span>
        </label>
      </div>
      <Button onClick={submit} disabled={submitting} className="mt-2">{submitting ? '저장 중…' : '완료'}</Button>
    </div>
  )
}


