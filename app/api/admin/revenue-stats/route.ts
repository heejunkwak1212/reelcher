import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const supabaseAdmin = supabaseService();
    
    // 관리자 권한 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 날짜 계산
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // 현재 활성 구독 조회 (MRR 계산용)
    const { data: activeSubscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, user_id')
      .eq('status', 'active');

    if (subscriptionsError) {
      console.error('구독 정보 조회 실패:', subscriptionsError);
      return NextResponse.json({ error: '구독 정보를 불러올 수 없습니다' }, { status: 500 });
    }

    // 플랜별 가격 정의
    const planPrices: Record<string, number> = {
      starter: 9900,
      pro: 29900,
      business: 99900,
    };

    // MRR 계산
    const mrr = activeSubscriptions?.reduce((total, sub) => {
      const price = planPrices[sub.plan.toLowerCase()] || 0;
      return total + price;
    }, 0) || 0;

    // 전체 수익 조회 (모든 완료된 결제)
    const { data: allPayments, error: paymentsError } = await supabaseAdmin
      .from('billing_webhook_logs')
      .select('amount, created_at')
      .eq('status', 'DONE');

    if (paymentsError) {
      console.error('결제 내역 조회 실패:', paymentsError);
      return NextResponse.json({ error: '결제 내역을 불러올 수 없습니다' }, { status: 500 });
    }

    // 총 수익 계산
    const totalRevenue = allPayments?.reduce((total, payment) => total + (payment.amount || 0), 0) || 0;

    // 이번 달 수익 계산
    const thisMonthRevenue = allPayments?.filter(payment => {
      const paymentDate = new Date(payment.created_at);
      return paymentDate >= currentMonthStart;
    }).reduce((total, payment) => total + (payment.amount || 0), 0) || 0;

    // 지난 달 수익 계산
    const lastMonthRevenue = allPayments?.filter(payment => {
      const paymentDate = new Date(payment.created_at);
      return paymentDate >= lastMonthStart && paymentDate <= lastMonthEnd;
    }).reduce((total, payment) => total + (payment.amount || 0), 0) || 0;

    // 월별 수익 트렌드 (최근 12개월)
    const monthlyTrends = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthRevenue = allPayments?.filter(payment => {
        const paymentDate = new Date(payment.created_at);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      }).reduce((total, payment) => total + (payment.amount || 0), 0) || 0;

      monthlyTrends.push({
        month: monthStart.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' }),
        revenue: monthRevenue,
        year: monthStart.getFullYear(),
        monthNumber: monthStart.getMonth() + 1,
      });
    }

    // 플랜별 구독 분포
    const planDistribution = activeSubscriptions?.reduce((acc, sub) => {
      const plan = sub.plan.toLowerCase();
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // 주요 지표 계산
    const averageRevenuePerUser = activeSubscriptions?.length ? mrr / activeSubscriptions.length : 0;
    const monthOverMonthGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;

    const stats = {
      mrr, // 월간 반복 수익
      totalRevenue, // 총 수익
      thisMonthRevenue, // 이번 달 수익
      lastMonthRevenue, // 지난 달 수익
      monthOverMonthGrowth, // 월간 성장률
      activeSubscriptions: activeSubscriptions?.length || 0, // 활성 구독 수
      averageRevenuePerUser, // 사용자당 평균 수익
      planDistribution, // 플랜별 분포
      monthlyTrends, // 월별 트렌드
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('수익 통계 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
