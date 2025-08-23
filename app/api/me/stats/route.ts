import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // search_history 테이블에서 직접 통계 계산
    const { data: searchHistory, error: statsError } = await supabase
      .from('search_history')
      .select('created_at, credits_used')
      .eq('user_id', user.id)
    
    if (statsError) {
      console.error('검색 통계 조회 실패:', statsError)
      return NextResponse.json(
        { error: '통계 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // 이번주 시작일 계산 (일요일 기준)
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    let todaySearches = 0
    let monthSearches = 0
    let monthCreditsUsed = 0
    let weekCreditsUsed = 0
    let totalSearches = searchHistory?.length || 0
    
    for (const record of searchHistory || []) {
      const recordDate = new Date(record.created_at)
      const recordDateStr = recordDate.toISOString().split('T')[0]
      
      // 오늘 검색수
      if (recordDateStr === today) {
        todaySearches++
      }
      
      // 이번달 검색수 및 크레딧
      if (recordDate >= monthStart) {
        monthSearches++
        monthCreditsUsed += record.credits_used || 0
      }
      
      // 이번주 크레딧
      if (recordDate >= weekStart) {
        weekCreditsUsed += record.credits_used || 0
      }
    }
    
    const result = {
      success: true,
      today_searches: todaySearches,
      month_searches: monthSearches,
      month_credits: monthCreditsUsed,
      week_credits: weekCreditsUsed,
      total_searches: totalSearches
    }
    
    console.log('📊 /api/me/stats 응답:', result)
    
    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
    
  } catch (error) {
    console.error('통계 API 오류:', error)
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
