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

    console.log(`🧹 사용자 ${user.id}의 pending 검색 정리 시작`)

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

    // 크레딧 환불 처리
    let totalRefund = 0
    for (const search of pendingSearches) {
      if (search.credits_used && search.credits_used > 0) {
        totalRefund += search.credits_used
      }
    }

    if (totalRefund > 0) {
      console.log(`💰 총 ${totalRefund} 크레딧 환불 처리`)
      
      try {
        // 현재 크레딧 조회
        const { data: creditData, error: creditError } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()

        if (!creditError && creditData) {
          // 크레딧 환불
          await supabase
            .from('credits')
            .update({
              balance: creditData.balance + totalRefund
            })
            .eq('user_id', user.id)

          console.log(`✅ 크레딧 환불 완료: ${totalRefund} 크레딧`)
        }
      } catch (refundError) {
        console.error('❌ 크레딧 환불 실패:', refundError)
      }
    }

    // 환불된 크레딧만큼 search_history의 credits_used를 0으로 업데이트
    await supabase
      .from('search_history')
      .update({ credits_used: 0 })
      .eq('user_id', user.id)
      .eq('status', 'cancelled')
      .lt('created_at', fiveMinutesAgo)

    console.log(`✅ ${pendingSearches.length}개의 pending 검색 정리 완료`)

    return NextResponse.json({
      success: true,
      message: `${pendingSearches.length}개의 미완료 검색이 정리되었습니다`,
      cleaned: pendingSearches.length,
      refunded: totalRefund
    })

  } catch (error) {
    console.error('pending 검색 정리 오류:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
