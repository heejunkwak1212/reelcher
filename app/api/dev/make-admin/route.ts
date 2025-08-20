import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 개발 환경에서만 작동하는 Admin 생성 API
export async function POST(request: NextRequest) {
  // 개발 환경에서만 실행
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available in development' }, { status: 403 })
  }

  try {
    const supabase = await supabaseServer()
    
    // 현재 로그인한 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 현재 사용자를 admin으로 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({ 
        user_id: user.id, 
        role: 'admin' 
      }, { 
        onConflict: 'user_id' 
      })

    if (updateError) {
      console.error('Admin update error:', updateError)
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Admin role granted',
      userId: user.id,
      email: user.email
    })

  } catch (error) {
    console.error('Make admin error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
