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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 전체 통계 조회
    const { data: totalStats, error: totalStatsError } = await supabaseAdmin
      .from('cancellation_logs')
      .select('action_type, refund_eligible, refund_processed, refund_amount');

    if (totalStatsError) {
      console.error('전체 통계 조회 실패:', totalStatsError);
      return NextResponse.json({ error: '통계를 불러올 수 없습니다' }, { status: 500 });
    }

    // 기간별 통계 조회
    const { data: todayStats, error: todayStatsError } = await supabaseAdmin
      .from('cancellation_logs')
      .select('id')
      .gte('cancellation_date', todayStart.toISOString());

    const { data: weekStats, error: weekStatsError } = await supabaseAdmin
      .from('cancellation_logs')
      .select('id')
      .gte('cancellation_date', weekStart.toISOString());

    const { data: monthStats, error: monthStatsError } = await supabaseAdmin
      .from('cancellation_logs')
      .select('id')
      .gte('cancellation_date', monthStart.toISOString());

    // 취소 사유별 통계
    const { data: reasonStats, error: reasonStatsError } = await supabaseAdmin
      .from('cancellation_logs')
      .select('reason')
      .order('cancellation_date', { ascending: false })
      .limit(1000); // 최근 1000건

    if (reasonStatsError) {
      console.error('사유 통계 조회 실패:', reasonStatsError);
    }

    // 통계 계산
    const total_cancellations = totalStats?.length || 0;
    const subscription_cancels = totalStats?.filter(log => log.action_type === 'subscription_cancel').length || 0;
    const account_deletes = totalStats?.filter(log => log.action_type === 'account_delete').length || 0;
    const refunds_processed = totalStats?.filter(log => log.refund_processed).length || 0;
    const total_refund_amount = totalStats?.reduce((sum, log) => sum + (log.refund_amount || 0), 0) || 0;

    // 사유별 집계
    const reasonCounts: Record<string, number> = {};
    reasonStats?.forEach(log => {
      if (log.reason) {
        reasonCounts[log.reason] = (reasonCounts[log.reason] || 0) + 1;
      }
    });

    const common_reasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const stats = {
      total_cancellations,
      subscription_cancels,
      account_deletes,
      refunds_processed,
      total_refund_amount,
      today_cancellations: todayStats?.length || 0,
      this_week_cancellations: weekStats?.length || 0,
      this_month_cancellations: monthStats?.length || 0,
      common_reasons,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('취소 통계 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
