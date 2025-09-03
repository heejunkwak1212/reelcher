import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { z } from 'zod';

const upgradeSubscriptionSchema = z.object({
  newPlan: z.enum(['starter', 'pro', 'business']),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const supabaseAdmin = supabaseService();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json();
    const { newPlan } = upgradeSubscriptionSchema.parse(body);

    // 플랜별 가격 정의
    const planPrices: Record<string, number> = {
      starter: 19000,
      pro: 49000,
      business: 119000,
    };

    // 플랜별 크레딧 정의
    const planCredits: Record<string, number> = {
      starter: 2000,
      pro: 7000,
      business: 20000,
    };

    const newPrice = planPrices[newPlan];
    const newCredits = planCredits[newPlan];

    if (!newPrice || !newCredits) {
      return NextResponse.json({ error: '잘못된 플랜입니다' }, { status: 400 });
    }

    // 현재 사용자 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    // 현재 구독 정보 조회
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    if (!subscription.billing_key) {
      return NextResponse.json({ error: '빌링키가 없습니다. 새로 구독해주세요.' }, { status: 400 });
    }

    // 현재 플랜과 동일한 플랜으로 변경 시도하는 경우
    if (profile.plan === newPlan) {
      return NextResponse.json({ error: '이미 해당 플랜을 사용 중입니다' }, { status: 400 });
    }

    // 플랜 변경은 즉시 적용하고, 다음 결제일에 새 금액으로 결제
    // (기존 결제는 환불하지 않고, 새 플랜의 이용 기간은 다음 결제일까지 유지)
    const orderId = `upgrade_${newPlan}_${user.id}_${Date.now()}`;
    
    console.log(`플랜 변경: ${profile.plan} -> ${newPlan}, 다음 결제일부터 적용`);
    
    // 결제는 다음 주기에 이루어지므로 여기서는 결제 로그만 기록
    const paymentResult = {
      orderId,
      planChange: true,
      fromPlan: profile.plan,
      toPlan: newPlan,
      nextBillingAmount: newPrice,
      timestamp: new Date().toISOString(),
    };

    // 구독 정보 업데이트 (플랜만 변경, 다음 결제일은 유지)
    const now = new Date();

    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        updated_at: now.toISOString(),
        // next_charge_at은 기존 값 유지 (다음 정기결제일에 새 금액으로 결제)
      })
      .eq('user_id', user.id);

    if (subscriptionUpdateError) {
      console.error('구독 정보 업데이트 실패:', subscriptionUpdateError);
      return NextResponse.json({ error: '구독 업데이트 중 오류가 발생했습니다' }, { status: 500 });
    }

    // 사용자 프로필의 플랜 업데이트
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ plan: newPlan })
      .eq('user_id', user.id);

    if (profileUpdateError) {
      console.error('프로필 업데이트 실패:', profileUpdateError);
    }

    // 크레딧 초기화 및 새 플랜 크레딧 지급
    const { error: creditUpdateError } = await supabaseAdmin
      .from('credits')
      .update({
        balance: newCredits,
        monthly_grant: newCredits,
        last_grant_at: now.toISOString(),
        plan_updated_at: now.toISOString(),
      })
      .eq('user_id', user.id);

    if (creditUpdateError) {
      console.error('크레딧 업데이트 실패:', creditUpdateError);
    }

    // 플랜 변경 로그 기록 (결제 내역에 표시하기 위해 PAYMENT로 기록)
    const { error: paymentLogError } = await supabaseAdmin
      .from('billing_webhook_logs')
      .insert({
        event_type: 'PAYMENT',
        payment_key: null, // 플랜 변경이므로 결제키 없음
        order_id: orderId,
        billing_key: subscription.billing_key,
        customer_key: `user_${user.id}`,
        status: 'DONE', // 결제 내역에 표시하기 위해 DONE으로 설정
        amount: newPrice, // 실제 가격 표시
        payment_method: 'PLAN_CHANGE',
        raw_payload: paymentResult,
        processed: true,
        processed_at: now.toISOString(),
      });

    if (paymentLogError) {
      console.error('결제 로그 기록 실패:', paymentLogError);
    }

    return NextResponse.json({
      success: true,
      message: `${newPlan.toUpperCase()} 플랜으로 성공적으로 변경되었습니다`,
      newPlan,
      newCredits,
      nextChargeAt: subscription.next_charge_at, // 기존 결제일 유지
      planChangeDetails: paymentResult,
    });

  } catch (error) {
    console.error('플랜 업그레이드 처리 중 오류:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: '입력값이 올바르지 않습니다', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: '플랜 변경 처리 중 오류가 발생했습니다' 
    }, { status: 500 });
  }
}
