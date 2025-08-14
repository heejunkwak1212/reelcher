import { startTaskRun, waitForRunItems } from '@/lib/apify'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const schema = z.object({
  url: z.string().url(),
  lang: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const token = process.env.APIFY_TOKEN
    if (!token) return new Response(JSON.stringify({ error: 'APIFY_TOKEN missing' }), { status: 500 })
    const body = await req.json()
    const input = schema.parse(body)

    // Require auth and reserve credits (20) per PRD
    const ssr = supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const creditsEndpoint = new URL('/api/credits/consume', req.url).toString()
    const reserveAmount = 20
    let didReserve = false
    {
      const resv = await fetch(creditsEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, reserve: reserveAmount }) })
      if (!resv.ok) {
        const msg = await resv.text().catch(() => '')
        return new Response(JSON.stringify({ error: msg || 'Insufficient credits' }), { status: resv.status })
      }
      didReserve = true
    }
    // Sanitize: strip query/hash to avoid actor mis-detection
    const urlObj = new URL(input.url)
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`
    const taskId = 'waxen_space/tiktok-instagram-facebook-transcriber-task'
    // This actor expects 'start_urls' not 'directUrls'. If the param is wrong, it falls back to example URL.
    const started = await startTaskRun({ taskId, token, input: { start_urls: cleanUrl, normalizeLanguageTo: input.lang || 'ko' } })
    const out = await waitForRunItems<any[]>({ token, runId: started.runId })
    const first = Array.isArray(out.items) ? (out.items[0] as any) : undefined
    let text: string = first?.text || first?.transcript || first?.transcription || ''
    // Strip timestamps like "[0.24s - 1.92s] "
    if (typeof text === 'string' && text.length) {
      text = text.replace(/\[\s*\d+(?:\.\d+)?s\s*-\s*\d+(?:\.\d+)?s\s*\]\s*/g, '')
      text = text.replace(/\s{2,}/g, ' ').trim()
    }
    // Commit credits on success
    if (didReserve) {
      await fetch(creditsEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, commit: reserveAmount, rollback: 0 }) }).catch(() => {})
    }
    return new Response(JSON.stringify({ captions: text }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    // Rollback reserved credits on failure if possible
    try {
      const ssr = supabaseServer()
      const { data: { user } } = await ssr.auth.getUser()
      if (user) {
        const creditsEndpoint = new URL('/api/credits/consume', (e as any)?.req?.url || 'http://localhost').toString()
        await fetch(creditsEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, rollback: 20 }) }).catch(() => {})
      }
    } catch {}
    const issues = Array.isArray(e?.issues) ? e.issues : undefined
    return new Response(JSON.stringify(issues ? { error: 'ValidationError', issues } : { error: 'Bad Request' }), { status: 400 })
  }
}


