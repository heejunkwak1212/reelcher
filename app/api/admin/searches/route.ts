import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    console.log('🔍 Admin searches API 호출')
    
    const url = new URL(req.url)
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'))
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') || '100')))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const fromDate = url.searchParams.get('from')
    const toDate = url.searchParams.get('to')
    
    console.log('📅 날짜 필터:', { fromDate, toDate, page, pageSize })

    const ssr = await supabaseServer()
    const { data: { user }, error: authError } = await ssr.auth.getUser()
    
    if (authError) {
      console.error('🚫 인증 오류:', authError)
      return new Response(JSON.stringify({ error: '인증 실패' }), { status: 401 })
    }
    
    if (!user) {
      console.error('🚫 사용자 없음')
      return new Response(JSON.stringify({ error: '로그인 필요' }), { status: 401 })
    }
    
    console.log('👤 인증된 사용자:', user.id)
    
    const { data: prof, error: profileError } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
    
    if (profileError) {
      console.error('🚫 프로필 조회 오류:', profileError)
      return new Response(JSON.stringify({ error: '프로필 조회 실패' }), { status: 500 })
    }
    
    if (prof?.role !== 'admin') {
      console.error('🚫 관리자 권한 없음:', prof?.role)
      return new Response(JSON.stringify({ error: '관리자 권한 필요' }), { status: 403 })
    }
    
    console.log('✅ 관리자 인증 완료')

    const svc = supabaseService()
    
    // search_history 쿼리 생성
    let searchQuery = svc.from('search_history').select('*', { count: 'exact' })
    
    // 날짜 필터링 개선 (시간 범위 포함)
    if (fromDate) {
      const fromDateTime = new Date(fromDate + 'T00:00:00.000Z').toISOString()
      searchQuery = searchQuery.gte('created_at', fromDateTime)
      console.log('📅 시작 날짜 필터:', fromDateTime)
    }
    if (toDate) {
      const toDateTime = new Date(toDate + 'T23:59:59.999Z').toISOString()
      searchQuery = searchQuery.lte('created_at', toDateTime)
      console.log('📅 종료 날짜 필터:', toDateTime)
    }
  
    const { data: searchHistory, count, error: searchError } = await searchQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    if (searchError) {
      console.error('🚫 검색 기록 조회 오류:', searchError)
      return new Response(JSON.stringify({ error: searchError.message }), { status: 500 })
    }

    console.log(`📊 검색 기록 조회 완료: ${searchHistory?.length || 0}개 / 총 ${count || 0}개`)

    if (!searchHistory || searchHistory.length === 0) {
      console.log('📝 검색 기록 없음')
      return Response.json({ 
        items: [], 
        total: count || 0, 
        page, 
        pageSize, 
        from: fromDate, 
        to: toDate 
      })
    }

    // 유저 ID들 추출
    const userIds = [...new Set(searchHistory.map(item => item.user_id))]
    console.log(`👥 사용자 수: ${userIds.length}명`)
    
    // 유저 정보 가져오기
    const { data: profiles, error: profilesError } = await svc
      .from('profiles')
      .select('user_id, plan, subscription_start_date, last_payment_date, display_name, email')
      .in('user_id', userIds);

    if (profilesError) {
      console.error('🚫 프로필 정보 조회 오류:', profilesError);
    }

    // 데이터 조합
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const transformedData = searchHistory.map(item => {
      const profile = profileMap.get(item.user_id);
      
      return {
        ...item,
        user_email: profile?.email || profile?.display_name || `user_${item.user_id.slice(0, 8)}`,
        user_plan: profile?.plan || 'free',
        subscription_start_date: profile?.subscription_start_date,
        last_payment_date: profile?.last_payment_date,
      };
    });

    console.log('✅ 데이터 변환 완료');

    return Response.json({ 
      items: transformedData, 
      total: count || 0, 
      page, 
      pageSize, 
      from: fromDate, 
      to: toDate 
    });

  } catch (error) {
    console.error('🚫 Admin searches API 전체 오류:', error);
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), { status: 500 });
  }
}


