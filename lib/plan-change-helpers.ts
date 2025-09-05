import { supabaseService } from '@/lib/supabase/service';

export interface PlanChangeLog {
  id: string;
  user_id: string;
  from_plan: string;
  to_plan: string;
  change_type: 'free_to_paid' | 'paid_to_paid' | 'paid_to_free';
  credits_before_change: number;
  credits_after_change: number;
  credits_used_before_change: number;
  is_first_paid_subscription: boolean;
  refund_payment_key?: string;
  new_payment_key?: string;
  old_billing_cycle_start?: string;
  new_billing_cycle_start?: string;
  created_at: string;
}

export interface RefundEligibilityResult {
  eligible: boolean;
  reason: string;
  amount?: number;
}

export interface CreditCalculation {
  currentUsed: number;
  newBalance: number;
  newTotal: number;
}

// 플랜별 크레딧 정보
export const PLAN_CREDITS = {
  free: 250,
  starter: 2000,
  pro: 7000,
  business: 20000,
} as const;

// 플랜별 가격 정보 (원)
export const PLAN_PRICES = {
  starter: 19900,
  pro: 49900,
  business: 119900,
} as const;

/**
 * 플랜 변경 타입 결정
 */
export function getPlanChangeType(fromPlan: string, toPlan: string): 'free_to_paid' | 'paid_to_paid' | 'paid_to_free' {
  const paidPlans = ['starter', 'pro', 'business'];
  const isFromPaid = paidPlans.includes(fromPlan);
  const isToPaid = paidPlans.includes(toPlan);

  if (!isFromPaid && isToPaid) return 'free_to_paid';
  if (isFromPaid && !isToPaid) return 'paid_to_free';
  if (isFromPaid && isToPaid) return 'paid_to_paid';
  
  throw new Error(`Invalid plan change: ${fromPlan} -> ${toPlan}`);
}

/**
 * 첫 유료플랜 구독 여부 확인
 */
export async function isFirstPaidSubscription(userId: string): Promise<boolean> {
  const supabase = supabaseService();
  
  const { data: existingLogs } = await supabase
    .from('plan_change_logs')
    .select('id')
    .eq('user_id', userId)
    .in('change_type', ['free_to_paid', 'paid_to_paid'])
    .limit(1);

  return !existingLogs || existingLogs.length === 0;
}

/**
 * 크레딧 누적 계산
 */
export async function calculateCreditAccumulation(
  userId: string, 
  newPlan: keyof typeof PLAN_CREDITS
): Promise<CreditCalculation> {
  const supabase = supabaseService();
  
  // 현재 크레딧 정보 조회
  const { data: currentCredits } = await supabase
    .from('credits')
    .select('balance, monthly_grant')
    .eq('user_id', userId)
    .single();

  if (!currentCredits) {
    throw new Error('크레딧 정보를 찾을 수 없습니다');
  }

  // 현재 사용한 크레딧 계산 (음수 방지)
  const currentUsed = Math.max(0, currentCredits.monthly_grant - currentCredits.balance);
  
  // 새 플랜의 총 크레딧
  const newTotal = PLAN_CREDITS[newPlan];
  
  // 새 잔여 크레딧 (총 크레딧에서 사용량 차감)
  const newBalance = Math.max(0, newTotal - currentUsed);

  return {
    currentUsed,
    newBalance,
    newTotal,
  };
}

/**
 * 환불 자격 확인
 */
