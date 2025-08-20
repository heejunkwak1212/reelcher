import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { emailCheckLimiter } from '@/lib/ratelimit'
import { z } from 'zod'

export const runtime = 'nodejs'

const checkEmailSchema = z.object({
  email: z.string().email('유효하지 않은 이메일 형식입니다'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    if (emailCheckLimiter) {
      const identifier = (request as any).ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
      const { success, remaining, reset } = await emailCheckLimiter.limit(identifier)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'X-RateLimit-Remaining': remaining.toString(), 'X-RateLimit-Reset': reset.toString() } }
        )
      }
    }

    // Validate request body
    const body = await request.json()
    const { email } = checkEmailSchema.parse(body)

    // Create Supabase admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if email already exists using admin API - listUsers with filter
    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('Error checking email:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Check if any user has this email
    const existingUser = data.users.find(user => user.email === email)
    const isDuplicate = !!existingUser

    return NextResponse.json({ 
      isDuplicate,
      message: isDuplicate ? '이미 사용 중인 이메일입니다' : '사용 가능한 이메일입니다'
    })

  } catch (error) {
    console.error('Check email error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
