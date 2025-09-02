import { z } from 'zod'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// 토스 V2 웹훅 스키마
const tossV2WebhookSchema = z.object({
  eventType: z.string(),
  data: z.object({
    paymentKey: z.string(),
    orderId: z.string(),
    amount: z.number().int().nonnegative(),
    status: z.string(),
    customerKey: z.string().optional(),
    method: z.string().optional(),
    billingKey: z.string().optional(),
  })
})

// 웹훅 로그 저장 함수
async function saveWebhookLog(payload: any, processed: boolean = false, error?: string) {
  const supabase = supabaseService()
  
  const logData = {
    event_type: payload.eventType,
    payment_key: payload.data?.paymentKey,
    order_id: payload.data?.orderId,
    billing_key: payload.data?.billingKey,
    customer_key: payload.data?.customerKey,
    status: payload.data?.status,
    amount: payload.data?.amount,
    payment_method: payload.data?.method,
    raw_payload: payload,
    processed,
    processing_error: error
  }
  
  const { error: dbError } = await supabase
    .from('billing_webhook_logs')
    .insert(logData)
  
  if (dbError) {
    console.error('Failed to save webhook log:', dbError)
  }
}

// 크레딧 재지급 처리 함수
async function processSubscriptionRenewal(orderId: string, amount: number, paymentKey: string) {
  const supabase = supabaseService()
  
  try {
    // orderId에서 user_id 추출 (subscription_USER_ID_TIMESTAMP 형식)
    const { data: extractResult } = await supabase
      .rpc('extract_user_id_from_order_id', { order_id: orderId })
    
    if (!extractResult) {
      throw new Error(`Cannot extract user_id from orderId: ${orderId}`)
    }
    
    const userId = extractResult
    
    // 금액으로 플랜 결정 (테스트용: 스타터 100원)
    let plan = 'starter'
    if (amount >= 119000) plan = 'business'
    else if (amount >= 49000) plan = 'pro'
    else if (amount >= 100) plan = 'starter' // 테스트용으로 100원으로 변경
    
    console.log(`🔄 Processing subscription renewal: userId=${userId}, plan=${plan}, amount=${amount}`)
    
    // 크레딧 재지급 실행
    const { data: renewResult } = await supabase
      .rpc('renew_user_credits', {
        p_user_id: userId,
        p_plan: plan,
        p_order_id: orderId
      })
    
    if (renewResult?.success) {
      console.log(`✅ Credit renewal successful:`, renewResult)
      return { success: true, result: renewResult }
    } else {
      throw new Error(renewResult?.error || 'Credit renewal failed')
    }
    
  } catch (error) {
    console.error(`❌ Subscription renewal failed:`, error)
    throw error
  }
}

export async function POST(req: Request) {
  const bodyText = await req.text()
  let payload: any
  
  try {
    payload = JSON.parse(bodyText)
    console.log('🔔 Toss V2 webhook received:', payload)
    
    // 스키마 검증
    const validatedPayload = tossV2WebhookSchema.parse(payload)
    
    const { eventType, data } = validatedPayload
    const { orderId, amount, status, paymentKey, billingKey } = data
    
    // 웹훅 로그 저장 (처리 전)
    await saveWebhookLog(payload, false)
    
    // 결제 완료 이벤트 처리
    if (eventType === 'PAYMENT_STATUS_CHANGED' && status === 'DONE') {
      console.log(`💰 Payment completed: orderId=${orderId}, amount=${amount}`)
      
      // 구독 결제 처리 (orderId가 subscription_으로 시작)
      if (orderId.startsWith('subscription_')) {
        try {
          const renewalResult = await processSubscriptionRenewal(orderId, amount, paymentKey)
          
          // 성공 로그 업데이트
          await saveWebhookLog(payload, true)
          
          console.log(`🎉 Subscription renewal completed successfully:`, renewalResult)
          
        } catch (renewalError) {
          // 실패 로그 업데이트
          await saveWebhookLog(payload, false, renewalError instanceof Error ? renewalError.message : String(renewalError))
          
          console.error(`💥 Subscription renewal failed:`, renewalError)
          // 실패해도 200 응답 (토스 재전송 방지)
        }
      } else {
        console.log(`📄 Regular payment confirmed: ${orderId}`)
      }
    }
    
    // 결제 취소 이벤트 처리
    else if (eventType === 'CANCEL_STATUS_CHANGED') {
      console.log(`🚫 Payment cancelled: orderId=${orderId}`)
      await saveWebhookLog(payload, true)
    }
    
    // 기타 이벤트
    else {
      console.log(`ℹ️ Other event received: ${eventType}`)
      await saveWebhookLog(payload, true)
    }
    
    // 토스에 성공 응답 (10초 내 필수)
    return Response.json({ 
      success: true, 
      eventType, 
      orderId,
      processed: true 
    })
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    
    // 에러 로그 저장
    if (payload) {
      await saveWebhookLog(payload, false, error instanceof Error ? error.message : String(error))
    }
    
    // 검증 실패는 400 응답
    if (error instanceof z.ZodError) {
      return Response.json({ 
        error: 'Invalid webhook payload', 
        issues: error.issues 
      }, { status: 400 })
    }
    
    // 기타 에러는 500 응답
    return Response.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}


