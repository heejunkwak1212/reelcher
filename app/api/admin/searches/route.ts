import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') || '50')))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const fromDate = url.searchParams.get('from')
  const toDate = url.searchParams.get('to')

  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
  if (prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const svc = supabaseService()
  let query = svc.from('searches').select('*', { count: 'exact' })
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate)
  const { data, count } = await query.order('created_at', { ascending: false }).range(from, to)
  return Response.json({ items: data || [], total: count || 0, page, pageSize, from: fromDate, to: toDate })
}


