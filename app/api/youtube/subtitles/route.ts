import { NextRequest, NextResponse } from 'next/server'
import { YouTubeDownloader } from '@/lib/youtube-downloader'
import { supabaseServer } from '@/lib/supabase/server'
import { searchLimiter, subtitleCooldown } from '@/lib/ratelimit'
import { z } from 'zod'

export const runtime = 'nodejs'

const subtitleSchema = z.object({
  url: z.string().url('유효한 URL을 입력해주세요'),
})

export async function POST(req: NextRequest) {
  // YouTube 자막 추출 기능 비활성화
  return NextResponse.json({ 
    error: 'YouTube 자막 추출 기능은 현재 사용할 수 없습니다. Instagram이나 TikTok 자막 추출을 이용해주세요.' 
  }, { status: 503 })
  
  /*
  // 기존 코드 주석 처리
  try {
    // 인증 확인
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    // 사용자 정보 확인 (관리자 체크) - profiles 테이블 사용
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin'
    let transactionId = null

    // 관리자가 아닌 경우에만 크레딧 처리
    if (!isAdmin) {
      const requiredCredits = 10 // 유튜브 자막 추출: 10 크레딧

      // 현재 크레딧 상태 확인
      const { data: creditData, error: creditError } = await supabase
        .from('credits')
        .select('balance, reserved')
        .eq('user_id', user.id)
        .single()

      if (creditError || !creditData) {
        return NextResponse.json(
          { error: '크레딧 정보를 확인할 수 없습니다.' },
          { status: 500 }
        )
      }

      // 사용 가능한 크레딧 확인 (예약 시스템 제거)
      if (creditData.balance < requiredCredits) {
        return NextResponse.json(
          { error: '크레딧이 부족합니다.' },
          { status: 402 }
        )
      }

      console.log(`💰 YouTube 자막 추출 크레딧 사전 확인 완료: 잔액=${creditData.balance}, 필요=${requiredCredits}`)
      transactionId = `youtube_subtitles_${Date.now()}_${requiredCredits}`
    }

    // 자막 추출 쿨다운 체크 (30초)
    if (subtitleCooldown) {
      const cooldownResult = await subtitleCooldown.limit(`subtitle-cooldown:${user.id}`)
      if (!cooldownResult.success) {
        return NextResponse.json({ 
          error: 'SUBTITLE_COOLDOWN',
          message: '과부하 방지를 위해 자막 추출은 30초 단위로 가능해요.',
          remainingTime: Math.ceil(cooldownResult.reset - Date.now() / 1000)
        }, { status: 429 })
      }
    }

    // Rate limiting: 사용자당 분당 3회 제한
    if (searchLimiter) {
      const rateLimitResult = await searchLimiter.limit(`youtube-subtitle:${user.id}`)
      if (!rateLimitResult.success) {
        return NextResponse.json({ 
          error: '자막 추출 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' 
        }, { status: 429 })
      }
    }

    // 요청 데이터 검증
    const body = await req.json()
    const { url } = subtitleSchema.parse(body)

    // YouTube URL 검증
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return NextResponse.json({ 
        error: 'YouTube URL만 지원됩니다' 
      }, { status: 400 })
    }

    // 자막 추출 시작 로깅
    console.log(`[YouTube Subtitle] 시작 - User: ${user.id}, URL: ${url}`)
    
    const result = await YouTubeDownloader.extractSubtitles(url)

    if (!result.success) {
      // 실패 상세 로깅
      console.error(`[YouTube Subtitle] 실패 - User: ${user.id}, Error: ${result.error}`)
      
      // 429 에러인 경우 특별한 처리
      if (result.error?.includes('429') || result.error?.includes('Too Many Requests')) {
        return NextResponse.json({ 
          error: '현재 YouTube 서버가 혼잡합니다. 10-15분 후 다시 시도해주세요.' 
        }, { status: 503 })
      }
      
      return NextResponse.json({ 
        error: result.error || '자막 추출에 실패했습니다' 
      }, { status: 500 })
    }

    // 성공 로깅
    console.log(`[YouTube Subtitle] 성공 - User: ${user.id}, Length: ${result.subtitles?.length || 0}자`)

    // 크레딧 차감 (관리자가 아닌 경우)
    if (!isAdmin && transactionId) {
      try {
        const requiredCredits = 10
        
        // 현재 크레딧 조회 후 차감
        const { data: currentCredits } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        
        if (currentCredits) {
          const newBalance = Math.max(0, currentCredits.balance - requiredCredits)
          
          console.log(`💰 YouTube 자막 추출 크레딧 차감 세부사항:`, {
            사용자ID: user.id,
            현재잔액: currentCredits.balance,
            실제사용: requiredCredits,
            새잔액: newBalance
          })
          
          await supabase
            .from('credits')
            .update({ 
              balance: newBalance
            })
            .eq('user_id', user.id)
        }
        
        console.log(`✅ YouTube 자막 추출 크레딧 차감 성공: ${requiredCredits}`)
        
        // 자막 추출 기록 저장 (search_history 테이블) - URL 대신 "자막 추출"로 저장
        try {
          const { error: logError } = await supabase
            .from('search_history')
            .insert({
              user_id: user.id,
              platform: 'youtube',
              search_type: 'subtitle_extraction',
              keyword: '자막 추출', // URL 대신 "자막 추출"로 저장 (최근 키워드에 URL이 나타나지 않게)
              filters: { url: url }, // URL은 filters에 저장
              results_count: 1, // 자막 추출은 1건으로 카운트
              credits_used: requiredCredits
            })
          
          if (logError) {
            console.error('❌ YouTube 자막 추출 기록 저장 실패:', logError)
          } else {
            console.log(`✅ YouTube 자막 추출 기록 저장 성공`)
          }
        } catch (error) {
          console.error('❌ YouTube 자막 추출 기록 저장 오류:', error)
        }
      } catch (error) {
        console.error('❌ YouTube 자막 추출 크레딧 차감 실패:', error)
      }
    }

    // YouTube 자막 추출 기록 저장 (platform_searches 테이블)
    try {
      const svc = (await import('@/lib/supabase/service')).supabaseService()
      
      const { error: historyError } = await svc
        .from('platform_searches')
        .insert({
          user_id: user.id,
          platform: 'youtube',
          search_type: 'subtitle_extraction',
          keyword: url, // URL을 키워드로 저장
          results_count: result.subtitles ? 1 : 0,
          credits_used: isAdmin ? 0 : 10 // YouTube 자막 추출은 10 크레딧
        })

      if (historyError) {
        console.error('YouTube 자막 추출 기록 저장 실패:', historyError)
      }
    } catch (historyError) {
      console.error('YouTube 자막 추출 기록 저장 실패:', historyError)
    }

    // 응답에 업데이트된 크레딧 정보 포함 (실시간 업데이트용)
    let responseData: any = {
      success: true,
      subtitles: result.subtitles,
      title: result.title
    }
    
    if (!isAdmin) {
      try {
        // 업데이트된 크레딧 정보 조회
        const { data: updatedCredits } = await supabase
          .from('credits')
          .select('balance, reserved')
          .eq('user_id', user.id)
          .single()
        
        if (updatedCredits) {
          responseData.credits = {
            balance: updatedCredits.balance,
            reserved: updatedCredits.reserved,
            used: 10 // YouTube 자막 추출은 10 크레딧
          }
          console.log(`✅ YouTube 자막 추출 후 크레딧 정보 포함:`, responseData.credits)
        }
      } catch (error) {
        console.error('❌ 크레딧 정보 조회 오류:', error)
        // 크레딧 정보 조회 실패해도 자막은 반환
      }
    }
    
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('자막 추출 오류:', error)
    
    // 오류 발생시 크레딧 롤백
    try {
      const rollbackSupabase = await supabaseServer()
      const { data: { user: rollbackUser } } = await rollbackSupabase.auth.getUser()
      
      if (rollbackUser) {
        const { data: rollbackUserData } = await rollbackSupabase
          .from('users')
          .select('role')
          .eq('user_id', rollbackUser.id)
          .single()
        
        const isRollbackAdmin = rollbackUserData?.role === 'admin'
        
        if (!isRollbackAdmin) {
          // 크레딧 롤백 시도
          await rollbackSupabase.rpc('rollback_credits', { 
            user_id: rollbackUser.id, 
            amount: 10,
            source: 'youtube_subtitle_extraction_rollback'
          })
        }
      }
    } catch (rollbackError) {
      console.error('크레딧 롤백 실패:', rollbackError)
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: '잘못된 요청 형식입니다',
        details: error.issues 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
  */
}

