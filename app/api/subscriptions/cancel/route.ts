import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    await svc.from('subscriptions').update({ status: 'canceled' }).eq('user_id', user.id)
    return Response.json({ ok: true })
  } catch { return new Response('Bad Request', { status: 400 }) }
}


