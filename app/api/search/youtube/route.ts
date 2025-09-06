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
    videoDuration: z.enum(['any', 'short', 'medium', 'long']).optional(),
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

    // 디버깅: 사용자 정보 로깅
    // YouTube API 사용자 인증 (프로덕션 보안을 위해 상세 로깅 제거)
    // YouTube API 사용자 이메일 (프로덕션 보안을 위해 상세 로깅 제거)

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
    let requiredCredits = 0 // 스코프 이동

    console.log('관리자 여부:', isAdmin, 'resultsLimit:', searchRequest.resultsLimit)

    // 플랜별 제한 확인 (관리자가 아닌 경우에만)
    if (!isAdmin) {
      // 플랜 정보 조회
      const { data: planData, error: planError } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .single()

      const userPlan = planData?.plan || 'free'
      console.log('YouTube 검색 - 사용자 플랜:', userPlan)

      // 플랜별 결과 수 제한
      const resultsLimit = searchRequest.resultsLimit
      
      if (searchRequest.searchType === 'keyword') {
        // 키워드 검색: 30/60/90/120
        if (userPlan === 'free' && ![5, 30].includes(resultsLimit)) {
          return NextResponse.json(
            { error: 'FREE 플랜은 30개까지만 가능합니다.' },
            { status: 403 }
          )
        }
        if (userPlan === 'starter' && ![5, 30, 60].includes(resultsLimit)) {
          return NextResponse.json(
            { error: 'STARTER 플랜은 60개까지만 가능합니다.' },
            { status: 403 }
          )
        }
        if (userPlan === 'pro' && ![5, 30, 60, 90].includes(resultsLimit)) {
          return NextResponse.json(
            { error: 'PRO 플랜은 90개까지만 가능합니다.' },
            { status: 403 }
          )
        }
      } else {
        // URL 검색: FREE → 15개, STARTER → 30개, PRO부터 → 50개
        if (userPlan === 'free' && ![5, 15].includes(resultsLimit)) {
          return NextResponse.json(
            { error: 'FREE 플랜은 15개까지만 가능합니다.' },
            { status: 403 }
          )
        }
        if (userPlan === 'starter' && ![5, 15, 30].includes(resultsLimit)) {
          return NextResponse.json(
            { error: 'STARTER 플랜은 30개까지만 가능합니다.' },
            { status: 403 }
          )
        }
        if (['pro', 'business'].includes(userPlan) && ![5, 15, 30, 50].includes(resultsLimit)) {
          return NextResponse.json(
            { error: 'PRO 플랜 이상은 50개까지만 가능합니다.' },
            { status: 403 }
          )
        }
      }
    }

    // 관리자가 아닌 경우에만 search-record 생성 및 크레딧 차감
    let expectedCredits = 0
    let searchRecordId: string | null = null
    
    if (!isAdmin) {
      // 크레딧 계산 (YouTube는 Instagram보다 저렴하게)
      const creditCosts: Record<number, number> = {
        5: 0,     // 개발용 - 무료
        15: 25,   // 영상기반 검색 15개
        30: 50,   // Instagram 100 → YouTube 50
        60: 100,  // Instagram 200 → YouTube 100
        90: 150,  // Instagram 300 → YouTube 150
        120: 200  // Instagram 400 → YouTube 200
      }
      expectedCredits = creditCosts[searchRequest.resultsLimit] || 0

      // search-record 생성 (크레딧 즉시 차감)
      if (expectedCredits > 0) {
        console.log(`💰 YouTube 검색 예상 크레딧: ${expectedCredits}`)
        
        const searchRecordPayload = {
          platform: 'youtube',
          search_type: searchRequest.searchType,
          keyword: searchRequest.query,
          expected_credits: expectedCredits,
          requested_count: searchRequest.resultsLimit,
          status: 'processing'
        }

        const searchRecordResponse = await fetch(new URL('/api/me/search-record', request.url), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify(searchRecordPayload)
        })

        if (searchRecordResponse.ok) {
          const searchRecordData = await searchRecordResponse.json()
          searchRecordId = searchRecordData.id
          console.log(`✅ search-record 생성 완료: ${searchRecordId}`)
        } else {
          const error = await searchRecordResponse.json()
          console.error(`❌ search-record 생성 실패: ${error.error}`)
          return NextResponse.json(
            { error: error.error || '크레딧 차감 실패' },
            { status: searchRecordResponse.status }
          )
        }
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

    // ==========================================
    // 🔄 검색 완료 후 search-record 업데이트 (YouTube)
    // ==========================================
    
    // 검색 완료 시 search-record 업데이트
    if (!isAdmin && searchRecordId && expectedCredits > 0) {
      try {
        console.log(`🔄 YouTube 검색 완료, search-record 업데이트 시작`)

        // 실제 크레딧 사용량 계산 (proration - 정확한 공식 적용)
        const returned = actualResults
        const requested = searchRequest.resultsLimit

        // 정확한 크레딧 계산: 결과 개수에 따른 비례 계산
        const baseCredits = expectedCredits / requested  // 개당 크레딧
        const actualCredits = Math.floor(returned * baseCredits)  // 실제 결과 개수 × 개당 크레딧

        console.log(`💰 크레딧 계산 상세 - 요청:${requested}, 결과:${returned}, 개당:${baseCredits.toFixed(2)}, 실제차감:${actualCredits}`)

        // search-record 업데이트 (결과 수 및 실제 크레딧 사용량)
        const updatePayload = {
          id: searchRecordId,
          results_count: actualResults,
          actual_credits: actualCredits,
          status: 'completed'
        }

        console.log(`📝 search-record 업데이트 요청:`, updatePayload)

        const updateResponse = await fetch(new URL('/api/me/search-record', request.url), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          },
          body: JSON.stringify(updatePayload)
        })

        if (updateResponse.ok) {
          const updateData = await updateResponse.json()
          console.log(`✅ search-record 업데이트 완료: 실제 크레딧 ${actualCredits}, 환불 ${updateData.refundAmount || 0}`)
        } else {
          console.error(`❌ search-record 업데이트 실패: ${updateResponse.status}`)
        }
      } catch (error) {
        console.error('❌ search-record 업데이트 중 오류:', error)
      }
    }
    
    console.log(`📝 YouTube 검색 완료 - 결과: ${actualResults}개, search-record ID: ${searchRecordId}`)

    return NextResponse.json({
      success: true,
      platform: 'youtube',
      results: searchResponse?.results || [],
      totalCount: searchResponse?.totalCount || 0,
      searchType: searchResponse?.searchType || 'keyword',
      creditsUsed: isAdmin ? 0 : expectedCredits, // search-record API에서 처리됨
      metadata: searchResponse?.metadata || {}
    })

  } catch (error) {
    // 검색 실패 시 search-record 업데이트는 catch 블록에서 변수에 접근할 수 없으므로 생략
    console.log('⚠️ YouTube 검색 실패 - search-record 업데이트는 클라이언트에서 처리됨')

    // Zod 유효성 검사 오류 처리
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.', details: error.issues },
        { status: 400 }
      )
    }

    // 변수 존재 여부 확인 (catch 블록에서는 상위 스코프 변수에 접근할 수 없을 수 있음)
    let localIsAdmin = false
    let localTransactionId: string | null = null
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

    // 예약 시스템 제거로 롤백 불필요

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
