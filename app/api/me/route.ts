import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    console.log('🔍 /api/me 엔드포인트 호출');
    
    const ssr = await supabaseServer()
    console.log('✅ Supabase 서버 클라이언트 생성 완료');
    
    const { data: { user }, error: authError } = await ssr.auth.getUser()
    
    if (authError) {
      console.error('🚫 인증 오류 발생:', authError);
      return new Response(JSON.stringify({ error: '인증 실패', details: authError.message }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!user) {
      console.error('🚫 사용자 정보 없음');
      return new Response(JSON.stringify({ error: '로그인 필요' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('👤 인증된 사용자:', user.id);
    const svc = supabaseService()
    const { data: prof } = await svc.from('profiles').select('role, plan, display_name').eq('user_id', user.id).single()
    // Auto-upgrade admin to business plan
    if ((prof?.role || 'user') === 'admin' && prof?.plan !== 'business') {
      await svc.from('profiles').update({ plan: 'business' }).eq('user_id', user.id)
      ;(prof as any).plan = 'business'
    }
    const { data: cr } = await svc.from('credits').select('balance, reserved').eq('user_id', user.id).single()
    const url = new URL(req.url)
    const scope = url.searchParams.get('scope')
    if (scope === 'search-stats') {
      try {
        // 검색 통계와 크레딧 사용량을 분리하여 계산
        // 1. 검색 기록 (자막 추출 제외)
        const { data: searchHistory, error: statsError } = await svc
          .from('search_history')
          .select('created_at, credits_used, keyword, search_type')
          .eq('user_id', user.id)
          .neq('search_type', 'subtitle_extraction') // 자막 추출은 검색통계에서 제외
        
        // 2. 크레딧 기록 (자막 추출 포함)
        const { data: creditHistory, error: creditError } = await svc
          .from('search_history')
          .select('created_at, credits_used')
          .eq('user_id', user.id)
          .gt('credits_used', 0) // 크레딧이 사용된 모든 기록 (자막 추출 포함)
        
        if (statsError || creditError) {
          console.error('🔴 search-stats 조회 실패:', { statsError, creditError })
                  return Response.json({ 
          id: user.id,
          email: user.email,
          role: prof?.role || 'user',
          plan: prof?.plan || 'free',
          display_name: prof?.display_name,
          today: 0, 
          month: 0, 
          recent: [], 
          monthCredits: 0,
          credits: (cr?.balance || 0) as number
        })
        }
        
        const now = new Date()
        const today_date = now.toISOString().split('T')[0] // YYYY-MM-DD
        
        // 정확한 날짜 계산: 오늘 00:00:00부터 시작
        const todayStart = new Date(now)
        todayStart.setHours(0, 0, 0, 0)
        
        // 최근 30일: 오늘 포함하여 30일 전 00:00:00부터 오늘 끝까지
        const monthStart = new Date(todayStart)
        monthStart.setDate(monthStart.getDate() - 29) // 오늘 포함 30일
        const monthEnd = new Date(todayStart)
        monthEnd.setDate(monthEnd.getDate() + 1) // 내일 00:00:00 (오늘 23:59:59까지)
        
        console.log('📅 /api/me 날짜 범위:', {
          today_date,
          monthStart: monthStart.toISOString(),
          monthEnd: monthEnd.toISOString()
        })
        console.log('📊 /api/me 검색 기록 개수:', {
          searchRecords: searchHistory?.length || 0,
          creditRecords: creditHistory?.length || 0
        })
        
        let today = 0
        let month = 0
        let monthCredits = 0
        const recentKeywordEntries: { keyword: string; created_at: string }[] = []
        
        for (const record of searchHistory || []) {
          const recordDate = new Date(record.created_at)
          const recordDateStr = recordDate.toISOString().split('T')[0]
          
          // 오늘 검색 수
          if (recordDateStr === today_date) {
            today++
          }
          
          // 최근 30일 검색 수 (/api/me/stats와 동일한 로직)
          if (recordDate >= monthStart) {
            month++
          }
          
          // 최근 키워드 수집 (2일 이내, 자막 추출/URL 검색 제외)
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          if (recordDate >= twoDaysAgo && record.keyword && 
              (record as any).search_type !== 'subtitle_extraction' &&
              (record as any).search_type !== 'url' &&
              !record.keyword.startsWith('http')) {
            
            let keyword = record.keyword
            
            // 프로필 검색인 경우 @ 접두사 추가
            if ((record as any).search_type === 'profile' && !keyword.startsWith('@')) {
              keyword = `@${keyword}`
            }
            
            recentKeywordEntries.push({
              keyword: keyword,
              created_at: record.created_at
            })
          }
        }
        
        // 크레딧 사용량 계산 (자막 추출 포함)
        for (const record of creditHistory || []) {
          const recordDate = new Date(record.created_at)
          
          // 최근 30일 크레딧 사용량 (/api/me/stats와 동일한 로직)
          if (recordDate >= monthStart) {
            monthCredits += Number(record.credits_used || 0)
          }
        }
        
        // 키워드를 최신순으로 정렬하고 중복 제거
        const uniqueKeywords = []
        const seenKeywords = new Set()
        
        // 최신순으로 정렬
        recentKeywordEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        
        for (const entry of recentKeywordEntries) {
          if (!seenKeywords.has(entry.keyword)) {
            seenKeywords.add(entry.keyword)
            uniqueKeywords.push(entry.keyword)
          }
        }
        
        const recentKeywords = uniqueKeywords

        console.log('📊 /api/me (search-stats) 최종 계산 결과:', { 
          today, 
          month, 
          monthCredits, 
          recent: recentKeywords.length,
          searchHistoryCount: searchHistory?.length || 0,
          creditHistoryCount: creditHistory?.length || 0
        })
        
        return Response.json({ 
          id: user.id,
          email: user.email,
          role: prof?.role || 'user',
          plan: prof?.plan || 'free',
          display_name: prof?.display_name,
          today, 
          month, 
          monthCredits,
          credits: (cr?.balance || 0) as number
        })
      } catch (error) {
        console.error('search-stats 조회 전체 오류:', error)
        return Response.json({ 
          id: user.id,
          email: user.email,
          role: prof?.role || 'user',
          plan: prof?.plan || 'free',
          display_name: prof?.display_name,
          today: 0, 
          month: 0, 
          monthCredits: 0,
          credits: (cr?.balance || 0) as number  // 오류 시에도 크레딧 정보 포함
        })
      }
    }
    
    if (scope === 'credits-detail') {
      const response = Response.json({ 
        id: user.id, 
        email: user.email, 
        role: prof?.role || 'user', 
        plan: prof?.plan || 'free', 
        display_name: prof?.display_name, 
        credits: (cr?.balance || 0) as number,
        balance: (cr?.balance || 0) as number,
        reserved: (cr?.reserved || 0) as number
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      return response
    }
    
    const response = Response.json({ id: user.id, email: user.email, role: prof?.role || 'user', plan: prof?.plan || 'free', display_name: prof?.display_name, credits: (cr?.balance || 0) as number })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error('🚫 /api/me 전체 오류:', error);
    
    // 네트워크 타임아웃 에러 특별 처리
    if (error instanceof Error && error.message.includes('fetch failed')) {
      console.error('🌐 네트워크 연결 오류 - Supabase 연결 실패');
      return new Response(JSON.stringify({ 
        error: '네트워크 연결 오류', 
        details: 'Supabase 서버와의 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
        type: 'NETWORK_ERROR'
      }), { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: '서버 오류', 
      details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      type: 'SERVER_ERROR'
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    });
  }
}