export async function checkRefundEligibility(userId: string): Promise<RefundEligibilityResult> {
  const supabase = supabaseService();
  
  // 48시간 제한
  const REFUND_TIME_LIMIT_MS = 48 * 60 * 60 * 1000;
  
  // 구독 정보 조회
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!subscription) {
    return { eligible: false, reason: 'no_subscription' };
  }

  // 48시간 이내 여부 확인
  const renewedAt = new Date(subscription.renewed_at);
  const currentTime = new Date();
  const timeSinceRenewal = currentTime.getTime() - renewedAt.getTime();
  const isWithin48Hours = timeSinceRenewal <= REFUND_TIME_LIMIT_MS;

  if (!isWithin48Hours) {
    return { eligible: false, reason: 'time_limit_exceeded' };
  }

  // 최근 플랜 변경 기록 조회
  const { data: lastChange } = await supabase
    .from('plan_change_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // 현재 결제 주기에서 크레딧 사용 이력 확인
  const { data: searchHistory } = await supabase
    .from('search_history')
    .select('credits_used')
    .eq('user_id', userId)
    .gte('created_at', subscription.renewed_at);

  const totalUsedCredits = searchHistory?.reduce((sum, record) => sum + (record.credits_used || 0), 0) || 0;
  
  // 현재 크레딧 정보로 실제 사용량 계산 (더 정확한 방법)
  const { data: currentCredits } = await supabase
    .from('credits')
    .select('balance, monthly_grant')
    .eq('user_id', userId)
    .single();
    
  const actualUsedCredits = currentCredits ? Math.max(0, currentCredits.monthly_grant - currentCredits.balance) : 0;
  
  // 두 방법 중 더 큰 값을 사용 (더 보수적인 접근)
  const finalUsedCredits = Math.max(totalUsedCredits, actualUsedCredits);

  // 환불 조건 분기
  if (lastChange?.change_type === 'free_to_paid' && lastChange.is_first_paid_subscription) {
    // 무료→유료 첫 구독인 경우: 250크레딧까지 사용해도 환불 가능
    if (finalUsedCredits <= 250) {
      return { 
        eligible: true, 
        reason: 'first_paid_subscription_under_250_credits',
        amount: PLAN_PRICES[subscription.plan as keyof typeof PLAN_PRICES] || 0
      };
    } else {
      return { eligible: false, reason: 'first_paid_subscription_over_250_credits' };
    }
  } else if (lastChange?.change_type === 'paid_to_paid') {
    // 유료→유료 변경인 경우: 사용 크레딧 있으면 환불 불가
    if (finalUsedCredits > 0) {
      return { eligible: false, reason: 'paid_to_paid_with_usage' };
    } else {
      return { 
        eligible: true, 
        reason: 'paid_to_paid_no_usage',
        amount: PLAN_PRICES[subscription.plan as keyof typeof PLAN_PRICES] || 0
      };
    }
  } else {
    // 기존 로직 (48시간 + 사용이력 없음)
    if (finalUsedCredits === 0) {
      return { 
        eligible: true, 
        reason: 'standard_refund',
        amount: PLAN_PRICES[subscription.plan as keyof typeof PLAN_PRICES] || 0
      };
    } else {
      return { eligible: false, reason: 'has_usage_history' };
    }
  }
}

/**
 * 플랜 변경 로그 기록
 */
export async function recordPlanChange(params: {
  userId: string;
  fromPlan: string;
  toPlan: string;
  creditsBeforeChange: number;
  creditsAfterChange: number;
  creditsUsedBeforeChange: number;
  isFirstPaidSubscription: boolean;
  refundPaymentKey?: string;
  newPaymentKey?: string;
  oldBillingCycleStart?: string;
  newBillingCycleStart?: string;
}): Promise<PlanChangeLog> {
  const supabase = supabaseService();
  
  const changeType = getPlanChangeType(params.fromPlan, params.toPlan);
  
  const { data, error } = await supabase
    .from('plan_change_logs')
    .insert({
      user_id: params.userId,
      from_plan: params.fromPlan,
      to_plan: params.toPlan,
      change_type: changeType,
      credits_before_change: params.creditsBeforeChange,
      credits_after_change: params.creditsAfterChange,
      credits_used_before_change: params.creditsUsedBeforeChange,
      is_first_paid_subscription: params.isFirstPaidSubscription,
      refund_payment_key: params.refundPaymentKey,
      new_payment_key: params.newPaymentKey,
      old_billing_cycle_start: params.oldBillingCycleStart,
      new_billing_cycle_start: params.newBillingCycleStart,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`플랜 변경 로그 기록 실패: ${error.message}`);
  }

  return data;
}

/**
 * 토스 결제 환불
 */
export async function refundTossPayment(paymentKey: string, reason: string) {
  const idempotencyKey = `refund_${paymentKey}_${Date.now()}`;
  
  const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      cancelReason: reason,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`환불 실패: ${errorText}`);
  }

  return await response.json();
}

/**
 * 토스 빌링키 결제
 */
export async function chargeWithBillingKey(params: {
  billingKey: string;
  amount: number;
  orderId: string;
  customerKey: string;
}) {
  const response = await fetch(`https://api.tosspayments.com/v1/billing/${params.billingKey}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount,
      orderId: params.orderId,
      customerKey: params.customerKey,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`빌링키 결제 실패: ${errorText}`);
  }

  return await response.json();
}

/**
 * 최근 결제 내역 조회
 */
export async function getLastPayment(userId: string) {
  const supabase = supabaseService();
  
  const { data } = await supabase
    .from('billing_webhook_logs')
    .select('*')
    .eq('customer_key', `user_${userId}`)
    .eq('event_type', 'PAYMENT')
    .eq('status', 'DONE')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

