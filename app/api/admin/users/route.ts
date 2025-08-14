import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || '20')))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
  if (prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const svc = supabaseService()
  const { data: users, count } = await svc.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to)
  const ids = (users || []).map(u => u.id)
  const [{ data: profiles }, { data: credits }] = await Promise.all([
    ids.length ? svc.from('profiles').select('*').in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? svc.from('credits').select('*').in('user_id', ids) : Promise.resolve({ data: [] as any[] }),
  ])
  return Response.json({ items: users || [], profiles: profiles || [], credits: credits || [], total: count || 0, page, pageSize })
}

export async function POST(req: Request) {
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
  if (prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })
  const body = await req.json().catch(()=>({})) as { email?: string }
  const email = (body.email || '').trim()
  if (!email) return Response.json({ error: 'EmailRequired' }, { status: 400 })
  const svc = supabaseService()
  const { data: u } = await svc.from('users').select('id,email').eq('email', email).single()
  if (!u) return Response.json({ error: 'UserNotFound' }, { status: 404 })
  await svc.from('profiles').upsert({ user_id: u.id, role: 'admin' }, { onConflict: 'user_id' })
  return Response.json({ ok: true, userId: u.id })
}

export async function PUT(req: Request) {
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
  if (prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })
  const body = await req.json().catch(()=>({})) as { userId?: string; email?: string; creditDelta?: number }
  const svc = supabaseService()
  let targetId = body.userId
  if (!targetId && body.email) {
    const { data: u } = await svc.from('users').select('id').eq('email', body.email).single()
    targetId = u?.id as string
  }
  if (!targetId) return Response.json({ error: 'UserRequired' }, { status: 400 })
  const delta = Number(body.creditDelta || 0)
  if (!Number.isFinite(delta) || delta === 0) return Response.json({ error: 'InvalidDelta' }, { status: 400 })
  const { data: row } = await svc.from('credits').select('balance,reserved').eq('user_id', targetId).single()
  const balance = (row?.balance || 0) + delta
  await svc.from('credits').upsert({ user_id: targetId as any, balance, reserved: row?.reserved || 0 })
  return Response.json({ ok: true, userId: targetId, balance })
}


