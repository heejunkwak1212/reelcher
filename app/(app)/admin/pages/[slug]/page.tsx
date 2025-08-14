"use client"
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function AdminPageEditor() {
  const params = useParams() as { slug: string }
  const slug = params.slug
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(true)
  useEffect(() => {
    ;(async () => {
      const res = await fetch(`/api/admin/pages/${slug}`, { cache: 'no-store' })
      const j = await res.json().catch(()=>({ content: '' }))
      setContent(j?.content || '')
      setLoading(false)
    })()
  }, [slug])
  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/pages/${slug}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }) })
      if (!res.ok) throw new Error('저장 실패')
      alert('저장되었습니다')
    } catch (e) { alert((e as Error).message) } finally { setSaving(false) }
  }
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">페이지 편집: {slug}</h1>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border rounded" onClick={()=>setPreview(v=>!v)}>{preview ? '에디터 보기' : '미리보기'}</button>
          <button className="px-3 py-2 border rounded bg-black text-white" disabled={saving} onClick={save}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <textarea className="border rounded p-3 min-h-[60vh] font-mono text-sm" value={content} onChange={e=>setContent(e.target.value)} style={{ display: preview ? 'none' : 'block' }} />
        <article className="prose prose-neutral max-w-none border rounded p-3 min-h-[60vh]" style={{ display: preview ? 'block' : 'none' }}>
          {content.split('\n').map((l, i) => <p key={i}>{l}</p>)}
        </article>
      </div>
    </div>
  )
}


