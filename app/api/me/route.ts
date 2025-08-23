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
    const { data: cr } = await svc.from('credits').select('balance, reserved').eq('user_id', user.id).single()
    const url = new URL(req.url)
    const scope = url.searchParams.get('scope')
    if (scope === 'search-stats') {
      try {
        // search_history 테이블에서 모든 통계를 직접 계산 (/api/me/stats와 동일한 방식)
        const { data: searchHistory, error: statsError } = await svc
          .from('search_history')
          .select('created_at, credits_used, keyword')
          .eq('user_id', user.id)
        
        if (statsError) {
          console.error('🔴 search-stats 조회 실패:', statsError)
          return Response.json({ 
            today: 0, 
            month: 0, 
            recent: [], 
            monthCredits: 0,
            credits: (cr?.balance || 0) as number
          })
        }
        
        const now = new Date()
        const today_date = now.toISOString().split('T')[0] // YYYY-MM-DD
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        
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
          
          // 이번 달 검색 수 및 크레딧 사용량
          if (recordDate >= monthStart) {
            month++
            monthCredits += Number(record.credits_used || 0)
          }
          
          // 최근 키워드 수집 (2일 이내)
          const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          if (recordDate >= twoDaysAgo && record.keyword) {
            recentKeywordEntries.push({
              keyword: record.keyword,
              created_at: record.created_at
            })
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

        console.log('🔄 search-stats API 응답 (search_history 기반):', { today, month, monthCredits, recent: recentKeywords.length })
        
        return Response.json({ 
          today, 
          month, 
          recent: recentKeywords, // 48시간 이내 모든 키워드 (클라이언트에서 페이지네이션)
          monthCredits,
          credits: (cr?.balance || 0) as number
        })
      } catch (error) {
        console.error('search-stats 조회 전체 오류:', error)
        return Response.json({ 
          today: 0, 
          month: 0, 
          recent: [], 
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
  } catch {
    return new Response('Bad Request', { status: 400 })
  }
}




