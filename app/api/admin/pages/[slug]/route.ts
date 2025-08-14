import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { db } from '@/db'
import { pages } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug
  const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1)
  const row = rows[0] || null
  return Response.json({ slug, content: row?.content || '' })
}

const putSchema = z.object({ content: z.string().max(200_000) })
export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  const input = putSchema.parse(await req.json())
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { data: prof } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
  if (prof?.role !== 'admin') return new Response('Forbidden', { status: 403 })
  const slug = params.slug
  const exists = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1)
  if (exists.length) {
    await db.update(pages).set({ content: input.content, updatedBy: user.id as any }).where(eq(pages.slug, slug))
  } else {
    await db.insert(pages).values({ slug, content: input.content, updatedBy: user.id as any })
  }
  return Response.json({ ok: true })
}


