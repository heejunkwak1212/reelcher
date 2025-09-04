import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
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

    const svc = supabaseService()
    
    // 사용자 존재 확인
    const { data: targetUser } = await svc.auth.admin.getUserById(userId)
    if (!targetUser?.user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 자기 자신을 삭제하는 것 방지
    if (userId === user.id) {
      return NextResponse.json(
        { error: '자기 자신을 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // 사용자 관련 모든 데이터 삭제
    const deletePromises = [
      // 검색 기록 삭제
      svc.from('search_history').delete().eq('user_id', userId),
      svc.from('search_queue').delete().eq('user_id', userId),
      svc.from('platform_searches').delete().eq('user_id', userId),
      svc.from('searches').delete().eq('user_id', userId),
      
      // 크레딧 관련 삭제
      svc.from('credits').delete().eq('user_id', userId),
      svc.from('monthly_credit_usage').delete().eq('user_id', userId),
      svc.from('search_counters').delete().eq('user_id', userId),
      
      // 구독 및 결제 관련 삭제
      svc.from('subscriptions').delete().eq('user_id', userId),
      
      // 기타 사용자 데이터 삭제
      svc.from('certification_requests').delete().eq('user_id', userId),
      svc.from('user_api_keys').delete().eq('user_id', userId),
      svc.from('inquiries').delete().eq('user_id', userId),
      
      // 프로필 삭제
      svc.from('profiles').delete().eq('user_id', userId),
    ]

    // 모든 관련 데이터 삭제
    await Promise.allSettled(deletePromises)

    // Auth 사용자 삭제
    const { error: deleteAuthError } = await svc.auth.admin.deleteUser(userId)
    if (deleteAuthError) {
      console.error('Auth 사용자 삭제 오류:', deleteAuthError)
      return NextResponse.json(
        { error: 'Auth 사용자 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: '사용자가 성공적으로 삭제되었습니다.' })

  } catch (error) {
    console.error('사용자 삭제 오류:', error)
    return NextResponse.json(
      { error: '사용자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
