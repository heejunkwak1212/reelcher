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

    // 검색 통계와 크레딧 사용량을 분리하여 계산
    // 1. 검색 횟수 통계 (자막 추출 제외)
    const { data: searchHistory, error: statsError } = await supabase
      .from('search_history')
      .select('created_at, credits_used, status, search_type')
      .eq('user_id', user.id)
      .gt('credits_used', 0) // credits_used > 0인 검색만 포함
      .neq('search_type', 'subtitle_extraction') // 자막 추출은 검색통계에서 제외
    
    // 2. 크레딧 사용량 통계 (자막 추출 포함)
    const { data: creditHistory, error: creditError } = await supabase
      .from('search_history')
      .select('created_at, credits_used, search_type')
      .eq('user_id', user.id)
      .gt('credits_used', 0) // credits_used > 0인 모든 기록 포함 (자막 추출 포함)
    
    if (statsError || creditError) {
      console.error('통계 조회 실패:', { statsError, creditError })
      return NextResponse.json(
        { error: '통계 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    const now = new Date()
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    
    // 정확한 날짜 계산: 오늘 00:00:00부터 시작
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    
    // 최근 30일: 오늘 포함하여 30일 전 00:00:00부터
    const thirtyDaysAgo = new Date(todayStart)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29) // 오늘 포함 30일
    
    // 최근 7일: 오늘 포함하여 7일 전 00:00:00부터
    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // 오늘 포함 7일
    
    console.log('📅 날짜 범위 확인:', {
      today,
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      sevenDaysAgo: sevenDaysAgo.toISOString()
    })
    
    let todaySearches = 0
    let thirtyDaySearches = 0
    let sevenDaySearches = 0
    let thirtyDayCreditsUsed = 0
    let sevenDayCreditsUsed = 0
    let totalSearches = searchHistory?.length || 0
    
    // 검색 횟수 계산 (자막 추출 제외)
    for (const record of searchHistory || []) {
      const recordDate = new Date(record.created_at)
      const recordDateStr = recordDate.toISOString().split('T')[0]
      
      // 오늘 검색수
      if (recordDateStr === today) {
        todaySearches++
      }
      
      // 최근 30일 검색수
      if (recordDate >= thirtyDaysAgo) {
        thirtyDaySearches++
      }
      
      // 최근 7일 검색수
      if (recordDate >= sevenDaysAgo) {
        sevenDaySearches++
      }
    }
    
    // 크레딧 사용량 계산 (자막 추출 포함)
    for (const record of creditHistory || []) {
      const recordDate = new Date(record.created_at)
      
      // 최근 30일 크레딧
      if (recordDate >= thirtyDaysAgo) {
        thirtyDayCreditsUsed += record.credits_used || 0
      }
      
      // 최근 7일 크레딧
      if (recordDate >= sevenDaysAgo) {
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
    
    console.log('📊 /api/me/stats 응답:', result)
    console.log('📊 검색 기록 통계:', {
      searchRecords: searchHistory?.length || 0,
      creditRecords: creditHistory?.length || 0,
      todaySearches,
      thirtyDaySearches,
      thirtyDayCreditsUsed
    })
    
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
