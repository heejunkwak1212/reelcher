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
    const taskId = 'upscale_jiminy/tiktok-instagram-facebook-transcriber-task'
    // This actor expects 'start_urls' not 'directUrls'. If the param is wrong, it falls back to example URL.
    const started = await startTaskRun({ taskId, token, input: { start_urls: cleanUrl, normalizeLanguageTo: input.lang || 'ko' } })
    const out = await waitForRunItems<any[]>({ token, runId: started.runId })
    const first = Array.isArray(out.items) ? (out.items[0] as any) : undefined
    let text: string = first?.text || first?.transcript || first?.transcription || ''
    // Strip timestamps like "[0.24s - 1.92s] "
    if (typeof text === 'string' && text.length) {
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
        
        // 자막 추출 기록 저장 (search_history 테이블)
        try {
          const platform = input.url.includes('youtube.com') || input.url.includes('youtu.be') ? 'youtube' : 
                           input.url.includes('tiktok.com') ? 'tiktok' : 'instagram'
          
          const { error: logError } = await ssr
            .from('search_history')
            .insert({
              user_id: user.id,
              platform: platform,
              search_type: 'subtitle_extraction',
              keyword: input.url, // URL을 키워드로 저장
              filters: {},
              results_count: 1, // 자막 추출은 1건으로 카운트
              credits_used: requiredCredits
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
    }
    
    // 자막 추출 기록 저장 (platform_searches 테이블)
    try {
      const svc = (await import('@/lib/supabase/service')).supabaseService()
      
      const { error: historyError } = await svc
        .from('platform_searches')
        .insert({
          user_id: user.id,
          platform: 'instagram', // 자막 추출은 주로 Instagram 기반
          search_type: 'subtitle_extraction',
          keyword: cleanUrl, // URL을 키워드로 저장
          results_count: text ? 1 : 0,
          credits_used: isAdmin ? 0 : 20
        })

      if (historyError) {
        console.error('자막 추출 기록 저장 실패:', historyError)
      }
    } catch (historyError) {
      console.error('자막 추출 기록 저장 실패:', historyError)
    }
    
    return new Response(JSON.stringify({ captions: text }), { headers: { 'content-type': 'application/json' } })
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


