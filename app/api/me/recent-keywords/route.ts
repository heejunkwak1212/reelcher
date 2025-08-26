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

    // search_history에서 키워드별 집계 데이터 조회 (최근 14일, URL/자막 제외)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    
    // 14일 지난 기록 자동 삭제
    try {
      const { error: deleteError } = await supabase
        .from('search_history')
        .delete()
        .eq('user_id', user.id)
        .lt('created_at', fourteenDaysAgo)
      
      if (deleteError) {
        console.error('14일 지난 기록 삭제 실패:', deleteError)
      } else {
        console.log('14일 지난 기록 자동 삭제 완료')
      }
    } catch (cleanupError) {
      console.error('기록 정리 중 오류:', cleanupError)
    }
    
    // 원시 SQL로 키워드별 집계 수행
    const { data: aggregatedKeywords, error: keywordsError } = await supabase.rpc('get_keyword_stats', {
      p_user_id: user.id,
      p_since_date: fourteenDaysAgo
    })
    
    // RPC가 없으면 일반 쿼리로 대체
    let keywordStats = []
    if (keywordsError || !aggregatedKeywords) {
      console.log('RPC 없음, 일반 쿼리 사용')
      
      const { data: rawHistory, error: historyError } = await supabase
        .from('search_history')
        .select('keyword, platform, search_type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', fourteenDaysAgo)
        .not('keyword', 'is', null)
        .neq('keyword', '')
        .neq('search_type', 'subtitle_extraction')
        .neq('search_type', 'url') // URL 검색 제외
        .order('created_at', { ascending: false })
      
      if (historyError) {
        console.error('검색 이력 조회 실패:', historyError)
        return NextResponse.json(
          { error: '최근 키워드 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
      
      // JavaScript에서 집계 처리
      console.log('rawHistory 데이터:', rawHistory?.length, '개')
      console.log('rawHistory 샘플:', rawHistory?.slice(0, 3))
      const keywordMap = new Map()
      
      for (const record of rawHistory || []) {
        let keyword = record.keyword.trim()
        
        // URL로 시작하는 키워드 제외 (추가 안전장치)
        if (keyword.startsWith('http')) continue
        
        // 프로필 검색인 경우 @ 접두사 추가
        if (record.search_type === 'profile' && !keyword.startsWith('@')) {
          keyword = `@${keyword}`
        }
        
        const key = `${keyword}-${record.platform}`
        if (keywordMap.has(key)) {
          const existing = keywordMap.get(key)
          existing.search_count += 1
          // 최신순으로 정렬되어 있으므로 첫 번째가 가장 최근
          if (new Date(record.created_at) > new Date(existing.last_searched_at)) {
            existing.last_searched_at = record.created_at
          }
          // 가장 오래된 것 찾기
          if (new Date(record.created_at) < new Date(existing.first_searched_at)) {
            existing.first_searched_at = record.created_at
          }
        } else {
          keywordMap.set(key, {
            keyword: keyword,
            platform: record.platform,
            search_count: 1,
            first_searched_at: record.created_at,
            last_searched_at: record.created_at
          })
        }
      }
      
      keywordStats = Array.from(keywordMap.values())
        .sort((a, b) => new Date(b.last_searched_at).getTime() - new Date(a.last_searched_at).getTime())
      
      console.log('집계 완료, keywordStats 샘플:', keywordStats.slice(0, 2))
    } else {
      // RPC에서 받은 데이터도 URL 제외 및 프로필 @ 처리
      keywordStats = aggregatedKeywords.map((stat: any) => {
        let keyword = stat.keyword
        
        // URL로 시작하는 키워드 제외
        if (keyword.startsWith('http')) return null
        
        // 프로필 검색인 경우 @ 접두사 추가 (RPC에서 search_type 정보가 없다면 키워드 자체로 판단)
        // RPC 결과에 search_type이 포함되어 있다면 사용, 없다면 스킵
        
        return {
          ...stat,
          keyword: keyword
        }
      }).filter(Boolean)
    }
    
    const result = {
      success: true,
      recent: keywordStats.slice(0, 20), // 최근 20개만 반환
      sampleData: keywordStats.slice(0, 20) // 정확한 집계 데이터를 sampleData로도 제공
    }
    
    console.log('🔑 /api/me/recent-keywords 응답:', {
      total: keywordStats.length,
      returned: result.recent.length,
      keywords: result.recent.map(k => `${k.keyword} (${k.search_count}회)`),
      sampleData: result.recent.slice(0, 2)
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