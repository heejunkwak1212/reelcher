import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { inquiries } from '@/db/schema'

const schema = z.object({
  type: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(5),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.parse(body)
    await db.insert(inquiries).values({ type: parsed.type, email: parsed.email, message: parsed.message })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Invalid request' }, { status: 400 })
  }
}


