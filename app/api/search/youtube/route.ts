import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { searchLimiter } from '@/lib/ratelimit'
import { YouTubeClient, YouTubeAPIError } from '@/lib/youtube'
import { IYouTubeSearchRequest } from '@/types'
import { z } from 'zod'

export const runtime = 'nodejs'

// YouTube 검색 요청 스키마
const youtubeSearchSchema = z.object({
  searchType: z.enum(['keyword', 'url']),
  query: z.string().min(1),
  url: z.string().optional(),
  apiKey: z.string().min(1, 'YouTube API 키가 필요합니다'),
  resultsLimit: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(50), z.literal(60), z.literal(90), z.literal(120)]),
  filters: z.object({
    period: z.enum(['day', 'week', 'month', 'month2', 'month3', 'month6', 'year', 'all']).optional(),
    minViews: z.number().min(0).optional(),
    maxSubscribers: z.number().min(0).optional(),
    videoDuration: z.enum(['any', 'short', 'long']).optional(),
    sortBy: z.enum(['viewCount', 'engagement_rate', 'reaction_rate', 'date_desc', 'date_asc']).optional()
  }).optional().default({})
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = searchLimiter ? await searchLimiter.limit(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown') : { success: true }
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    // 사용자 인증 확인
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const validatedData = youtubeSearchSchema.parse(body)
    const searchRequest: IYouTubeSearchRequest = {
      ...validatedData,
      resultsLimit: validatedData.resultsLimit as 30 | 60 | 90 | 120
    }

    // YouTube API 키는 스키마 검증에서 확인됨
    const youtubeApiKey = searchRequest.apiKey

    // 사용자 정보 조회 (관리자 확인용) - profiles 테이블 사용
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    console.log('사용자 정보 확인:', {
      userId: user.id,
      userData,
      userError,
      userRole: userData?.role
    })

    const isAdmin = userData?.role === 'admin'
    let transactionId = null

    console.log('관리자 여부:', isAdmin, 'resultsLimit:', searchRequest.resultsLimit)

    // 관리자가 아닌 경우에만 크레딧 처리
    if (!isAdmin) {
      // 크레딧 계산 (YouTube는 Instagram보다 저렴하게)
      const creditCosts: Record<number, number> = {
        5: 0,     // 개발용 - 무료
        30: 50,   // Instagram 100 → YouTube 50
        60: 100,  // Instagram 200 → YouTube 100
        90: 150,  // Instagram 300 → YouTube 150
        120: 200  // Instagram 400 → YouTube 200
      }
      const requiredCredits = creditCosts[searchRequest.resultsLimit] || 0

      // 크레딧이 필요한 경우에만 예약
      if (requiredCredits > 0) {
        // 크레딧 예약
        const { data: reservationData, error: reservationError } = await supabase.rpc(
          'reserve_credits',
          { 
            user_id: user.id, 
            amount: requiredCredits,
            source: `youtube_${searchRequest.searchType}_search`
          }
        )

        if (reservationError || !reservationData) {
          return NextResponse.json(
            { error: '크레딧이 부족합니다.' },
            { status: 402 }
          )
        }

        transactionId = reservationData.transaction_id
      }
    }

    // YouTube API 클라이언트 생성 및 검색 수행
    const youtubeClient = new YouTubeClient(youtubeApiKey)

    let searchResponse
    if (searchRequest.searchType === 'url') {
      searchResponse = await youtubeClient.searchSimilarVideos(searchRequest)
    } else {
      searchResponse = await youtubeClient.searchByKeyword(searchRequest)
    }

    // 실제 결과 수 계산 (관리자/일반 사용자 공통)
    const actualResults = searchResponse.results.length
    const actualCredits = isAdmin ? 0 : Math.floor((actualResults / 30) * 50) // 30개당 50크레딧, 관리자는 0

    // 크레딧 정산 처리
    if (!isAdmin && transactionId) {
      // 관리자가 아닌 경우에만 크레딧 커밋 (정산)
      const { error: commitError } = await supabase.rpc(
        'commit_credits',
        {
          transaction_id: transactionId,
          actual_amount: actualCredits,
          metadata: {
            platform: 'youtube',
            searchType: searchRequest.searchType,
            query: searchRequest.query,
            actualResults,
            requestedResults: searchRequest.resultsLimit
          }
        }
      )

      if (commitError) {
        console.error('크레딧 커밋 실패:', commitError)
        // 롤백
        await supabase.rpc('rollback_credits', { transaction_id: transactionId })
        
        return NextResponse.json(
          { error: '크레딧 처리 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }
    
    // 관리자 계정 로그
    if (isAdmin) {
      console.log('관리자 계정 - 크레딧 처리 생략 (무료)')
    }

    // Supabase 서비스 클라이언트 생성 (검색 기록 및 통계 업데이트용)
    const svc = (await import('@/lib/supabase/service')).supabaseService()
    
    // 검색 기록 저장 (모든 사용자) - platform_searches 테이블 사용
    try {
      const { error: historyError } = await svc
        .from('platform_searches')
        .insert({
          user_id: user.id,
          platform: 'youtube',
          search_type: searchRequest.searchType,
          keyword: searchRequest.query,
          url: searchRequest.url,
          filters: searchRequest.filters,
          results_count: actualResults || 0,
          credits_used: isAdmin ? 0 : (actualCredits || 0)
        })

      if (historyError) {
        console.error('YouTube 검색 기록 저장 실패:', historyError)
        // 검색 기록 저장 실패는 응답에 영향을 주지 않음
      }
      
      // 키워드 검색인 경우에만 최근 키워드로 저장 (2일간 보관)
      if (searchRequest.searchType === 'keyword' && searchRequest.query?.trim()) {
        // 2일 이상된 키워드 기록 정리
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        await svc.from('platform_searches')
          .delete()
          .eq('user_id', user.id)
          .eq('platform', 'youtube')
          .eq('search_type', 'keyword')
          .eq('results_count', 0) // 키워드 저장용 더미 레코드만 삭제
          .eq('credits_used', 0)
          .lt('created_at', twoDaysAgo)
        
        // 최근 키워드 저장 (더미 레코드)
        await svc.from('platform_searches').insert({
          user_id: user.id,
          platform: 'youtube',
          search_type: 'keyword',
          keyword: searchRequest.query.trim(),
          results_count: 0, // 키워드 저장만을 위한 더미 count
          credits_used: 0, // 키워드 저장만을 위한 더미 cost
          created_at: new Date().toISOString()
        })
      }
    } catch (historyError) {
      console.error('YouTube 검색 기록 저장 실패:', historyError)
    }

    // 검색 통계 업데이트 (모든 사용자)
    
    try {
      const todayUtc = new Date()
      const yyyy = todayUtc.getUTCFullYear()
      const mm = String(todayUtc.getUTCMonth() + 1).padStart(2, '0')
      const firstOfMonth = `${yyyy}-${mm}-01`
      const todayStr = todayUtc.toISOString().slice(0,10)
      
      const { data: row } = await svc.from('search_counters')
        .select('month_start,month_count,today_date,today_count')
        .eq('user_id', user.id)
        .single()
        
      let month_start = row?.month_start || firstOfMonth
      let month_count = Number(row?.month_count || 0)
      let today_date = row?.today_date || todayStr
      let today_count = Number(row?.today_count || 0)
      
      // reset if month crossed
      if (String(month_start) !== firstOfMonth) { 
        month_start = firstOfMonth 
        month_count = 0 
      }
      // reset if day crossed
      if (String(today_date) !== todayStr) { 
        today_date = todayStr
        today_count = 0 
      }
      
      month_count += 1
      today_count += 1
      
      const { error: counterError } = await svc.from('search_counters').upsert({ 
        user_id: user.id,
        month_start, 
        month_count, 
        today_date, 
        today_count, 
        updated_at: new Date().toISOString()
      })
      
      if (counterError) {
        console.error('YouTube 검색 통계 업데이트 실패:', counterError)
      } else {
        console.log(`YouTube 검색 통계 업데이트 성공: 오늘 ${today_count}회, 이번달 ${month_count}회`)
      }
    } catch (statsError) {
      console.error('YouTube 검색 통계 업데이트 실패:', statsError)
    }

    return NextResponse.json({
      success: true,
      platform: 'youtube',
      results: searchResponse?.results || [],
      totalCount: searchResponse?.totalCount || 0,
      searchType: searchResponse?.searchType || 'keyword',
      creditsUsed: actualCredits || 0,
      metadata: searchResponse?.metadata || {}
    })

  } catch (error) {
    // Zod 유효성 검사 오류 처리
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.', details: error.issues },
        { status: 400 }
      )
    }

    // 변수 존재 여부 확인 (catch 블록에서는 상위 스코프 변수에 접근할 수 없을 수 있음)
    let localIsAdmin = false
    let localTransactionId = null
    let localSupabase = null
    
    try {
      // 다시 supabase 인스턴스 생성
      localSupabase = await supabaseServer()
      const { data: { user } } = await localSupabase.auth.getUser()
      
      if (user) {
        const { data: userData } = await localSupabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        
        localIsAdmin = userData?.role === 'admin'
      }
    } catch {
      // 재인증 실패 시 무시
    }

    // 오류 로깅
    console.error('YouTube 검색 오류 상세:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      isAdmin: localIsAdmin
    })

    // 크레딧 롤백 시도 (가능한 경우에만)
    if (!localIsAdmin && localTransactionId && localSupabase) {
      try {
        await localSupabase.rpc('rollback_credits', { transaction_id: localTransactionId })
      } catch (rollbackError) {
        console.error('크레딧 롤백 실패:', rollbackError)
      }
    }

    // YouTube API 에러 처리
    if (error instanceof YouTubeAPIError) {
      let errorMessage = error.message
      let statusCode = 500

      switch (error.code) {
        case 'QUOTA_EXCEEDED':
          errorMessage = 'YouTube API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          statusCode = 429
          break
        case 'KEY_INVALID':
          errorMessage = 'YouTube API 키가 유효하지 않습니다.'
          statusCode = 500
          break
        default:
          errorMessage = `YouTube API 오류: ${error.message}`
          statusCode = 500
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      )
    }

    // 일반 오류 처리
    console.error('YouTube 검색 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
