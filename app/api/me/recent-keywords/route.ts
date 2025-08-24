import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // search_history 테이블에서 최근 키워드 조회 (2일 이내, 중복 제거, 최신순)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: recentKeywords, error: keywordsError } = await supabase
      .from('search_history')
      .select('keyword, platform, search_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', twoDaysAgo)
      .not('keyword', 'is', null)
      .neq('keyword', '')
      .neq('search_type', 'subtitle_extraction') // 자막 추출 제외
      .order('created_at', { ascending: false })
    
    if (keywordsError) {
      console.error('최근 키워드 조회 실패:', keywordsError)
      return NextResponse.json(
        { error: '최근 키워드 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    // 중복 제거 (키워드 기준) 및 최신순 정렬
    const uniqueKeywords = []
    const seenKeywords = new Set()
    
    for (const record of recentKeywords || []) {
      if (!seenKeywords.has(record.keyword)) {
        seenKeywords.add(record.keyword)
        uniqueKeywords.push({
          keyword: record.keyword,
          platform: record.platform,
          search_type: record.search_type,
          created_at: record.created_at
        })
      }
    }
    
    const result = {
      success: true,
      recent: uniqueKeywords // 48시간 이내 모든 키워드 반환 (클라이언트에서 페이지네이션)
    }
    
    console.log('🔑 /api/me/recent-keywords 응답:', {
      total: uniqueKeywords.length,
      returned: result.recent.length,
      keywords: result.recent.map(k => k.keyword)
    })
    
    const response = NextResponse.json(result)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
    
  } catch (error) {
    console.error('최근 키워드 API 오류:', error)
    return NextResponse.json(
      { error: '최근 키워드 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}