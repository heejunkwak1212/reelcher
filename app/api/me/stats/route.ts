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
    
    // 최근 30일 (오늘 포함)
    const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
    thirtyDaysAgo.setHours(0, 0, 0, 0)
    
    // 최근 7일 (오늘 포함)
    const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    
    let todaySearches = 0
    let thirtyDaySearches = 0
    let sevenDaySearches = 0
    let thirtyDayCreditsUsed = 0
    let sevenDayCreditsUsed = 0
    let totalSearches = searchHistory?.length || 0
    
    for (const record of searchHistory || []) {
      const recordDate = new Date(record.created_at)
      const recordDateStr = recordDate.toISOString().split('T')[0]
      
      // 오늘 검색수
      if (recordDateStr === today) {
        todaySearches++
      }
      
      // 최근 30일 검색수 및 크레딧
      if (recordDate >= thirtyDaysAgo) {
        thirtyDaySearches++
        thirtyDayCreditsUsed += record.credits_used || 0
      }
      
      // 최근 7일 검색수 및 크레딧
      if (recordDate >= sevenDaysAgo) {
        sevenDaySearches++
        sevenDayCreditsUsed += record.credits_used || 0
      }
    }
    
    const result = {
      success: true,
      today_searches: todaySearches,
      week_searches: sevenDaySearches,        // 최근 7일 검색수
      month_searches: thirtyDaySearches,      // 최근 30일 검색수
      week_credits: sevenDayCreditsUsed,      // 최근 7일 크레딧
      month_credits: thirtyDayCreditsUsed,    // 최근 30일 크레딧
      total_searches: totalSearches           // 전체 검색수
    }
    
    console.log('📊 /api/me/stats 응답 (30일/7일 기준):', result)
    
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
