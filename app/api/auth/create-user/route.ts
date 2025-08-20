import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('유효하지 않은 이메일 형식입니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  name: z.string().min(1, '이름은 필수입니다'),
})

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json()
    const { email, password, name } = createUserSchema.parse(body)

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

    // Create user with admin API (automatically confirmed)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 이메일 확인을 true로 설정하여 즉시 활성화
      user_metadata: {
        display_name: name,
      },
    })

    if (error) {
      console.error('Error creating user:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create profile record with onboardingCompleted = false
    if (data.user) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: data.user.id,
          display_name: name,
          onboarding_completed: false,
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // 사용자는 생성되었지만 프로필 생성 실패 - 사용자 삭제는 하지 않음
      }
    }

    return NextResponse.json({ 
      data,
      message: 'User created successfully'
    })

  } catch (error) {
    console.error('Create user error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
