import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    const svc = supabaseService()
    const { data: prof } = await svc.from('profiles').select('role, plan, display_name').eq('user_id', user.id).single()
    // Auto-upgrade admin to business plan
    if ((prof?.role || 'user') === 'admin' && prof?.plan !== 'business') {
      await svc.from('profiles').update({ plan: 'business' }).eq('user_id', user.id)
      ;(prof as any).plan = 'business'
    }
    const { data: cr } = await svc.from('credits').select('balance').eq('user_id', user.id).single()
    const url = new URL(req.url)
    const scope = url.searchParams.get('scope')
    if (scope === 'search-stats') {
      try {
        // search_counters 테이블에서 정확한 통계 가져오기
        const { data: counters, error: countersError } = await svc.from('search_counters')
          .select('today_count, month_count')
          .eq('user_id', user.id)
          .single()

        if (countersError) {
          console.log('search_counters에서 데이터 없음, 0으로 초기화:', countersError.message)
        }

        const today = Number(counters?.today_count || 0)
        const month = Number(counters?.month_count || 0)

        console.log('검색 통계 조회 결과:', { today, month, counters })

        // recent keywords: last 2 days (platform_searches 테이블에서 키워드 검색용 더미 레코드 조회)
        const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        const { data: rec, error: keywordError } = await svc.from('platform_searches')
          .select('keyword, created_at, platform')
          .eq('user_id', user.id)
          .eq('search_type', 'keyword')
          .eq('results_count', 0) // 키워드 저장용 더미 레코드만
          .eq('credits_used', 0)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50)

        if (keywordError) {
          console.error('최근 키워드 조회 오류:', keywordError)
        }

        // 중복 제거하되 플랫폼 정보도 포함
        const keywordMap = new Map()
        ;(rec || []).forEach((r: any) => {
          if (r.keyword && !keywordMap.has(r.keyword)) {
            keywordMap.set(r.keyword, { keyword: r.keyword, platform: r.platform, created_at: r.created_at })
          }
        })
        const recent = Array.from(keywordMap.values()).slice(0, 12).map(item => item.keyword)

        console.log('최근 키워드 조회 결과:', { recent: recent.length, keywordError })

        // month credit usage: sum of credits_used for current month (platform_searches 테이블)
        const monthStartIso = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
        const { data: monthRows, error: creditError } = await svc.from('platform_searches')
          .select('credits_used, created_at')
          .eq('user_id', user.id)
          .gte('created_at', monthStartIso)
          .gt('results_count', 0) // 실제 검색 기록만 (더미 레코드 제외)

        if (creditError) {
          console.error('월 크레딧 사용량 조회 오류:', creditError)
        }

        const monthCredits = (monthRows || []).reduce((sum, r: any) => sum + (Number(r?.credits_used || 0) || 0), 0)
        
        console.log('월 크레딧 사용량 조회 결과:', { monthCredits, monthRows: monthRows?.length || 0, creditError })
        
        return Response.json({ today, month, recent, monthCredits })
      } catch (error) {
        console.error('search-stats 조회 전체 오류:', error)
        return Response.json({ today: 0, month: 0, recent: [], monthCredits: 0 })
      }
    }
    return Response.json({ id: user.id, email: user.email, role: prof?.role || 'user', plan: prof?.plan || 'free', display_name: prof?.display_name, credits: (cr?.balance || 0) as number })
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}




