import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { searchLimiter, subtitleCooldown } from '@/lib/ratelimit'
import { z } from 'zod'

export const runtime = 'nodejs'

const subtitleSchema = z.object({
  url: z.string().url('유효한 URL을 입력해주세요'),
})

export async function POST(req: NextRequest) {
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
      .select('role, plan')
      .eq('user_id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin'
    
    // 사용자 플랜 확인 (관리자가 아닌 경우에만)
    if (!isAdmin) {
      const userPlan = userData?.plan || 'free'
      
      // FREE 플랜은 자막 추출 기능 제한
      if (userPlan === 'free') {
        return NextResponse.json({ 
          error: 'PLAN_RESTRICTION',
          message: '자막 추출 기능은 STARTER 플랜부터 이용 가능합니다.',
          requiredPlan: 'starter'
        }, { status: 403 })
      }
      
      console.log(`👤 YouTube 자막 추출 플랜 확인: ${userPlan} (허용됨)`)
    }

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
    
    // lib/youtube-downloader.ts의 자막 추출 함수 사용
    const { extractYouTubeSubtitles } = await import('@/lib/youtube-downloader')
    const result = await extractYouTubeSubtitles(url)

    if (!result.success) {
      // 실패 상세 로깅
      console.error(`[YouTube Subtitle] 실패 - User: ${user.id}, Error: ${result.error}`)
      
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
        
      } catch (error) {
        console.error('❌ YouTube 자막 추출 크레딧 차감 실패:', error)
      }
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
}

