import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { z } from 'zod';

const cancelSubscriptionSchema = z.object({
  reason: z.string().min(1, '취소 사유를 입력해주세요').max(200, '취소 사유는 200자 이하로 입력해주세요'),
});

// 48시간을 밀리초로 변환
const REFUND_TIME_LIMIT_MS = 48 * 60 * 60 * 1000;

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
    const { reason } = cancelSubscriptionSchema.parse(body);

    // 현재 구독 정보 조회
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subscriptionError || !subscription) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    if (subscription.status === 'canceled') {
      return NextResponse.json({ error: '이미 취소된 구독입니다' }, { status: 400 });
    }

    // 48시간 이내 여부 확인
    const renewedAt = new Date(subscription.renewed_at);
    const currentTime = new Date();
    const timeSinceRenewal = currentTime.getTime() - renewedAt.getTime();
    const isWithin48Hours = timeSinceRenewal <= REFUND_TIME_LIMIT_MS;

    // 현재 결제 주기에서 크레딧 사용 이력 확인
    const { data: searchHistory, error: searchError } = await supabase
      .from('search_history')
      .select('credits_used')
      .eq('user_id', user.id)
      .gte('created_at', subscription.renewed_at)
      .gt('credits_used', 0);

    const hasUsedCredits = searchHistory && searchHistory.length > 0;
    
    // 환불 조건 체크: 48시간 이내 + 크레딧 미사용
    const isEligibleForRefund = isWithin48Hours && !hasUsedCredits;

    let refundResult = null;

    // 환불 조건을 만족하는 경우 즉시 환불 처리
    if (isEligibleForRefund) {
      console.log('🔄 환불 조건 만족 - 환불 처리 시작');
      
      // 최근 빌링 결제 정보 조회 (payment_key가 있는 실제 결제만)
      const { data: recentPayment, error: paymentError } = await supabaseAdmin
        .from('billing_webhook_logs')
        .select('*')
        .eq('customer_key', `user_${user.id}`)
        .eq('event_type', 'PAYMENT')
        .not('payment_key', 'is', null) // payment_key가 있는 실제 결제만
        .eq('status', 'DONE')
        .order('created_at', { ascending: false })
        .limit(1);

      if (paymentError) {
        console.error('❌ 결제 내역 조회 실패:', paymentError);
      }

      if (recentPayment && recentPayment.length > 0) {
        const payment = recentPayment[0];
        console.log(`🔍 환불 대상 결제 찾음: paymentKey=${payment.payment_key}, amount=${payment.amount}`);
        
        try {
          // 1단계: 결제 상태 확인 (토스페이먼츠 공식 문서 권장)
          const statusCheckResponse = await fetch(`https://api.tosspayments.com/v1/payments/${payment.payment_key}`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
              'Content-Type': 'application/json',
            },
          });

          if (statusCheckResponse.ok) {
            const paymentStatus = await statusCheckResponse.json();
            console.log(`💡 현재 결제 상태: status=${paymentStatus.status}, balanceAmount=${paymentStatus.balanceAmount}`);
            
            // 취소 가능한 상태인지 확인
            if (paymentStatus.status !== 'DONE' || paymentStatus.balanceAmount <= 0) {
              console.log('⚠️ 이미 취소되었거나 취소할 수 없는 결제입니다.');
              refundResult = {
                status: 'ALREADY_CANCELED',
                totalAmount: payment.amount,
                message: '이미 취소된 결제 또는 취소 불가능한 상태'
              };
            } else {
              // 2단계: 실제 환불 요청 (멱등키 사용)
              const idempotencyKey = `refund_${user.id}_${payment.payment_key}_${Date.now()}`;
              
              const refundResponse = await fetch(`https://api.tosspayments.com/v1/payments/${payment.payment_key}/cancel`, {
                method: 'POST',
                headers: {
                  'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
                  'Content-Type': 'application/json',
                  'Idempotency-Key': idempotencyKey, // 멱등키 추가 (중복 요청 방지)
                },
                body: JSON.stringify({
                  cancelReason: `48시간 이내 구독 취소로 인한 전액 환불 - ${reason}`,
                }),
              });

              if (refundResponse.ok) {
                refundResult = await refundResponse.json();
                console.log('✅ 빌링 결제 환불 성공:', refundResult);
              } else {
                const errorText = await refundResponse.text();
                console.error('❌ 빌링 결제 환불 실패:', errorText);
                
                try {
                  const errorData = JSON.parse(errorText);
                  if (errorData.code === 'ALREADY_CANCELED_PAYMENT') {
                    console.log('⚠️ 이미 취소된 결제입니다. 환불 처리를 건너뜁니다.');
                    // 이미 취소된 결제라면 환불 성공으로 처리
                    refundResult = {
                      status: 'CANCELED',
                      totalAmount: payment.amount,
                      message: '이미 취소된 결제'
                    };
                  } else {
                    console.error(`❌ 환불 실패 - 에러 코드: ${errorData.code}, 메시지: ${errorData.message}`);
                  }
                } catch (parseError) {
                  console.error('환불 응답 파싱 실패:', parseError);
                }
              }
            }
          } else {
            console.error('❌ 결제 상태 조회 실패:', await statusCheckResponse.text());
          }
        } catch (error) {
          console.error('빌링 결제 환불 처리 중 오류:', error);
        }
      } else {
        console.log('⚠️ 환불할 결제 내역을 찾을 수 없습니다.');
      }
    }

    // 토스 빌링키 삭제 (자동결제 중지)
    if (subscription.billing_key) {
      try {
        const tossResponse = await fetch(`https://api.tosspayments.com/v1/billing/authorizations/${subscription.billing_key}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!tossResponse.ok) {
          console.error('토스 빌링키 삭제 실패:', await tossResponse.text());
          // 빌링키 삭제 실패해도 구독 상태는 변경 (로그만 남김)
        }
      } catch (error) {
        console.error('토스 빌링키 삭제 중 오류:', error);
        // 토스 API 오류가 있어도 구독 취소는 진행
      }
    }

    // 구독 상태 업데이트
    const subscriptionUpdateData: any = {
      status: 'canceled',
      billing_key: null, // 빌링키 제거로 자동결제 방지
      updated_at: new Date().toISOString(),
    };

    // 환불 조건을 만족하는 경우 즉시 만료, 아니면 다음 결제일까지 유지
    if (isEligibleForRefund) {
      subscriptionUpdateData.next_charge_at = new Date().toISOString();
    } else if (hasUsedCredits) {
      // 크레딧 사용 이력이 있으면 다음 결제일까지 유지
      subscriptionUpdateData.next_charge_at = subscription.next_charge_at;
    } else {
      // 48시간 경과했지만 크레딧 미사용인 경우 다음 결제일까지 유지
      subscriptionUpdateData.next_charge_at = subscription.next_charge_at;
    }

    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(subscriptionUpdateData)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('구독 상태 업데이트 실패:', updateError);
      return NextResponse.json({ error: '구독 취소 처리 중 오류가 발생했습니다' }, { status: 500 });
    }

    // 사용자 프로필의 플랜 변경
    const shouldImmediatelyDowngrade = isEligibleForRefund; // 환불 조건 만족 시 즉시 FREE로 변경
    
    if (shouldImmediatelyDowngrade) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free' })
        .eq('user_id', user.id);

      if (profileUpdateError) {
        console.error('프로필 업데이트 실패:', profileUpdateError);
      }

      // 크레딧도 무료 플랜 기본값으로 리셋
      const { error: creditUpdateError } = await supabaseAdmin
        .from('credits')
        .update({ 
          balance: 250, 
          monthly_grant: 250,
          last_grant_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (creditUpdateError) {
        console.error('크레딧 업데이트 실패:', creditUpdateError);
      }
    }

    // 사용자 프로필 정보 조회 (로그용)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, phone_number, email, created_at, plan')
      .eq('user_id', user.id)
      .single();

    // 크레딧 정보 조회 (로그용)
    const { data: credits, error: creditsError } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    // 구독 취소 로그 생성
    if (profile) {
      const { error: logError } = await supabaseAdmin
        .from('cancellation_logs')
        .insert({
          user_id: user.id,
          action_type: 'subscription_cancel',
          reason: reason,
          plan_at_cancellation: subscription.plan,
          credits_at_cancellation: credits?.balance || 0,
          refund_eligible: isEligibleForRefund,
          refund_amount: refundResult?.totalAmount || 0,
          refund_processed: isEligibleForRefund && refundResult !== null,
          signup_date: profile.created_at,
          user_display_name: profile.display_name,
          user_phone_number: profile.phone_number,
          user_email: profile.email,
        });

      if (logError) {
        console.error('구독 취소 로그 생성 실패:', logError);
      }
    }

    // 응답 반환
    return NextResponse.json({
      success: true,
      isEligibleForRefund,
      refundProcessed: isEligibleForRefund && refundResult !== null,
      message: isEligibleForRefund 
        ? '구독 취소 및 환불 요청이 완료되었어요. 결제하신 수단으로 영업일 기준 최대 48시간 이내 환불될 예정이에요.'
        : '구독이 성공적으로 취소되었습니다',
      hasUsedCredits,
      effectiveDate: isEligibleForRefund ? new Date().toISOString() : subscription.next_charge_at,
      refundDetails: refundResult,
    });

  } catch (error) {
    console.error('구독 취소 처리 중 오류:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: '입력값이 올바르지 않습니다', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: '구독 취소 처리 중 오류가 발생했습니다' 
    }, { status: 500 });
  }
}