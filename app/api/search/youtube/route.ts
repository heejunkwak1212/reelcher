import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { searchLimiter } from '@/lib/ratelimit'
import { YouTubeClient, YouTubeAPIError } from '@/lib/youtube'
import { IYouTubeSearchRequest } from '@/types'
import { z } from 'zod'

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

    try {
      // YouTube API 클라이언트 생성
      const youtubeClient = new YouTubeClient(youtubeApiKey)

      // 검색 수행
      let searchResponse
      if (searchRequest.searchType === 'url') {
        searchResponse = await youtubeClient.searchSimilarVideos(searchRequest)
      } else {
        searchResponse = await youtubeClient.searchByKeyword(searchRequest)
      }

      // 실제 결과 수 계산 (관리자/일반 사용자 공통)
      const actualResults = searchResponse.results.length
      const actualCredits = isAdmin ? 0 : Math.floor((actualResults / 30) * 50) // 30개당 50크레딧, 관리자는 0

      // 관리자가 아닌 경우에만 크레딧 정산
      if (!isAdmin && transactionId) {
        // 크레딧 커밋 (정산)
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

      // 검색 기록 저장
      const { error: historyError } = await supabase
        .from('searches')
        .insert({
          user_id: user.id,
          platform: 'youtube',
          search_type: searchRequest.searchType,
          keyword: searchRequest.query,
          url: searchRequest.url,
          filters: searchRequest.filters,
          results_count: actualResults,
          credits_used: actualCredits
        })

      if (historyError) {
        console.error('검색 기록 저장 실패:', historyError)
        // 검색 기록 저장 실패는 응답에 영향을 주지 않음
      }

      return NextResponse.json({
        success: true,
        platform: 'youtube',
        results: searchResponse.results,
        totalCount: searchResponse.totalCount,
        searchType: searchResponse.searchType,
        creditsUsed: actualCredits,
        metadata: searchResponse.metadata
      })

    } catch (searchError) {
      // 오류 로깅 추가
      console.error('YouTube 검색 오류 상세:', {
        error: searchError,
        message: searchError instanceof Error ? searchError.message : 'Unknown error',
        stack: searchError instanceof Error ? searchError.stack : undefined,
        searchRequest,
        isAdmin,
        transactionId
      })

      // 검색 실패 시 크레딧 롤백 (관리자가 아닌 경우에만)
      if (!isAdmin && transactionId) {
        await supabase.rpc('rollback_credits', { transaction_id: transactionId })
      }

      if (searchError instanceof YouTubeAPIError) {
        let errorMessage = searchError.message
        let statusCode = 500

        switch (searchError.code) {
          case 'QUOTA_EXCEEDED':
            errorMessage = 'YouTube API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
            statusCode = 429
            break
          case 'KEY_INVALID':
            errorMessage = 'YouTube API 키가 유효하지 않습니다.'
            statusCode = 500
            break
          default:
            errorMessage = `YouTube API 오류: ${searchError.message}`
            statusCode = 500
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: statusCode }
        )
      }

      console.error('YouTube 검색 오류:', searchError)
      return NextResponse.json(
        { error: '검색 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.', details: error.issues },
        { status: 400 }
      )
    }

    console.error('YouTube 검색 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
