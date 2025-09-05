import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { z } from 'zod';
import { 
  calculateCreditAccumulation, 
  recordPlanChange, 
  refundTossPayment,
  chargeWithBillingKey,
  getLastPayment,
  PLAN_PRICES 
} from '@/lib/plan-change-helpers';

const upgradeImmediateSchema = z.object({
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
    const { newPlan } = upgradeImmediateSchema.parse(body);

    // 현재 사용자 정보 조회
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

    // 유료 플랜에서 상위 유료 플랜으로의 업그레이드만 허용
    const paidPlans = ['starter', 'pro', 'business'];
    const planLevels = { starter: 1, pro: 2, business: 3 };
    
    if (!paidPlans.includes(profile.plan) || !paidPlans.includes(newPlan)) {
      return NextResponse.json({ error: '유료 플랜 간의 업그레이드만 가능합니다' }, { status: 400 });
    }

    if (planLevels[newPlan as keyof typeof planLevels] <= planLevels[profile.plan as keyof typeof planLevels]) {
      return NextResponse.json({ error: '상위 플랜으로만 업그레이드 가능합니다' }, { status: 400 });
    }

    // 빌링키 확인
    if (!subscription.billing_key) {
      return NextResponse.json({ error: '결제 수단이 등록되지 않았습니다' }, { status: 400 });
    }

    const newPrice = PLAN_PRICES[newPlan];
    const creditCalculation = await calculateCreditAccumulation(user.id, newPlan);

    // 1단계: 기존 결제 환불
    const lastPayment = await getLastPayment(user.id);
    let refundResult = null;
    
    if (lastPayment?.payment_key) {
      console.log('🔄 기존 결제 환불 시작:', lastPayment.payment_key);
      
      try {
        refundResult = await refundTossPayment(
          lastPayment.payment_key, 
          `플랜 업그레이드로 인한 기존 결제 환불: ${profile.plan} → ${newPlan}`
        );
        console.log('✅ 기존 결제 환불 완료:', refundResult);
      } catch (refundError) {
        console.error('❌ 기존 결제 환불 실패:', refundError);
        return NextResponse.json({ 
          error: '기존 결제 환불에 실패했습니다', 
          details: refundError instanceof Error ? refundError.message : String(refundError)
        }, { status: 500 });
      }
    }

    // 2단계: 새 플랜으로 즉시 결제
    const orderId = `upgrade_immediate_${user.id}_${Date.now()}`;
    let chargeResult = null;

    try {
      chargeResult = await chargeWithBillingKey({
        billingKey: subscription.billing_key,
        amount: newPrice,
        orderId,
        customerKey: subscription.toss_customer_key || `user_${user.id}`,
      });
      console.log('✅ 새 플랜 결제 완료:', chargeResult);
    } catch (chargeError) {
      console.error('❌ 새 플랜 결제 실패:', chargeError);
      return NextResponse.json({ 
        error: '새 플랜 결제에 실패했습니다', 
        details: chargeError instanceof Error ? chargeError.message : String(chargeError)
      }, { status: 500 });
    }

    const now = new Date();

    // 3단계: 구독 정보 업데이트 (결제일 변경)
    const { error: subscriptionUpdateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        plan: newPlan,
        renewed_at: now.toISOString(),
        next_charge_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일 후
        updated_at: now.toISOString(),
      })
      .eq('user_id', user.id);

    if (subscriptionUpdateError) {
      console.error('구독 정보 업데이트 실패:', subscriptionUpdateError);
      return NextResponse.json({ error: '구독 업데이트 중 오류가 발생했습니다' }, { status: 500 });
    }

    // 4단계: 사용자 프로필 플랜 업데이트
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ plan: newPlan })
      .eq('user_id', user.id);

    if (profileUpdateError) {
      console.error('프로필 업데이트 실패:', profileUpdateError);
    }

    // 5단계: 크레딧 누적 방식으로 업데이트
    const { error: creditUpdateError } = await supabaseAdmin
      .from('credits')
      .update({
        balance: creditCalculation.newBalance,
        monthly_grant: creditCalculation.newTotal,
        last_grant_at: now.toISOString(),
        plan_updated_at: now.toISOString(),
      })
      .eq('user_id', user.id);

    if (creditUpdateError) {
      console.error('크레딧 업데이트 실패:', creditUpdateError);
    }

    // 6단계: 플랜 변경 로그 기록
    try {
      await recordPlanChange({
        userId: user.id,
        fromPlan: profile.plan,
        toPlan: newPlan,
        creditsBeforeChange: creditCalculation.currentUsed,
        creditsAfterChange: creditCalculation.newBalance,
        creditsUsedBeforeChange: creditCalculation.currentUsed,
        isFirstPaidSubscription: false, // 유료→유료는 첫 구독이 아님
        refundPaymentKey: refundResult?.paymentKey,
        newPaymentKey: chargeResult?.paymentKey,
        oldBillingCycleStart: subscription.renewed_at,
        newBillingCycleStart: now.toISOString(),
      });
    } catch (planChangeError) {
      console.error('플랜 변경 로그 기록 실패:', planChangeError);
    }

    // 7단계: 새 결제 로그 기록
    const { error: paymentLogError } = await supabaseAdmin
      .from('billing_webhook_logs')
      .insert({
        event_type: 'PAYMENT',
        payment_key: chargeResult?.paymentKey || orderId,
        order_id: orderId,
        billing_key: subscription.billing_key,
        customer_key: subscription.toss_customer_key || `user_${user.id}`,
        status: 'DONE',
        amount: newPrice,
        payment_method: 'BILLING_KEY',
        raw_payload: chargeResult,
        processed: true,
        processed_at: now.toISOString(),
      });

    if (paymentLogError) {
      console.error('결제 로그 기록 실패:', paymentLogError);
    }

    // 8단계: 환불 로그 기록 (기존 결제 환불이 있는 경우)
    if (refundResult) {
      const { error: refundLogError } = await supabaseAdmin
        .from('billing_webhook_logs')
        .insert({
          event_type: 'PAYMENT_CANCELED',
          payment_key: lastPayment.payment_key,
          order_id: lastPayment.order_id,
          customer_key: lastPayment.customer_key,
          status: 'CANCELED',
          amount: -lastPayment.amount, // 환불은 음수로 기록
          payment_method: 'REFUND',
          raw_payload: {
            reason: '플랜 업그레이드로 인한 환불',
            originalPaymentKey: lastPayment.payment_key,
            refundedAt: now.toISOString(),
            refundAmount: lastPayment.amount
          },
          processed: true,
          processed_at: now.toISOString(),
        });

      if (refundLogError) {
        console.error('환불 로그 기록 실패:', refundLogError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${newPlan.toUpperCase()} 플랜으로 즉시 업그레이드가 완료되었습니다`,
      upgrade: {
        fromPlan: profile.plan,
        toPlan: newPlan,
        refundAmount: lastPayment?.amount || 0,
        chargeAmount: newPrice,
        newBillingDate: now.toISOString(),
        nextChargeAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      credits: {
        previousUsed: creditCalculation.currentUsed,
        newTotal: creditCalculation.newTotal,
        newBalance: creditCalculation.newBalance,
      },
      paymentDetails: {
        refundResult,
        chargeResult,
      },
    });

  } catch (error) {
    console.error('즉시 업그레이드 처리 중 오류:', error);
    
    return NextResponse.json({
      error: '업그레이드 처리 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
