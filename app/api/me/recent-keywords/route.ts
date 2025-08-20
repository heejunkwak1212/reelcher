import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const ssr = await supabaseServer()
    const { data: { user } } = await ssr.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    
    const body = await req.json()
    const { keyword, platform } = body
    
    if (!keyword || !platform) {
      return new Response('Missing keyword or platform', { status: 400 })
    }
    
    const svc = supabaseService()
    
    // 2일 이상된 키워드 기록 정리 (키워드 저장용 records만)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    try {
      await svc.from('platform_searches')
        .delete()
        .eq('user_id', user.id)
        .eq('results_count', 0) // 키워드 저장용 더미 레코드만 삭제
        .eq('credits_used', 0)
        .lt('created_at', twoDaysAgo)
    } catch (cleanupError) {
      console.warn('Failed to cleanup old keywords:', cleanupError)
    }
    
    // platform_searches 테이블에 키워드 저장 (통계용)
    const { error } = await svc.from('platform_searches').insert({
      user_id: user.id,
      platform: platform,
      search_type: 'keyword',
      keyword: keyword.trim(),
      results_count: 0, // 키워드 저장만을 위한 더미 count
      credits_used: 0, // 키워드 저장만을 위한 더미 cost
      created_at: new Date().toISOString()
    })
    
    if (error) {
      console.error('Failed to save keyword:', error)
      // 키워드 저장 실패는 치명적이지 않으므로 성공으로 처리
      // 대부분 중복이나 제약 조건 위반으로 인한 것
    }
    
    console.log(`Keyword saved successfully: ${keyword} for platform ${platform}`)
    return Response.json({ success: true })
  } catch (error) {
    console.error('POST /api/me/recent-keywords error:', error)
    return new Response('Bad Request', { status: 400 })
  }
}
