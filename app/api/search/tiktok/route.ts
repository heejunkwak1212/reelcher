import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { searchLimiter } from '@/lib/ratelimit'
import { ITikTokSearchRequest, ITikTokVideo } from '@/types'
import { z } from 'zod'
import { startTaskRun, waitForRunItems } from '@/lib/apify'

export const runtime = 'nodejs'

// TikTok 검색 요청 스키마
const tiktokSearchSchema = z.object({
  searchType: z.enum(['keyword', 'hashtag', 'url', 'profile']), // 프로필 검색 추가
  query: z.string().min(1),
  resultsLimit: z.union([z.literal(5), z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  filters: z.object({
    period: z.enum(['day', 'week', 'month', 'month2', 'month3', 'month6', 'year', 'all']).optional(),
    minViews: z.number().min(0).optional(),

    sortBy: z.enum(['trending', 'recent', 'most_liked']).optional()
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
  console.log('🔍 TikTok API - User ID:', user.id)
  console.log('🔍 TikTok API - User Email:', user.email)

    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const validatedData = tiktokSearchSchema.parse(body)
    const searchRequest: ITikTokSearchRequest = {
      ...validatedData,
      resultsLimit: validatedData.resultsLimit as 5 | 30 | 60 | 90 | 120
    }

    // 사용자 정보 조회 (관리자 확인용)
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    console.log('TikTok 검색 - 사용자 정보 확인:', {
      userId: user.id,
      userData,
      userError,
      userRole: userData?.role
    })

    const isAdmin = userData?.role === 'admin'
    let transactionId = null

    console.log('TikTok 검색 - 관리자 여부:', isAdmin, 'resultsLimit:', searchRequest.resultsLimit)

    // 플랜별 제한 확인 (관리자가 아닌 경우에만)
    if (!isAdmin) {
      // 플랜 정보 조회
      const { data: planData, error: planError } = await supabase
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .single()

      const userPlan = planData?.plan || 'free'
      console.log('TikTok 검색 - 사용자 플랜:', userPlan)

      // 플랜별 결과 수 제한
      const resultsLimit = searchRequest.resultsLimit
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
    }

    // 관리자가 아닌 경우에만 크레딧 처리
    if (!isAdmin) {
      // 크레딧 계산 (TikTok은 Instagram과 동일)
      const creditCosts: Record<number, number> = {
        5: 0,     // 개발용 - 무료
        30: 100,  // Instagram과 동일
        60: 200,  // Instagram과 동일  
        90: 300,  // Instagram과 동일
        120: 400  // Instagram과 동일
      }
      const requiredCredits = creditCosts[searchRequest.resultsLimit] || 0

      // 크레딧이 필요한 경우에만 잔액 확인 (예약 시스템 제거)
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

        console.log(`💰 TikTok 크레딧 사전 확인 완료: 잔액=${creditData.balance}, 필요=${requiredCredits}`)
      }
    }

    // settle 함수 준비 (Instagram과 동일한 방식)
    let settle: null | ((finalCount: number) => Promise<number>) = null
    settle = async (finalCount: number) => {
      if (isAdmin) return 0
      
      // 실제 사용할 크레딧 계산 (proration)
      const toCharge = Math.floor((finalCount / 30) * 100)
      console.log(`💰 TikTok settle 함수 - 결과수: ${finalCount}, 차감: ${toCharge}`)
      
      // 실제 크레딧 차감
      if (toCharge > 0) {
        try {
          const { data: currentCredits } = await supabase
            .from('credits')
            .select('balance')
            .eq('user_id', user.id)
            .single()
          
          if (currentCredits) {
            const newBalance = Math.max(0, currentCredits.balance - toCharge)
            
            await supabase
              .from('credits')
              .update({ balance: newBalance })
              .eq('user_id', user.id)
            
            console.log(`✅ TikTok 크레딧 차감 성공: ${toCharge} (${currentCredits.balance} → ${newBalance})`)
          }
        } catch (error) {
          console.error('❌ TikTok 크레딧 차감 오류:', error)
        }
      }
      
      return toCharge // 실제 차감된 크레딧 반환
    }

    try {
      // 새로운 TikTok Scraper Task 실행 (향상된 기능 포함)
      console.log(`TikTok 검색 시작 - ${searchRequest.resultsLimit}개 요청 (새 Task: mlyTt5q6sAjY7z9ZV)`)
      
      // 검색 타입에 따른 입력 설정
      const isUrlSearch = searchRequest.searchType === 'url' && searchRequest.query.includes('tiktok.com')
      const isProfileSearch = searchRequest.searchType === 'profile'
      
      // 성공 사례 기반 기본 taskInput 구조
      const taskInput: any = {
        excludePinnedPosts: false,
        proxyCountryCode: "None",
        resultsPerPage: searchRequest.resultsLimit,
        scrapeRelatedVideos: false, // 성공 사례에서는 false
        shouldDownloadAvatars: false, // 성공 사례에서는 false
        shouldDownloadCovers: true,
        shouldDownloadMusicCovers: false,
        shouldDownloadSlideshowImages: false, // 성공 사례에서는 false
        shouldDownloadSubtitles: true,
        shouldDownloadVideos: true,
        maxProfilesPerQuery: 10
      }
      
      // 검색 타입별 입력 설정
      if (isProfileSearch) {
        // 프로필 검색: profiles 필드 사용
        let profileName = searchRequest.query.trim()
        
        // URL에서 프로필명 추출 (https://www.tiktok.com/@username 형식)
        if (profileName.includes('tiktok.com/@')) {
          const match = profileName.match(/tiktok\.com\/@([^/?]+)/)
          if (match) {
            profileName = match[1]
          }
        }
        
        // @ 제거 (있는 경우)
        if (profileName.startsWith('@')) {
          profileName = profileName.substring(1)
        }
        
        // 성공 사례와 정확히 동일한 설정
        taskInput.profiles = [profileName]
        taskInput.searchSection = "/video"
        taskInput.profileScrapeSections = ["videos"]
        taskInput.profileSorting = "latest" // 성공 사례에서는 latest
        
        // 업로드 기간 설정 (period 기반)
        const period = searchRequest.filters.period
        console.log(`🔍 TikTok 프로필 검색 기간 필터 - period: ${period}`)
        
        if (period && period !== 'all') {
          // period 값을 oldestPostDateUnified 형식으로 변환
          const periodMap: Record<string, string> = {
            'day': '1 day',
            'week': '1 week', 
            'month': '1 month',
            'month2': '2 months',
            'month3': '3 months',
            'month6': '6 months',
            'year': '1 year'
          }
          taskInput.oldestPostDateUnified = periodMap[period] || "2 months"
          console.log(`✅ TikTok 프로필 검색 (기간 필터): ${profileName}, period: ${period} → ${taskInput.oldestPostDateUnified}`)
        } else {
          // 기간이 설정되지 않았거나 'all'인 경우 기본값
          taskInput.oldestPostDateUnified = "2 months" 
          console.log(`TikTok 프로필 검색 (기본 기간): ${profileName}, 기간: 2개월`)
        }
      } else if (isUrlSearch) {
        // URL 검색: postURLs 필드 사용
        (taskInput as any).postURLs = [searchRequest.query]
        console.log(`TikTok URL 기반 연관 영상 검색: ${searchRequest.query}`)
      } else {
        // 키워드 검색: 새로운 키워드 전용 액터 사용하여 성공 사례와 동일한 구조
        const keywords = Array.isArray((searchRequest as any).keywords) 
          ? (searchRequest as any).keywords 
          : [searchRequest.query]
        
        taskInput.hashtags = keywords.map((kw: string) => 
          kw.replace(/^#/, '').trim()
        ).filter(Boolean)
        
        // 키워드 검색 전용 설정 (성공 사례 기반)
        taskInput.profileScrapeSections = ["videos"]
        taskInput.profileSorting = "latest"
        taskInput.searchSection = "/video"
        taskInput.shouldDownloadSubtitles = false // 키워드 검색에서는 false
        
        // 업로드 기간 설정 (키워드 검색도 period 기반)
        const period = searchRequest.filters.period
        console.log(`🔍 TikTok 키워드 검색 기간 필터 - period: ${period}`)
        
        if (period && period !== 'all') {
          const periodMap: Record<string, string> = {
            'day': '1 day',
            'week': '1 week', 
            'month': '1 month',
            'month2': '2 months',
            'month3': '3 months',
            'month6': '6 months',
            'year': '1 year'
          }
          taskInput.oldestPostDateUnified = periodMap[period] || "3 months"
          console.log(`✅ TikTok 키워드 검색 (기간 필터): ${taskInput.hashtags}, period: ${period} → ${taskInput.oldestPostDateUnified}`)
        } else {
          // 기간이 설정되지 않았거나 'all'인 경우 기본값
          taskInput.oldestPostDateUnified = "3 months"
          console.log(`TikTok 키워드 검색 (기본 기간): ${taskInput.hashtags}, 기간: 3개월`)
        }
      }
      
      // 실제 전송되는 taskInput 로깅 (디버깅용)
      console.log('📋 TikTok API로 전송되는 최종 taskInput:', JSON.stringify(taskInput, null, 2))
      
      // 검색 타입에 따라 다른 액터 사용
      const taskId = isProfileSearch 
        ? 'interesting_dingo/tiktok-scraper-task' // 프로필 검색용 기존 액터
        : 'interesting_dingo/tiktok-scraper-task-2' // 키워드 검색용 새 액터
      
      const started = await startTaskRun({ 
        taskId, 
        token: process.env.APIFY_TOKEN!, 
        input: taskInput
      })
      
      console.log(`TikTok Task 시작됨 - runId: ${started.runId}`)
      
      const run = await waitForRunItems({ token: process.env.APIFY_TOKEN!, runId: started.runId })
      const items = Array.isArray(run.items) ? run.items : []
      
      console.log(`TikTok 검색 완료 - 반환된 아이템: ${items.length}개 (요청: ${searchRequest.resultsLimit}개)`)
      
      // 첫 번째 아이템 구조 디버깅
      if (items.length > 0) {
        console.log('TikTok 첫 번째 아이템 구조:', JSON.stringify(items[0], null, 2))
      }
      
      // TikTok 데이터를 표준 형식으로 변환 (안전한 매핑)
      const videos: ITikTokVideo[] = items.map((item: any) => {
        // 안전한 데이터 추출
        const videoId = item.id || item.videoId || `tiktok_${Date.now()}_${Math.random()}`
        const username = item.authorMeta?.name || item.username || 'unknown'
        const authorName = item.authorMeta?.nickName || item.authorName || username
        const webVideoUrl = item.webVideoUrl || `https://www.tiktok.com/@${username}/video/${videoId}`
        
        return {
          videoId,
          title: item.text || item.title || '',
          description: item.text || item.description || '',
          username,
          authorName,
          publishedAt: item.createTimeISO || (item.createTime ? new Date(item.createTime * 1000).toISOString() : new Date().toISOString()),
          thumbnailUrl: item.videoMeta?.coverUrl || item.videoMeta?.originalCoverUrl || null,
          videoUrl: item.mediaUrls?.[0] || item.videoMeta?.downloadAddr || webVideoUrl,
          duration: Number(item.videoMeta?.duration) || 0,
          viewCount: Number(item.playCount) || 0,
          likeCount: Number(item.diggCount) || 0,
          commentCount: Number(item.commentCount) || 0,
          shareCount: Number(item.shareCount) || 0,
          followersCount: Number(item.authorMeta?.fans) || 0,
          hashtags: Array.isArray(item.hashtags) ? item.hashtags.map((tag: any) => tag?.name || tag || '') : [],
          musicInfo: item.musicMeta ? {
            musicName: item.musicMeta.musicName || '',
            musicAuthor: item.musicMeta.musicAuthor || ''
          } : undefined
        }
      })

      // 필터 적용
      let filteredVideos = videos

      if (searchRequest.filters.minViews && searchRequest.filters.minViews > 0) {
        filteredVideos = filteredVideos.filter(v => v.viewCount >= searchRequest.filters.minViews!)
      }

      // 정렬 적용
      if (searchRequest.filters.sortBy) {
        switch (searchRequest.filters.sortBy) {
          case 'trending':
            filteredVideos.sort((a, b) => b.viewCount - a.viewCount)
            break
          case 'recent':
            filteredVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
            break
          case 'most_liked':
            filteredVideos.sort((a, b) => b.likeCount - a.likeCount)
            break
        }
      }

      // 요청한 결과 개수로 정확히 자르기
      const finalResults = filteredVideos.slice(0, searchRequest.resultsLimit)
      
      // 실제 결과 수 계산 (관리자/일반 사용자 공통)
      const actualResults = finalResults.length
      const actualCredits = isAdmin ? 0 : Math.floor((actualResults / 30) * 100) // 30개당 100크레딧, 관리자는 0

      // 관리자가 아닌 경우에만 크레딧 정산
      if (!isAdmin && transactionId) {
        // 크레딧 커밋 (정산)
        const { error: commitError } = await supabase.rpc(
          'commit_credits',
          {
            transaction_id: transactionId,
            actual_amount: actualCredits,
            metadata: {
              platform: 'tiktok',
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

      // Supabase 서비스 클라이언트 생성 (검색 기록 및 통계 업데이트용)
      const svc = (await import('@/lib/supabase/service')).supabaseService()
      
      // 검색 기록 저장은 클라이언트의 /api/me/search-record에서 처리 (중복 방지)
      console.log(`📝 TikTok 검색 완료 - 결과: ${actualResults}개, 크레딧: ${actualCredits} (기록은 클라이언트에서 처리)`)
      
      // 키워드 최근 검색 기록은 search_history에서 자동 관리됨 (중복 방지)
      console.log(`📝 TikTok 키워드 최근 검색 기록 - search_history에서 자동 처리됨`)

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
          console.error('TikTok 검색 통계 업데이트 실패:', counterError)
        } else {
          console.log(`TikTok 검색 통계 업데이트 성공: 오늘 ${today_count}회, 이번달 ${month_count}회`)
        }
      } catch (statsError) {
        console.error('TikTok 검색 통계 업데이트 실패:', statsError)
      }

      // Instagram과 동일한 응답 형식 사용 (items 필드)
      const response = {
        items: finalResults, // Instagram과 동일한 필드명
        debug: {
          platform: 'tiktok',
          searchType: searchRequest.searchType,
          query: searchRequest.query,
          actualResults,
          requestedResults: searchRequest.resultsLimit,
          totalFound: videos.length
        },
        credits: {
          used: actualCredits,
          basis: 100,
          per: 30
        }
      }

      console.log('TikTok API 최종 응답 구조 (Instagram 형식):', {
        itemsCount: response.items.length,
        firstItem: response.items[0] ? {
          videoId: response.items[0].videoId,
          title: response.items[0].title,
          username: response.items[0].username,
          viewCount: response.items[0].viewCount
        } : null,
        debug: response.debug
      })

      // ==========================================
      // 🔄 크레딧 정산 및 기록 저장 (TikTok)
      // ==========================================
      
      // 크레딧 정산 (settle 함수 사용)
      const actualCreditsUsed = settle ? await settle(response.items?.length || 0) : 0
      console.log(`💰 TikTok 실제 크레딧 사용량: ${actualCreditsUsed} (결과 수: ${response.items?.length || 0})`)
      
      // 검색 기록은 클라이언트의 /api/me/search-record에서 처리 (중복 방지)
      console.log(`📝 TikTok 해시태그 검색 완료 - 결과: ${response.items?.length || 0}개, 크레딧: ${actualCreditsUsed} (기록은 클라이언트에서 처리)`)

      return NextResponse.json(response)

    } catch (searchError) {
      // 오류 로깅 추가
      console.error('TikTok 검색 오류 상세:', {
        error: searchError,
        message: searchError instanceof Error ? searchError.message : 'Unknown error',
        stack: searchError instanceof Error ? searchError.stack : undefined
      })

      // 검색 실패 시 크레딧 롤백은 클라이언트에서 처리됨

      console.error('TikTok 검색 오류:', searchError)
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

    console.error('TikTok 검색 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
