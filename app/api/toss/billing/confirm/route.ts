import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const confirmSchema = z.object({
  billingKey: z.string().min(1),
  customerKey: z.string().min(1),
  plan: z.enum(['starter', 'pro', 'business']).default('starter')
})

export async function POST(req: Request) {
  try {
    const input = confirmSchema.parse(await req.json())
    const { billingKey, customerKey, plan } = input
    
    const secret = process.env.TOSS_SECRET_KEY
    if (!secret) {
      return Response.json({ success: false, message: 'TOSS_SECRET_KEY missing' }, { status: 500 })
    }

    // 플랜별 가격 설정 (테스트용: 스타터 100원)
    const planPrices = { starter: 100, pro: 49000, business: 119000 }
    const planCredits = { starter: 2000, pro: 7000, business: 20000 }
    
    const amount = planPrices[plan]
    const creditAmount = planCredits[plan]
    const orderId = `subscription_${customerKey}_${Date.now()}`
    
    console.log('결제 확인 요청:', { billingKey, customerKey, plan, amount, orderId })
    
    // 토스페이먼츠 빌링키 결제 API 호출
    const auth = Buffer.from(`${secret}:`).toString('base64')
    const paymentRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        customerKey: customerKey,
        amount: amount,
        orderId: orderId,
        orderName: `릴처 ${plan.toUpperCase()} 플랜 구독`
      })
    })
    
    if (!paymentRes.ok) {
      const paymentError = await paymentRes.text().catch(() => '')
      console.error('토스 결제 실패:', paymentError)
      return Response.json({ 
        success: false, 
        message: `결제 처리 실패: ${paymentError}` 
      }, { status: 400 })
    }
    
    const paymentResult = await paymentRes.json()
    console.log('토스 결제 성공:', paymentResult)
    
    // 구독 활성화 + 크레딧 지급
    try {
      const userId = customerKey.replace('user_', '')
      const supabase = await supabaseServer()
      
      // 구독 상태를 active로 변경
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          renewed_at: new Date().toISOString(),
          next_charge_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일 후
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      // 프로필 플랜 업데이트
      await supabase
        .from('profiles')
        .update({ 
          plan: plan,
          subscription_start_date: new Date().toISOString(),
          last_payment_date: new Date().toISOString()
        })
        .eq('user_id', userId)
      
      // 크레딧 지급 (RPC 함수 사용)
      const { data: creditResult, error: creditError } = await supabase.rpc('renew_user_credits', {
        p_user_id: userId,
        p_plan: plan,
        p_order_id: orderId
      })
      
      if (creditError) {
        console.error('크레딧 지급 실패:', creditError)
        throw creditError
      }
      
      console.log('구독 활성화 및 크레딧 지급 완료:', creditResult)
      
      return Response.json({ 
        success: true, 
        message: '결제가 완료되었습니다!',
        payment: paymentResult,
        credits: creditAmount,
        plan: plan
      })
      
    } catch (dbError) {
      console.error('구독/크레딧 처리 실패:', dbError)
      
      // 결제는 성공했지만 DB 처리 실패한 경우
      return Response.json({ 
        success: false, 
        message: '결제는 완료되었으나 구독 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.',
        payment: paymentResult
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('결제 확인 API 오류:', error)
    
    if (error instanceof z.ZodError) {
      return Response.json({ 
        success: false, 
        message: '잘못된 요청입니다.' 
      }, { status: 400 })
    }
    
    return Response.json({ 
      success: false, 
      message: '결제 처리 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}
