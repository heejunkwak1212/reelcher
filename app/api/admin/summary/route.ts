import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET() {
  const supaSSR = await supabaseServer()
  const {
    data: { user },
  } = await supaSSR.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof, error } = await supaSSR.from('profiles').select('role').eq('user_id', user.id).single()
  if (error || prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const svc = supabaseService()
  const { count: users } = await svc.from('users').select('*', { head: true, count: 'exact' })
  const { count: searches } = await svc.from('searches').select('*', { head: true, count: 'exact' })
  const { data: credits } = await svc.from('credits').select('balance').limit(1000)
  const totalCredits = (credits || []).reduce((a: number, b: any) => a + (b.balance || 0), 0)
  const { count: subs } = await svc.from('subscriptions').select('*', { head: true, count: 'exact' })

  return Response.json({ users: users ?? 0, searches: searches ?? 0, totalCredits, subscriptions: subs ?? 0 })
}



