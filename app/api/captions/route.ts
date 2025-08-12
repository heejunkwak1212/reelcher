import { startTaskRun, waitForRunItems } from '@/lib/apify'
import { z } from 'zod'

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
    const taskId = 'waxen_space/tiktok-instagram-facebook-transcriber-task'
    const started = await startTaskRun({ taskId, token, input: { directUrls: [input.url], normalizeLanguageTo: input.lang || 'ko' } })
    const out = await waitForRunItems<{ text?: string }[]>({ token, runId: started.runId })
    const text = Array.isArray(out.items) ? (out.items[0] as any)?.text || '' : ''
    return new Response(JSON.stringify({ captions: text }), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    const issues = Array.isArray(e?.issues) ? e.issues : undefined
    return new Response(JSON.stringify(issues ? { error: 'ValidationError', issues } : { error: 'Bad Request' }), { status: 400 })
  }
}


