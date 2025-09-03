import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '5');
    
    const offset = (page - 1) * limit;

    // 12개월 전 날짜 계산
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // 해당 사용자의 결제 내역 조회 (최근 12개월)
    // order_id에 user_id가 포함되거나 customer_key가 일치하는 경우 + PLAN_CHANGE 포함
    const { data: paymentLogs, error: paymentError } = await supabase
      .from('billing_webhook_logs')
      .select('*')
      .or(`order_id.like.%${user.id}%,customer_key.eq.user_${user.id}`) // order_id에 user_id가 포함되거나 customer_key가 일치하는 경우
      .eq('status', 'DONE') // 완료된 결제만
      .in('event_type', ['PAYMENT', 'PLAN_CHANGE']) // 결제와 플랜 변경 모두 포함
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (paymentError) {
      console.error('결제 내역 조회 실패:', paymentError);
      return NextResponse.json({ error: '결제 내역을 불러올 수 없습니다' }, { status: 500 });
    }

    // 다음 페이지 존재 여부 확인
    const { count: nextPageCount, error: nextPageError } = await supabase
      .from('billing_webhook_logs')
      .select('*', { count: 'exact', head: true })
      .like('order_id', `%${user.id}%`)
      .eq('status', 'DONE')
      .gte('created_at', twelveMonthsAgo.toISOString())
      .range(offset + limit, offset + limit);

    const hasMore = nextPageCount && nextPageCount > 0;

    // 플랜 정보 매핑
    const getPlanFromOrderId = (orderId: string, eventType: string, rawPayload: any) => {
      if (orderId.includes('starter')) return 'STARTER';
      if (orderId.includes('pro')) return 'PRO';
      if (orderId.includes('business')) return 'BUSINESS';

      // 플랜 변경 이벤트의 경우 raw_payload에서 플랜 정보 추출
      if (eventType === 'PLAN_CHANGE' && rawPayload?.toPlan) {
        return rawPayload.toPlan.toUpperCase();
      }

      return 'UNKNOWN';
    };

    // 결제 수단 정보 추출
    const getPaymentMethodDisplay = (rawPayload: any, eventType: string) => {
      if (eventType === 'PLAN_CHANGE') {
        return '플랜 변경';
      }

      if (rawPayload?.card) {
        const card = rawPayload.card;
        return `${card.issuerCode || '신용카드'} (****${card.number?.slice(-4) || '****'})`;
      }
      return rawPayload?.method || '신용카드';
    };

    // 응답 데이터 포맷팅
    const formattedPayments = paymentLogs?.map(log => ({
      id: log.id,
      date: new Date(log.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      plan: getPlanFromOrderId(log.order_id, log.event_type, log.raw_payload),
      amount: log.event_type === 'PLAN_CHANGE' ? '플랜 변경' : `₩${(log.amount || 0).toLocaleString()}`,
      paymentMethod: getPaymentMethodDisplay(log.raw_payload, log.event_type),
      status: '완료',
      created_at: log.created_at
    })) || [];

    return NextResponse.json({
      payments: formattedPayments,
      hasMore: !!hasMore,
      currentPage: page,
      limit,
    });

  } catch (error) {
    console.error('결제 내역 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
