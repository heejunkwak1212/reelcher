import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ 
        isLoggedIn: false,
        currentPlan: 'free',
        hasActiveSubscription: false
      });
    }

    // 사용자 프로필 정보 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('프로필 조회 실패:', profileError);
      return NextResponse.json({ 
        isLoggedIn: true,
        currentPlan: 'free',
        hasActiveSubscription: false
      });
    }

    // 구독 정보 조회
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status, plan, next_charge_at, billing_key, toss_customer_key')
      .eq('user_id', user.id)
      .single();

    const currentPlan = profile?.plan || 'free';
    const hasActiveSubscription = subscription?.status === 'active';

    return NextResponse.json({
      isLoggedIn: true,
      currentPlan,
      hasActiveSubscription,
      subscriptionPlan: subscription?.plan || null,
      nextChargeAt: subscription?.next_charge_at || null,
      subscription: subscription ? {
        billingKey: subscription.billing_key,
        customerKey: subscription.toss_customer_key,
        status: subscription.status,
        plan: subscription.plan,
        nextChargeAt: subscription.next_charge_at,
      } : null,
    });

  } catch (error) {
    console.error('구독 상태 조회 API 오류:', error);
    return NextResponse.json({ 
      isLoggedIn: false,
      currentPlan: 'free',
      hasActiveSubscription: false
    }, { status: 500 });
  }
}
