import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { z } from 'zod'

const roleSchema = z.object({
  role: z.enum(['admin', 'user'])
})

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 관리자 권한 확인
    const { data: adminData } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (adminData?.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const { userId } = params
    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const { role } = roleSchema.parse(body)

    // 자기 자신의 권한을 변경하는 것 방지
    if (userId === user.id) {
      return NextResponse.json(
        { error: '자기 자신의 권한을 변경할 수 없습니다.' },
        { status: 400 }
      )
    }

    const svc = supabaseService()
    
    // 대상 사용자 존재 확인
    const { data: targetUser } = await svc.auth.admin.getUserById(userId)
    if (!targetUser?.user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 프로필에서 역할 업데이트
    const { error: updateError } = await svc
      .from('profiles')
      .update({ role })
      .eq('user_id', userId)

    if (updateError) {
      console.error('역할 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: '역할 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: `사용자 권한이 ${role === 'admin' ? '관리자' : '일반 사용자'}로 변경되었습니다.` 
    })

  } catch (error) {
    console.error('역할 변경 오류:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: '역할 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
