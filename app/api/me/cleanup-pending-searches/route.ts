import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// 진행 중인 검색들을 정리하는 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 사용자 pending 검색 정리 시작 (프로덕션 보안을 위해 사용자 ID 숨김)
    if (process.env.NODE_ENV === 'development') {
      console.log('사용자 pending 검색 정리 시작')
    }

    // 5분 이상 된 pending 상태 검색들을 조회
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    
    const { data: pendingSearches, error: fetchError } = await supabase
      .from('search_history')
      .select('id, keyword, platform, credits_used, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('created_at', fiveMinutesAgo)

    if (fetchError) {
      console.error('❌ pending 검색 조회 실패:', fetchError)
      return NextResponse.json({ error: '검색 기록 조회 실패' }, { status: 500 })
    }

    if (!pendingSearches || pendingSearches.length === 0) {
      console.log('✅ 정리할 pending 검색이 없습니다')
      return NextResponse.json({ 
        success: true, 
        message: '정리할 검색이 없습니다',
        cleaned: 0 
      })
    }

    console.log(`🧹 ${pendingSearches.length}개의 pending 검색 발견:`, 
      pendingSearches.map(s => ({ id: s.id, keyword: s.keyword, platform: s.platform }))
    )

    // pending 검색들을 cancelled로 업데이트
    const { error: updateError } = await supabase
      .from('search_history')
      .update({
        status: 'cancelled',
        error_message: '사용자가 페이지를 벗어나거나 새로고침했습니다',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lt('created_at', fiveMinutesAgo)

    if (updateError) {
      console.error('❌ pending 검색 업데이트 실패:', updateError)
      return NextResponse.json({ error: '검색 상태 업데이트 실패' }, { status: 500 })
    }

    // ⚠️ 중요: 취소된 검색이라도 실제로는 Apify 액터가 실행되어 비용이 발생하므로
    // 크레딧은 환불하지 않고, credits_used도 그대로 유지합니다.
    // 이는 실제 비용 발생과 통계의 정확성을 위해 필요합니다.
    
    console.log(`📊 취소된 검색들의 크레딧은 실제 비용 발생으로 인해 차감 상태로 유지됩니다`)

    console.log(`✅ ${pendingSearches.length}개의 pending 검색 정리 완료`)

    return NextResponse.json({
      success: true,
      message: `${pendingSearches.length}개의 미완료 검색이 정리되었습니다`,
      cleaned: pendingSearches.length,
      refunded: 0 // 취소된 검색은 크레딧을 환불하지 않음
    })

  } catch (error) {
    console.error('pending 검색 정리 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
