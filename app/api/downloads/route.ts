export const runtime = 'nodejs'

const isSafeUrl = (u?: string) => {
  if (!u) return false
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) } catch { return false }
}

import JSZip from 'jszip'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter(isSafeUrl) : []
    if (!urls.length) return new Response('No urls', { status: 400 })
    if (urls.length === 1) {
      const upstream = await fetch(urls[0])
      if (!upstream.ok || !upstream.body) return new Response('Upstream error', { status: 502 })
      return new Response(upstream.body, { status: 200, headers: { 'content-type': upstream.headers.get('content-type') || 'video/mp4', 'content-disposition': 'attachment; filename="reel.mp4"', 'cache-control': 'no-store' } })
    }
    // Multiple → zip
    const zip = new JSZip()
    // Parallel downloads with limited concurrency for speed
    const concurrency = 4
    let index = 0
    const files: { name: string; data: ArrayBuffer }[] = []
    const worker = async () => {
      while (index < urls.length) {
        const current = index++
        const url = urls[current]
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const buf = await res.arrayBuffer()
          files.push({ name: `reel-${current + 1}.mp4`, data: buf })
        } catch { /* skip failed */ }
      }
    }
    await Promise.all(new Array(concurrency).fill(0).map(() => worker()))
    for (const f of files) zip.file(f.name, f.data)
    const blob = await zip.generateAsync({ type: 'arraybuffer' })
    return new Response(Buffer.from(blob), { status: 200, headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="reels.zip"', 'cache-control': 'no-store' } })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}


