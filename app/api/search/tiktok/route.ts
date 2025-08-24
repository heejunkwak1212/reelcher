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
    minLikes: z.number().min(0).optional(), // 최소 좋아요 수 필터 (프로필 검색 전용)
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

    try {
      // 새로운 TikTok Scraper Task 실행 (향상된 기능 포함)
      console.log(`TikTok 검색 시작 - ${searchRequest.resultsLimit}개 요청 (새 Task: mlyTt5q6sAjY7z9ZV)`)
      
      // 검색 타입에 따른 입력 설정
      const isUrlSearch = searchRequest.searchType === 'url' && searchRequest.query.includes('tiktok.com')
      const isProfileSearch = searchRequest.searchType === 'profile'
      
      const taskInput = {
        resultsPerPage: searchRequest.resultsLimit,
        resultsLimit: searchRequest.resultsLimit, // 결과 개수 정확히 제한
        excludePinnedPosts: false,
        profileSorting: "popular", // 인기순 정렬
        proxyCountryCode: "None",
        scrapeRelatedVideos: true, // 항상 연관 영상 스크래핑 활성화
        shouldDownloadAvatars: isProfileSearch, // 프로필 검색 시에만 아바타 다운로드
        shouldDownloadCovers: true,
        shouldDownloadMusicCovers: false,
        shouldDownloadSlideshowImages: true,
        shouldDownloadSubtitles: true,
        shouldDownloadVideos: true,
        maxItems: searchRequest.resultsLimit // 최대 아이템 수 제한
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
        
        (taskInput as any).profiles = [profileName]
        ;(taskInput as any).searchSection = "/video"
        ;(taskInput as any).profileScrapeSections = ["videos"]
        ;(taskInput as any).maxProfilesPerQuery = 10
        
        // 최소 좋아요 수 필터 적용 (프로필 검색 전용)
        if (searchRequest.filters.minLikes && searchRequest.filters.minLikes > 0) {
          ;(taskInput as any).leastDiggs = searchRequest.filters.minLikes
        }
        
        console.log(`TikTok 프로필 검색: ${profileName}, 최소 좋아요: ${searchRequest.filters.minLikes || 0}`)
      } else if (isUrlSearch) {
        // URL 검색: postURLs 필드 사용
        (taskInput as any).postURLs = [searchRequest.query]
        console.log(`TikTok URL 기반 연관 영상 검색: ${searchRequest.query}`)
      } else {
        // 키워드/해시태그 검색: hashtags 필드 사용
        (taskInput as any).hashtags = [searchRequest.query]
        console.log(`TikTok 해시태그 검색: ${searchRequest.query}`)
      }
      
      const started = await startTaskRun({ 
        taskId: 'distracting_wholemeal/tiktok-scraper-task', // 새로운 스크래퍼 ID
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
      
      // TikTok 검색 기록 저장 (platform_searches 테이블 사용)
      try {
        const { error: historyError } = await svc
          .from('platform_searches')
          .insert({
            user_id: user.id,
            platform: 'tiktok',
            search_type: searchRequest.searchType,
            keyword: searchRequest.query,
            filters: searchRequest.filters,
            results_count: actualResults,
            credits_used: actualCredits
          })

        if (historyError) {
          console.error('TikTok 검색 기록 저장 실패:', historyError)
          // 검색 기록 저장 실패는 응답에 영향을 주지 않음
        }
        
        // 키워드 검색인 경우에만 최근 키워드로 저장 (2일간 보관)
        if (searchRequest.searchType === 'keyword' && searchRequest.query?.trim()) {
          // 2일 이상된 키워드 기록 정리
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
          await svc.from('platform_searches')
            .delete()
            .eq('user_id', user.id)
            .eq('platform', 'tiktok')
            .eq('search_type', 'keyword')
            .eq('results_count', 0) // 키워드 저장용 더미 레코드만 삭제
            .is('credits_used', null) // null로 구분
            .lt('created_at', twoDaysAgo)
          
          // 기존 동일 키워드 더미 레코드 삭제 (중복 방지)
          await svc.from('platform_searches')
            .delete()
            .eq('user_id', user.id)
            .eq('platform', 'tiktok')
            .eq('search_type', 'keyword')
            .eq('keyword', searchRequest.query.trim())
            .eq('results_count', 0) // 키워드 저장용 더미 레코드만 삭제
            .is('credits_used', null) // null로 구분
          
          // 최근 키워드 저장 (더미 레코드)
          await svc.from('platform_searches').insert({
            user_id: user.id,
            platform: 'tiktok',
            search_type: 'keyword',
            keyword: searchRequest.query.trim(),
            results_count: 0, // 키워드 저장만을 위한 더미 count
            credits_used: null, // null로 구분 (관리자 0과 구분)
            created_at: new Date().toISOString()
          })
        }
      } catch (historyError) {
        console.error('TikTok 검색 기록 저장 실패:', historyError)
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
      // 🔄 단순화된 후처리 로직 (TikTok)
      // ==========================================
      
      // 1. 동적 크레딧 계산
      const actualCreditsUsed = isAdmin ? 0 : Math.floor((response.items?.length || 0) / 30) * 100 // TikTok은 100크레딧
      console.log(`💰 TikTok 실제 크레딧 사용량: ${actualCreditsUsed} (결과 수: ${response.items?.length || 0})`)
      
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
            
            console.log(`💰 TikTok 크레딧 차감 세부사항:`, {
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
              console.error('❌ TikTok 크레딧 차감 실패:', creditError)
            } else {
              console.log(`✅ TikTok 크레딧 차감 성공: ${actualCreditsUsed}`)
            }
          }
        } catch (error) {
          console.error('❌ TikTok 크레딧 차감 오류:', error)
        }
      }
      
      // 2. B. 검색 기록 저장 (search_history 테이블 직접 INSERT)
      try {
        const { error: logError } = await supabase
          .from('search_history')
          .insert({
            user_id: user.id,
            platform: 'tiktok', // 플랫폼 명시
            search_type: searchRequest.searchType || 'hashtag',
            keyword: searchRequest.query || '',
            filters: searchRequest.filters || {},
            results_count: response.items?.length || 0,
            credits_used: actualCreditsUsed
          })
        
        if (logError) {
          console.error('❌ TikTok 검색 기록 저장 실패:', logError)
        } else {
          console.log('✅ TikTok 검색 기록 저장 성공 (search_history)')
        }
      } catch (error) {
        console.error('❌ TikTok 검색 기록 저장 오류:', error)
      }

      return NextResponse.json(response)

    } catch (searchError) {
      // 오류 로깅 추가
      console.error('TikTok 검색 오류 상세:', {
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
