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

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const actionType = searchParams.get('action_type');
    
    const offset = (page - 1) * limit;

    // 필터 조건 구성
    let query = supabaseAdmin
      .from('cancellation_logs')
      .select('*')
      .order('cancellation_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (actionType && actionType !== 'all') {
      query = query.eq('action_type', actionType);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error('취소 로그 조회 실패:', logsError);
      return NextResponse.json({ error: '데이터를 불러올 수 없습니다' }, { status: 500 });
    }

    // 다음 페이지 존재 여부 확인
    const nextPageQuery = supabaseAdmin
      .from('cancellation_logs')
      .select('id', { count: 'exact', head: true })
      .range(offset + limit, offset + limit);

    if (actionType && actionType !== 'all') {
      nextPageQuery.eq('action_type', actionType);
    }

    const { count } = await nextPageQuery;
    const hasMore = (count || 0) > 0;

    return NextResponse.json({
      logs: logs || [],
      hasMore,
      currentPage: page,
      limit,
    });

  } catch (error) {
    console.error('취소 로그 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
