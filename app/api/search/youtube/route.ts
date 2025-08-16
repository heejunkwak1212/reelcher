import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { YouTubeClient, YouTubeAPIError } from '@/lib/youtube'
import { IYouTubeSearchRequest } from '@/types'
import { z } from 'zod'

// YouTube 검색 요청 스키마
const youtubeSearchSchema = z.object({
  searchType: z.enum(['keyword', 'url']),
  query: z.string().min(1),
  url: z.string().optional(),
  resultsLimit: z.enum([30, 60, 90, 120]),
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
    const rateLimitResult = await rateLimit(request)
    if (rateLimitResult.limited) {
      return NextResponse.json(
        { error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    // 사용자 인증 확인
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const searchRequest = youtubeSearchSchema.parse(body) as IYouTubeSearchRequest

    // YouTube API 키 확인
    const youtubeApiKey = process.env.YOUTUBE_API_KEY
    if (!youtubeApiKey) {
      return NextResponse.json(
        { error: 'YouTube API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // 크레딧 계산 (YouTube는 Instagram보다 저렴하게)
    const creditCosts = {
      30: 50,   // Instagram 100 → YouTube 50
      60: 100,  // Instagram 200 → YouTube 100
      90: 150,  // Instagram 300 → YouTube 150
      120: 200  // Instagram 400 → YouTube 200
    }
    const requiredCredits = creditCosts[searchRequest.resultsLimit]

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

    const transactionId = reservationData.transaction_id

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

      // 실제 결과 수에 따른 크레딧 정산
      const actualResults = searchResponse.results.length
      const actualCredits = Math.floor((actualResults / 30) * 50) // 30개당 50크레딧

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
      // 검색 실패 시 크레딧 롤백
      await supabase.rpc('rollback_credits', { transaction_id: transactionId })

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
        { error: '잘못된 요청 형식입니다.', details: error.errors },
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
