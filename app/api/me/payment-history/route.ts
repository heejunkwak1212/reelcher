import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    // Note: supabaseAdmin은 보안상 위험하므로 사용하지 않고, 
    // 대신 적절한 RLS 정책을 통해 사용자별 접근 제어
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    console.log(`👤 인증된 사용자: ${user.id}`)

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '5');

    const offset = (page - 1) * limit;

    // 12개월 전 날짜 계산
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // 디버깅: 간단한 쿼리로 데이터 존재 확인
    const { data: allData, error: allError } = await supabase
      .from('billing_webhook_logs')
      .select('id, event_type, status, customer_key, order_id')
      .limit(10);

    console.log(`🔍 전체 데이터 조회 결과: ${allData?.length || 0}개`)
    if (allData && allData.length > 0) {
      console.log('📋 전체 데이터 샘플:', allData.slice(0, 3))
    }

    console.log(`🔍 결제 내역 조회 시작: user_id=${user.id}, customer_key=user_${user.id}`)
    console.log(`📅 12개월 전: ${twelveMonthsAgo.toISOString()}`)

    // 해당 사용자의 결제 내역 조회 (최근 12개월)
    // 1. 실제 결제 이벤트 조회 (PAYMENT + payment_key가 있는 것만)
    console.log(`🔍 실제 결제 이벤트 조회: customer_key=user_${user.id}`)
    const { data: paymentEvents, error: paymentError1 } = await supabase
      .from('billing_webhook_logs')
      .select('*')
      .eq('customer_key', `user_${user.id}`)
      .eq('event_type', 'PAYMENT')
      .eq('status', 'DONE')
      .not('payment_key', 'is', null) // payment_key가 있는 실제 결제만
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: false });

    console.log(`📊 실제 결제 이벤트 결과: ${paymentEvents?.length || 0}개`)
    if (paymentEvents && paymentEvents.length > 0) {
      console.log('📋 실제 결제 이벤트 샘플:', paymentEvents[0])
    }

    // 2. 구독 취소 내역 조회 (환불이 있는 경우만)
    console.log(`🔍 구독 취소 내역 조회: user_id=${user.id} (환불이 있는 경우만)`)
    const { data: cancellationEvents, error: cancellationError } = await supabase
      .from('cancellation_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('action_type', 'subscription_cancel') // 올바른 action_type 사용
      .eq('refund_processed', true) // 환불이 처리된 경우만
      .gte('created_at', twelveMonthsAgo.toISOString())
      .order('created_at', { ascending: false });

    console.log(`📊 구독 취소 내역 결과: ${cancellationEvents?.length || 0}개`)
    if (cancellationEvents && cancellationEvents.length > 0) {
      console.log('📋 구독 취소 내역 샘플:', cancellationEvents[0])
    }

    if (paymentError1 || cancellationError) {
      console.error('내역 조회 실패:', { paymentError1, cancellationError });
      return NextResponse.json({ error: '결제 내역을 불러올 수 없습니다' }, { status: 500 });
    }

    // 결제 이벤트와 취소 이벤트를 합치고 정렬
    const paymentItems = (paymentEvents || []).map(event => ({ ...event, type: 'payment' }));
    const cancellationItems = (cancellationEvents || []).map(event => ({ ...event, type: 'cancellation' }));
    
    const allEvents = [...paymentItems, ...cancellationItems]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 페이지네이션 적용
    const paymentLogs = allEvents.slice(offset, offset + limit);

    console.log(`📊 결제 내역 조회 결과: ${paymentLogs?.length || 0}개 항목 (전체: ${allEvents.length}개)`);

    // 다음 페이지 존재 여부 확인
    const { count: paymentNextCount, error: paymentNextError1 } = await supabase
      .from('billing_webhook_logs')
      .select('*', { count: 'exact', head: true })
      .eq('customer_key', `user_${user.id}`)
      .eq('event_type', 'PAYMENT')
      .eq('status', 'DONE')
      .not('payment_key', 'is', null) // payment_key가 있는 실제 결제만
      .gte('created_at', twelveMonthsAgo.toISOString());

    const { count: cancellationNextCount, error: cancellationNextError } = await supabase
      .from('cancellation_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action_type', 'subscription_cancel') // 올바른 action_type 사용
      .gte('created_at', twelveMonthsAgo.toISOString());

    const totalCount = (paymentNextCount || 0) + (cancellationNextCount || 0);
    const hasMore = totalCount > offset + limit;

    // 플랜 정보 매핑 (대소문자 무관하게 검색)
    const getPlanFromOrderId = (orderId: string, planAtCancellation?: string) => {
      if (planAtCancellation) return planAtCancellation.toUpperCase();
      const lowerOrderId = orderId?.toLowerCase() || '';
      if (lowerOrderId.includes('starter')) return 'STARTER';
      if (lowerOrderId.includes('pro')) return 'PRO';
      if (lowerOrderId.includes('business')) return 'BUSINESS';
      
      // subscription_ 패턴인 경우 DB에서 실제 플랜 조회
      if (lowerOrderId.includes('subscription_')) {
        // 현재는 STARTER 플랜으로 기본 설정 (필요시 DB 조회 추가 가능)
        return 'STARTER';
      }
      return 'UNKNOWN';
    };

    // 결제 수단 정보 추출 (카드만 사용하므로 항상 "신용카드")
    const getPaymentMethodDisplay = (rawPayload: any, type: string) => {
      if (type === 'cancellation') {
        return '구독 취소';
      }
      
      // 카드 정보가 있으면 카드 번호 뒷자리 표시, 없으면 기본 "신용카드"
      if (rawPayload?.card?.number) {
        const lastFour = rawPayload.card.number.slice(-4);
        return `신용카드 (****${lastFour})`;
      }
      return '신용카드';
    };

    // 응답 데이터 포맷팅
    const formattedPayments = paymentLogs?.map(log => {
      if (log.type === 'cancellation') {
        // 구독 취소 내역
        return {
          id: log.id,
          date: new Date(log.created_at).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          plan: getPlanFromOrderId('', log.plan_at_cancellation),
          amount: log.refund_processed && log.refund_amount > 0 
            ? `${log.refund_amount.toLocaleString()}원 환불`
            : '구독 취소',
          paymentMethod: getPaymentMethodDisplay(null, 'cancellation'),
          status: log.refund_processed ? '환불 완료' : '취소 완료',
          created_at: log.created_at
        };
      } else {
        // 실제 결제 내역
        return {
          id: log.id,
          date: new Date(log.created_at).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          plan: getPlanFromOrderId(log.order_id),
          amount: `${(log.amount || 0).toLocaleString()}원`,
          paymentMethod: getPaymentMethodDisplay(log.raw_payload, 'payment'),
          status: '완료',
          created_at: log.created_at
        };
      }
    }) || [];

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
