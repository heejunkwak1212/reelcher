import { startTaskRun, waitForRunItems } from '@/lib/apify'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { subtitleCooldown } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const schema = z.object({
  url: z.string().url(),
  lang: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const token = process.env.APIFY_TOKEN
    if (!token) return new Response(JSON.stringify({ error: 'APIFY_TOKEN missing' }), { status: 500 })
    const body = await req.json()
    const input = schema.parse(body)

    // Require auth and reserve credits (20) per PRD
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    // 디버깅: 사용자 정보 로깅
    console.log('🔍 Captions API - User ID:', user.id)
    console.log('🔍 Captions API - User Email:', user.email)

    // 사용자 정보 확인 (관리자 체크) - profiles 테이블 사용
    const { data: userData, error: userError } = await ssr
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isAdmin = userData?.role === 'admin'
    
    // 사용자 플랜 확인 (관리자가 아닌 경우에만)
    if (!isAdmin) {
      // 이미 userData에서 profiles 정보를 가져왔으므로 추가 조회
      const { data: profileData, error: profileError } = await ssr
        .from('profiles')
        .select('plan')
        .eq('user_id', user.id)
        .single()

      const userPlan = profileData?.plan || 'free'
      
      // FREE 플랜은 자막 추출 기능 제한
      if (userPlan === 'free') {
        return new Response(
          JSON.stringify({ 
            error: 'PLAN_RESTRICTION',
            message: '자막 추출 기능은 STARTER 플랜부터 이용 가능합니다.',
            requiredPlan: 'starter'
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        )
      }
      
      console.log(`👤 자막 추출 플랜 확인: ${userPlan} (허용됨)`)
    }
    
    let transactionId = null

    // 관리자가 아닌 경우에만 크레딧 처리
    if (!isAdmin) {
      // 플랫폼별 크레딧 비용 (URL에서 플랫폼 감지)
      let requiredCredits = 20 // 기본값: Instagram/TikTok
      if (input.url.includes('youtube.com') || input.url.includes('youtu.be')) {
        requiredCredits = 10 // YouTube
      }

      // 현재 크레딧 상태 확인
      const { data: creditData, error: creditError } = await ssr
        .from('credits')
        .select('balance, reserved')
        .eq('user_id', user.id)
        .single()

      if (creditError || !creditData) {
        return new Response(
          JSON.stringify({ error: '크레딧 정보를 확인할 수 없습니다.' }),
          { status: 500 }
        )
      }

      // 사용 가능한 크레딧 확인 (예약 시스템 제거)
      if (creditData.balance < requiredCredits) {
        return new Response(
          JSON.stringify({ error: '크레딧이 부족합니다.' }),
          { status: 402 }
        )
      }

      console.log(`💰 자막 추출 크레딧 사전 확인 완료: 잔액=${creditData.balance}, 필요=${requiredCredits}`)
      transactionId = `captions_${Date.now()}_${requiredCredits}`
    }

    // 자막 추출 쿨다운 체크 (30초)
    if (subtitleCooldown) {
      const cooldownResult = await subtitleCooldown.limit(`subtitle-cooldown:${user.id}`)
      if (!cooldownResult.success) {
        // 실패시 크레딧 롤백
        if (!isAdmin && transactionId) {
          try {
            await ssr.rpc('rollback_credits', { transaction_id: transactionId })
          } catch {}
        }
        
        return new Response(JSON.stringify({ 
          error: 'SUBTITLE_COOLDOWN',
          message: '과부하 방지를 위해 자막 추출은 30초 단위로 가능해요.',
          remainingTime: Math.ceil(cooldownResult.reset - Date.now() / 1000)
        }), { status: 429 })
      }
    }
    // Sanitize: strip query/hash to avoid actor mis-detection
    const urlObj = new URL(input.url)
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`
    const taskId = 'bold_argument/tiktok-instagram-facebook-transcriber-task'
    
    // DB 기반 Try-First 방식으로 자막 추출 실행
    const { getDatabaseQueueManager } = await import('@/lib/db-queue-manager')
    const queueManager = getDatabaseQueueManager()
    
    console.log(`🎬 [DEBUG] 자막 추출 시작:`)
    console.log(`  - 사용자: ${user.id} (${user.email})`)
    console.log(`  - URL: ${cleanUrl}`)
    console.log(`  - TaskID: ${taskId}`)
    
    let started: { runId: string }
    
    try {
      const result = await queueManager.executeWithTryFirst(
        taskId,
        { start_urls: cleanUrl },
        {
          userId: user.id,
          priority: 'normal',
          maxRetries: 3,
          originalApiEndpoint: '/api/captions',
          originalPayload: body
        }
      )
      
      if (!result.success) {
        console.log(`🔄 [DEBUG] 자막 추출 대기열 추가:`)
        console.log(`  - 대기열ID: ${result.queueId}`)
        console.log(`  - 메시지: ${result.message}`)
        
        return new Response(JSON.stringify({
          error: 'SYSTEM_BUSY',
          message: `시스템이 바쁩니다. ${result.message}`,
          queueId: result.queueId,
          debug: {
            userId: user.id,
            taskId,
            timestamp: new Date().toISOString()
          }
        }), { status: 202 }) // Accepted, 처리 중
      }
      
      console.log(`✅ [DEBUG] 자막 추출 즉시 실행 성공: runId=${result.runId}`)
      started = { runId: result.runId! }
    } catch (error: any) {
      console.error('❌ [DEBUG] 자막 추출 실행 실패:', error)
      return new Response(JSON.stringify({
        error: '자막 추출에 실패했습니다.',
        details: error.message
      }), { status: 500 })
    }
    
    const out = await waitForRunItems<any[]>({ token, runId: started.runId })
    const first = Array.isArray(out.items) ? (out.items[0] as any) : undefined
    let text: string = first?.text || first?.transcript || first?.transcription || ''
    
    // 자막이 없거나 오류 메시지인 경우 처리
    if (!text || text.trim() === '' || 
        text.toLowerCase().includes('no speech found') || 
        text.toLowerCase().includes('unexpected error')) {
      text = '자막이 존재하지 않습니다.'
    } else {
      // Strip timestamps like "[0.24s - 1.92s] "
      text = text.replace(/\[\s*\d+(?:\.\d+)?s\s*-\s*\d+(?:\.\d+)?s\s*\]\s*/g, '')
      text = text.replace(/\s{2,}/g, ' ').trim()
    }
    // 크레딧 차감 (관리자가 아닌 경우)
    if (!isAdmin && transactionId) {
      try {
        const requiredCredits = input.url.includes('youtube.com') || input.url.includes('youtu.be') ? 10 : 20
        
        // 현재 크레딧 조회 후 차감
        const { data: currentCredits } = await ssr
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()
        
        if (currentCredits) {
          const newBalance = Math.max(0, currentCredits.balance - requiredCredits)
          
          console.log(`💰 자막 추출 크레딧 차감 세부사항:`, {
            사용자ID: user.id,
            현재잔액: currentCredits.balance,
            실제사용: requiredCredits,
            새잔액: newBalance
          })
          
          await ssr
            .from('credits')
            .update({ 
              balance: newBalance
            })
            .eq('user_id', user.id)
        }
        
        console.log(`✅ 자막 추출 크레딧 차감 성공: ${requiredCredits}`)
        
        // 자막 추출 기록 저장 (search_history 테이블) - URL 대신 "자막 추출"로 저장
        try {
          const platform = input.url.includes('youtube.com') || input.url.includes('youtu.be') ? 'youtube' : 
                           input.url.includes('tiktok.com') ? 'tiktok' : 'instagram'
          
          const { error: logError } = await ssr
            .from('search_history')
            .insert({
              user_id: user.id,
              platform: platform,
              search_type: 'subtitle_extraction',
              keyword: '자막 추출', // URL 대신 "자막 추출"로 저장 (최근 키워드에 URL이 나타나지 않게)
              filters: { url: input.url }, // URL은 filters에 저장
              results_count: 1, // 자막 추출은 1건으로 카운트
              credits_used: requiredCredits,
              status: 'completed'
            })
          
          if (logError) {
            console.error('❌ 자막 추출 기록 저장 실패:', logError)
          } else {
            console.log(`✅ ${platform} 자막 추출 기록 저장 성공`)
          }
        } catch (error) {
          console.error('❌ 자막 추출 기록 저장 오류:', error)
        }
      } catch (error) {
        console.error('❌ 자막 추출 크레딧 차감 실패:', error)
      }
    } else {
      // Admin 계정의 경우 크레딧 차감 없이 기록만 저장
      console.log(`🔑 관리자 계정 - 크레딧 차감 없이 기록만 저장`)
      try {
        const platform = input.url.includes('youtube.com') || input.url.includes('youtu.be') ? 'youtube' : 
                         input.url.includes('tiktok.com') ? 'tiktok' : 'instagram'
        
        await ssr
          .from('search_history')
          .insert({
            user_id: user.id,
            platform: platform,
            search_type: 'subtitle_extraction',
            keyword: '자막 추출',
            filters: { url: input.url },
            results_count: 1,
            credits_used: 0, // Admin은 크레딧 사용량 0
            status: 'completed'
          })
        
        console.log(`✅ 관리자 ${platform} 자막 추출 기록 저장 완료`)
      } catch (historyError) {
        console.error('❌ 관리자 자막 추출 기록 저장 실패:', historyError)
      }
    }
    
    // 자막 추출은 최근 키워드로 저장하지 않음 (키워드 검색만 저장)
    
    // 응답에 업데이트된 크레딧 정보 포함 (실시간 업데이트용)
    let responseData: any = { captions: text }
    
    if (!isAdmin) {
      try {
        // 업데이트된 크레딧 정보 조회
        const { data: updatedCredits } = await ssr
          .from('credits')
          .select('balance, reserved')
          .eq('user_id', user.id)
          .single()
        
        if (updatedCredits) {
          // 최근 30일 크레딧 사용량 계산
          const now = new Date()
          const todayStart = new Date(now)
          todayStart.setHours(0, 0, 0, 0)
          const monthStart = new Date(todayStart)
          monthStart.setDate(monthStart.getDate() - 29) // 오늘 포함 30일
          
          const { data: monthUsage } = await ssr
            .from('search_history')
            .select('credits_used')
            .eq('user_id', user.id)
            .gt('credits_used', 0)
            .gte('created_at', monthStart.toISOString())
          
          const monthCredits = monthUsage?.reduce((sum, record) => sum + (record.credits_used || 0), 0) || 0
          
          responseData.credits = {
            balance: updatedCredits.balance,
            reserved: updatedCredits.reserved,
            used: input.url.includes('youtube.com') || input.url.includes('youtu.be') ? 10 : 20,
            month_credits: monthCredits
          }
        }
        
        // 자막 추출은 검색통계에 집계되지 않음 (크레딧만 차감)
      } catch (error) {
        console.error('크레딧/통계 정보 조회 오류:', error)
      }
    }
    
    return new Response(JSON.stringify(responseData), { headers: { 'content-type': 'application/json' } })
  } catch (e: any) {
    console.error('자막 추출 오류:', e)
    
    // 오류 발생시 크레딧 롤백
    try {
      const rollbackSsr = await supabaseServer()
      const { data: { user: rollbackUser } } = await rollbackSsr.auth.getUser()
      
      if (rollbackUser) {
        const { data: rollbackUserData } = await rollbackSsr
          .from('users')
          .select('role')
          .eq('user_id', rollbackUser.id)
          .single()
        
        const isRollbackAdmin = rollbackUserData?.role === 'admin'
        
        if (!isRollbackAdmin) {
          // 크레딧 롤백 시도
          await rollbackSsr.rpc('rollback_credits', { 
            user_id: rollbackUser.id, 
            amount: 20,
            source: 'instagram_tiktok_subtitle_extraction_rollback'
          })
        }
      }
    } catch (rollbackError) {
      console.error('크레딧 롤백 실패:', rollbackError)
    }
    
    const issues = Array.isArray(e?.issues) ? e.issues : undefined
    return new Response(JSON.stringify(issues ? { error: 'ValidationError', issues } : { error: 'Bad Request' }), { status: 400 })
  }
}


