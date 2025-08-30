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

    // 디버깅: 사용자 정보 로깅
    console.log('🔍 YouTube API - User ID:', user.id)
    console.log('🔍 YouTube API - User Email:', user.email)

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

    // 관리자가 아닌 경우에만 크레딧 확인 (예약 시스템 제거)
    if (!isAdmin) {
      // 크레딧 계산 (YouTube는 Instagram보다 저렴하게)
      const creditCosts: Record<number, number> = {
        5: 0,     // 개발용 - 무료
        30: 50,   // Instagram 100 → YouTube 50
        60: 100,  // Instagram 200 → YouTube 100
        90: 150,  // Instagram 300 → YouTube 150
        120: 200  // Instagram 400 → YouTube 200
      }
      requiredCredits = creditCosts[searchRequest.resultsLimit] || 0

      // 크레딧이 필요한 경우에만 잔액 확인
      if (requiredCredits > 0) {
        // 현재 크레딧 상태 확인
        const { data: creditData, error: creditError } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()

        if (creditError || !creditData) {
          return NextResponse.json(
            { error: '크레딧 정보를 확인할 수 없습니다.' },
            { status: 500 }
          )
        }

        // 잔여 크레딧 확인 (예약 없이 단순 잔액만 확인)
        if (creditData.balance < requiredCredits) {
          return NextResponse.json(
            { error: '크레딧이 부족합니다.' },
            { status: 402 }
          )
        }

        console.log(`💰 YouTube 크레딧 사전 확인 완료: 잔액=${creditData.balance}, 필요=${requiredCredits}`)
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
      try {
        // 현재 크레딧 상태 다시 조회
        const { data: currentCredit, error: getCurrentError } = await supabase
          .from('credits')
          .select('balance, reserved')
          .eq('user_id', user.id)
          .single()

        if (getCurrentError || !currentCredit) {
          throw new Error('크레딧 정보 조회 실패')
        }

        // 실제 차감할 크레딧 계산 (예약된 크레딧에서 차감하고, 차액은 반환)
        const refundAmount = requiredCredits - actualCredits
        
        // 크레딧 정산: balance에서 실제 크레딧 차감, reserved에서 예약 크레딧 제거
        const { error: commitError } = await supabase
          .from('credits')
          .update({
            balance: currentCredit.balance - actualCredits,
            reserved: Math.max(0, currentCredit.reserved - requiredCredits)
          })
          .eq('user_id', user.id)

        if (commitError) {
          throw commitError
        }

      } catch (error) {
        console.error('❌ YouTube 크레딧 차감 실패:', error)
      }
    }
    
    // 관리자 계정 로그
    if (isAdmin) {
      console.log('관리자 계정 - 크레딧 처리 생략 (무료)')
    }

    // ==========================================
    // 🔄 단순화된 후처리 로직 (Response 반환 직전)
    // ==========================================
    
    // 1. 동적 크레딧 계산 (실제 반환된 결과 수 기반)
    const actualCreditsUsed = isAdmin ? 0 : Math.floor((actualResults || 0) / 30) * 50 // YouTube는 50크레딧
    console.log(`💰 실제 크레딧 사용량: ${actualCreditsUsed} (결과 수: ${actualResults})`)
    
    // 2. A. 사용자 크레딧 차감 (credits 테이블 직접 UPDATE)
    if (!isAdmin && actualCreditsUsed > 0) {
      try {
        // 현재 크레딧 조회 후 차감
        const { data: currentCredits } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        
                if (currentCredits) {
          const newBalance = Math.max(0, currentCredits.balance - actualCreditsUsed)
          
          console.log(`💰 YouTube 크레딧 차감 세부사항:`, {
            사용자ID: user.id,
            현재잔액: currentCredits.balance,
            실제사용: actualCreditsUsed,
            새잔액: newBalance
          })
          
          const { error: creditError } = await supabase
            .from('credits')
            .update({
              balance: newBalance
            })
            .eq('user_id', user.id)
          
          if (creditError) {
            console.error('❌ 크레딧 차감 실패:', creditError)
          } else {
            console.log(`✅ YouTube 크레딧 차감 성공 - 실제사용: ${actualCreditsUsed}, 예약해제: ${requiredCredits}`)
          }
        }
      } catch (error) {
        console.error('❌ 크레딧 차감 오류:', error)
      }
    }
    
    // 검색 기록 저장은 클라이언트의 /api/me/search-record에서 처리 (중복 방지)
    console.log(`📝 YouTube 검색 완료 - 결과: ${actualResults}개, 크레딧: ${actualCreditsUsed} (기록은 클라이언트에서 처리)`)

    // 검색 통계 업데이트 (모든 사용자)
    
    try {
      const todayUtc = new Date()
      const yyyy = todayUtc.getUTCFullYear()
      const mm = String(todayUtc.getUTCMonth() + 1).padStart(2, '0')
      const firstOfMonth = `${yyyy}-${mm}-01`
      const todayStr = todayUtc.toISOString().slice(0,10)
      
      const { data: row } = await supabase.from('search_counters')
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
      
      const { error: counterError } = await supabase.from('search_counters').upsert({ 
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
      creditsUsed: actualCreditsUsed, // 실제 사용된 크레딧 반환
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
