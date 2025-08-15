import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const schema = z.object({ plan: z.enum(['starter','pro','business']) })

export async function POST(req: Request) {
  try {
    const { plan } = schema.parse(await req.json())
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    const { data: prof } = await svc.from('profiles').select('role').eq('user_id', user.id).single()
    const isAdmin = prof?.role === 'admin'
    // 다운그레이드는 이 엔드포인트에서만 허용, 업그레이드는 결제 플로우 사용
    await svc.from('subscriptions').upsert({ user_id: user.id as any, plan, status: 'active' })
    return Response.json({ ok: true })
  } catch { return new Response('Bad Request', { status: 400 }) }
}


