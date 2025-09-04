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

    // 유저 ID들 추출 (검색 기록이 있는 사용자)
    const searchUserIds = [...new Set(searchHistory.map(item => item.user_id))]
    console.log(`👥 검색 기록이 있는 사용자 수: ${searchUserIds.length}명`)
    
    // 모든 유저 정보 가져오기 (검색 기록이 없는 사용자도 포함)
    const { data: profiles, error: profilesError } = await svc
      .from('profiles')
      .select('user_id, plan, subscription_start_date, last_payment_date, display_name, email')
      .limit(1000) // 모든 사용자 조회

    // 실제 결제 기록 확인을 위한 billing_webhook_logs 조회
    const { data: billingLogs, error: billingError } = await svc
      .from('billing_webhook_logs')
      .select('customer_key, amount, status, event_type, created_at')
      .eq('event_type', 'PAYMENT')
      .eq('status', 'DONE')
      .eq('processed', true)

    if (billingError) {
      console.error('🚫 결제 기록 조회 오류:', billingError);
    }

    // 실제 결제가 있는 사용자 맵 생성
    const actualPaymentMap = new Map()
    billingLogs?.forEach(log => {
      const userId = log.customer_key?.replace('user_', '')
      if (userId) {
        actualPaymentMap.set(userId, {
          amount: log.amount,
          payment_date: log.created_at
        })
      }
    })

    if (profilesError) {
      console.error('🚫 프로필 정보 조회 오류:', profilesError);
    }

    console.log('📧 조회된 사용자 프로필들:', profiles?.map(p => ({ 
      user_id: p.user_id, 
      email: p.email, 
      display_name: p.display_name 
    })))

    // 데이터 조합 - 모든 사용자 포함
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const searchHistoryMap = new Map();
    
    // 검색 기록을 사용자별로 그룹화
    searchHistory.forEach(item => {
      if (!searchHistoryMap.has(item.user_id)) {
        searchHistoryMap.set(item.user_id, []);
      }
      searchHistoryMap.get(item.user_id).push(item);
    });

    // 모든 프로필에 대해 데이터 생성 (검색 기록이 없어도 표시)
    const transformedData: any[] = [];
    
    profiles?.forEach(profile => {
      const userSearchHistory = searchHistoryMap.get(profile.user_id) || [];
      
      if (userSearchHistory.length > 0) {
        // 검색 기록이 있는 사용자는 기존 방식대로
        userSearchHistory.forEach((item: any) => {
          // 실제 결제 기록이 있는지 확인
          const actualPayment = actualPaymentMap.get(profile.user_id)
          const hasActualPayment = actualPayment && profile.plan !== 'free'
          
          transformedData.push({
            ...item,
            user_email: profile.email || `user_${profile.user_id.slice(0, 8)}`,
            user_plan: profile.plan || 'free',
            subscription_start_date: profile.subscription_start_date,
            last_payment_date: hasActualPayment ? actualPayment.payment_date : null, // 실제 결제 기록 반영
          });
        });
      } else {
        // 검색 기록이 없는 사용자는 더미 레코드 생성
        const actualPayment = actualPaymentMap.get(profile.user_id)
        const hasActualPayment = actualPayment && profile.plan !== 'free'
        
        transformedData.push({
          id: `dummy_${profile.user_id}`,
          created_at: new Date().toISOString(),
          user_id: profile.user_id,
          user_email: profile.email || `user_${profile.user_id.slice(0, 8)}`,
          user_plan: profile.plan || 'free',
          subscription_start_date: profile.subscription_start_date,
          last_payment_date: hasActualPayment ? actualPayment.payment_date : null, // 실제 결제 기록 반영
          platform: null,
          search_type: null,
          keyword: null,
          requested_count: 0,
          results_count: 0,
          credits_used: 0,
          status: 'no_search_history'
        });
      }
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


