import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// 관리자용 크레딧 초기화 테스트 엔드포인트
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 관리자 권한 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    console.log('🧪 테스트용 크레딧 초기화 시작 (관리자 실행):', user.id)

    // 월별 크레딧 초기화 API 호출
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    const cronSecret = process.env.CRON_SECRET || 'development-secret'
    
    const response = await fetch(`${baseUrl}/api/cron/monthly-credit-reset`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to reset credits')
    }

    console.log('✅ 테스트용 크레딧 초기화 완료:', result)
    return NextResponse.json({
      success: true,
      message: '테스트 크레딧 초기화가 완료되었습니다',
      details: result
    })

  } catch (error) {
    console.error('❌ 테스트 크레딧 초기화 오류:', error)
    return NextResponse.json({
      error: '테스트 크레딧 초기화 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
