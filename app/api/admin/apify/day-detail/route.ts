import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { format } from 'date-fns'
import ApifyMonitor from '@/lib/apify-monitor'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')

    if (!date) {
      return Response.json({ error: '날짜가 필요합니다.' }, { status: 400 })
    }

    console.log(`📊 ${date} 상세 데이터 조회 시작`)

    const supabase = supabaseServer()
    const monitor = new ApifyMonitor(process.env.APIFY_TOKEN!)

    // 해당 날짜의 모든 검색 기록 조회 (Apify 사용한 것만)
    const { data: searchRecords, error: recordsError } = await supabase
      .from('search_history')
      .select(`
        *,
        profiles!inner(email)
      `)
      .gte('created_at', `${date}T00:00:00.000Z`)
      .lt('created_at', `${date}T23:59:59.999Z`)
      .in('platform', ['instagram', 'tiktok']) // YouTube는 Apify 안 사용
      .order('created_at', { ascending: false })

    if (recordsError) {
      console.error('검색 기록 조회 실패:', recordsError)
      return Response.json({ error: '검색 기록을 불러올 수 없습니다.' }, { status: 500 })
    }

    // 상세 데이터 구성
    const details = searchRecords.map(record => {
      const userEmail = record.profiles?.email || 'Unknown'
      const actorName = getActorDisplayName(record.platform, record.search_type)
      const cost = calculateApifyCost(record)
      
      return {
        time: format(new Date(record.created_at), 'HH:mm:ss'),
        userEmail,
        actorName,
        cost,
        status: record.status === 'completed' ? 'SUCCEEDED' : record.status?.toUpperCase() || 'UNKNOWN'
      }
    })

    return Response.json({
      date,
      details,
      totalCost: details.reduce((sum, d) => sum + d.cost, 0)
    })

  } catch (error) {
    console.error('일별 상세 데이터 조회 오류:', error)
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 액터 표시명 가져오기
function getActorDisplayName(platform: string, searchType?: string): string {
  if (searchType === 'subtitle_extraction') {
    return 'Subtitle Extractor'
  }
  
  const actorNames = {
    instagram: {
      hashtag: 'Instagram Hashtag Scraper',
      details: 'Instagram Scraper', 
      profile: 'Instagram Profile Scraper'
    },
    tiktok: {
      keyword: 'TikTok Scraper',
      profile: 'TikTok Profile Scraper'
    }
  }
  
  if (platform === 'instagram') {
    return actorNames.instagram.hashtag // 기본값
  } else if (platform === 'tiktok') {
    return actorNames.tiktok.keyword // 기본값
  }
  
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

// 원가 계산 함수
function calculateApifyCost(record: any): number {
  let effectiveCount = record.results_count || 0
  
  if ((record.status === 'cancelled' || record.status === 'pending') && record.credits_used) {
    if (record.requested_count) {
      effectiveCount = record.requested_count
    } else {
      const creditsUsed = record.credits_used
      if (creditsUsed <= 120) effectiveCount = 30
      else if (creditsUsed <= 240) effectiveCount = 60
      else if (creditsUsed <= 360) effectiveCount = 90
      else effectiveCount = 120
    }
  }
  
  const platform = record.platform
  const searchType = record.search_type
  
  // 자막 추출 비용
  if (searchType === 'subtitle_extraction') {
    if (platform === 'youtube') {
      return 0  // YouTube는 yt-dlp 사용으로 무료
    } else if (platform === 'instagram' || platform === 'tiktok') {
      return 0.038  // 인스타/틱톡 자막 추출: 1개당 $0.038
    }
    return 0
  }

  // 일반 검색 비용
  if (platform === 'instagram') {
    if (searchType === 'profile' || record.keyword?.startsWith('@')) {
      return effectiveCount * 0.0026
    } else {
      return effectiveCount * 0.0076
    }
  } else if (platform === 'tiktok') {
    return effectiveCount * 0.005
  } else if (platform === 'youtube') {
    return 0
  }

  return 0
}
