import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    const { data: prof } = await svc.from('profiles').select('role, plan, display_name').eq('user_id', user.id).single()
    // Auto-upgrade admin to business plan
    if ((prof?.role || 'user') === 'admin' && prof?.plan !== 'business') {
      await svc.from('profiles').update({ plan: 'business' }).eq('user_id', user.id)
      ;(prof as any).plan = 'business'
    }
    const { data: cr } = await svc.from('credits').select('balance').eq('user_id', user.id).single()
    const url = new URL(req.url)
    const scope = url.searchParams.get('scope')
    if (scope === 'search-stats') {
      // Dynamic counts to ensure accuracy even without counters
      const now = new Date()
      const startOfTodayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
      const monthStartIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

      const todayQuery = await svc.from('searches').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', startOfTodayIso)
      const monthQuery = await svc.from('searches').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('created_at', monthStartIso)

      // recent keywords: last 2 days
      const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const { data: rec } = await svc.from('searches').select('keyword, created_at').gte('created_at', since).eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
      const recent = Array.from(new Set((rec || []).map(r => (r as any).keyword))).slice(0, 12)

      // month credit usage: sum of cost for current month
      const { data: monthRows } = await svc.from('searches').select('cost, created_at').gte('created_at', monthStartIso).eq('user_id', user.id)
      const monthCredits = (monthRows || []).reduce((sum, r: any) => sum + (Number(r?.cost || 0) || 0), 0)
      return Response.json({ today: Number(todayQuery.count || 0), month: Number(monthQuery.count || 0), recent, monthCredits })
    }
    return Response.json({ id: user.id, email: user.email, role: prof?.role || 'user', plan: prof?.plan || 'free', display_name: prof?.display_name, credits: (cr?.balance || 0) as number })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}


