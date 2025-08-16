import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { YouTubeClient, YouTubeAPIError } from '@/lib/youtube'
import { z } from 'zod'

// 기여도 분석 요청 스키마
const contributionSchema = z.object({
  channelId: z.string().min(1),
  videoId: z.string().min(1),
  viewCount: z.number().min(0)
})

export async function POST(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json()
    const { channelId, videoId, viewCount } = contributionSchema.parse(body)

    // YouTube API 키 확인
    const youtubeApiKey = process.env.YOUTUBE_API_KEY
    if (!youtubeApiKey) {
      return NextResponse.json(
        { error: 'YouTube API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    // YouTube API 클라이언트 생성
    const youtubeClient = new YouTubeClient(youtubeApiKey)

    // 기여도 분석 수행
    const contributionData = await youtubeClient.analyzeChannelContribution(
      channelId,
      videoId,
      viewCount
    )

    return NextResponse.json({
      success: true,
      contributionScore: contributionData.contributionScore,
      channelAvgViews: contributionData.channelAvgViews,
      totalVideosAnalyzed: contributionData.totalVideosAnalyzed,
      error: contributionData.error
    })

  } catch (error) {
    if (error instanceof YouTubeAPIError) {
      let errorMessage = error.message
      let statusCode = 500

      switch (error.code) {
        case 'QUOTA_EXCEEDED':
          errorMessage = 'YouTube API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          statusCode = 429
          break
        case 'KEY_INVALID':
          errorMessage = 'YouTube API 키가 유효하지 않습니다.'
          statusCode = 500
          break
        default:
          errorMessage = `YouTube API 오류: ${error.message}`
          statusCode = 500
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      )
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.', details: error.errors },
        { status: 400 }
      )
    }

    console.error('YouTube 기여도 분석 오류:', error)
    return NextResponse.json(
      { error: '기여도 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
