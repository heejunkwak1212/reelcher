"use client"
import { useState } from 'react'

export default function InlineEditor({ slug, initialContent, isAdmin }: { slug: string; initialContent: string; isAdmin: boolean }) {
  const [content, setContent] = useState(initialContent || '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const renderContent = (txt: string) => {
    const lines = (txt || '').split('\n')
    return (
      <article className="prose prose-neutral max-w-none">
        {lines.map((l, i) => {
          const t = (l ?? '').trim()
          // 큰 제목
          if (/^#\s+/.test(l)) return <h1 key={i} className="text-2xl font-bold">{l.replace(/^#\s+/, '')}</h1>
          // 섹션 제목
          if (/^##\s+/.test(l) || /^제\d+조/.test(t)) return <h2 key={i} className="text-xl font-semibold mt-4">{l.replace(/^##\s+/, '')}</h2>
          // 서문은 일반 단락으로 출력(요청에 따라 롤백)
          if (/^본\s+(개인정보처리방침|약관)/.test(t)) return <p key={i} className="leading-7">{t}</p>
          return <p key={i} className="leading-7">{l || ' '}</p>
        })}
      </article>
    )
  }

  if (!isAdmin) {
    return renderContent(content || '내용을 준비 중입니다.')
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/pages/${slug}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }) })
      if (!res.ok) throw new Error('저장 실패')
      alert('저장되었습니다')
      setEditing(false)
    } catch (e) { alert((e as Error).message) } finally { setSaving(false) }
  }

  const applyWrap = (left: string, right = left) => {
    const ta = document.getElementById('inline-editor') as HTMLTextAreaElement | null
    if (!ta) return
    const start = ta.selectionStart || 0
    const end = ta.selectionEnd || 0
    const before = content.slice(0, start)
    const middle = content.slice(start, end)
    const after = content.slice(end)
    const next = `${before}${left}${middle}${right}${after}`
    setContent(next)
    setTimeout(() => { ta.focus(); ta.selectionStart = start + left.length; ta.selectionEnd = end + left.length }, 0)
  }
  const applyPrefix = (prefix: string) => {
    const ta = document.getElementById('inline-editor') as HTMLTextAreaElement | null
    if (!ta) return
    const lines = content.split('\n')
    const pos = ta.selectionStart || 0
    let idx = 0, acc = 0
    for (let i = 0; i < lines.length; i++) { const len = lines[i].length + 1; if (acc + len > pos) { idx = i; break } acc += len }
    lines[idx] = `${prefix} ${lines[idx].replace(/^\s*#+\s*/,'').replace(/^\s*[-*]\s*/,'').trimStart()}`
    setContent(lines.join('\n'))
    setTimeout(() => ta?.focus(), 0)
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {!editing && (
          <button className="px-3 py-2 border rounded" onClick={()=>{ setEditing(true); setPreview(false) }}>수정하기</button>
        )}
        {editing && (
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 border rounded" onClick={()=>setPreview(v=>!v)}>{preview ? '에디터 보기' : '미리보기'}</button>
            <button className="px-3 py-2 border rounded bg-black text-white" disabled={saving} onClick={onSave}>{saving ? '저장 중…' : '저장'}</button>
          </div>
        )}
      </div>
      {/* 툴바는 일단 숨김 (요청에 따라 제거) */}
      {editing && !preview && (
        <textarea id="inline-editor" className="w-full border rounded p-3 min-h-[60vh] font-mono text-sm" value={content} onChange={e=>setContent(e.target.value)} />
      )}
      {(!editing || preview) && renderContent(content || '내용을 준비 중입니다.')}
    </div>
  )
}


