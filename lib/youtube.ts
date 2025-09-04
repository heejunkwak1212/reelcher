import { IYouTubeVideo, IYouTubeSearchRequest, IYouTubeSearchResponse, IYouTubeContributionData } from '@/types'

interface YouTubeAPIResponse {
  items: any[]
  nextPageToken?: string
  pageInfo?: {
    totalResults: number
  }
}

interface YouTubeVideoSnippet {
  videoId: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnails: {
    default?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    high?: { url: string; width: number; height: number }
    maxres?: { url: string; width: number; height: number }
  }
  tags?: string[]
  categoryId: string
  defaultAudioLanguage?: string
}

interface YouTubeVideoStatistics {
  viewCount: string
  likeCount?: string
  commentCount?: string
}

interface YouTubeVideoContentDetails {
  duration: string
}

interface YouTubeVideoStatus {
  license: 'youtube' | 'creativeCommon'
}

interface YouTubeChannelStatistics {
  subscriberCount: string
}

class YouTubeAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'YouTubeAPIError'
  }
}

export class YouTubeClient {
  private apiKey: string
  private baseURL = 'https://www.googleapis.com/youtube/v3'

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('YouTube API key is required')
    }
    this.apiKey = apiKey
  }

  /**
   * YouTube URL에서 비디오 ID 추출 (쇼츠 URL 지원)
   */
  private extractVideoIdFromUrl(url: string): string | null {
    if (!url) return null

    const patterns = [
      // 쇼츠 URL을 최우선 처리
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:m\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      // 일반 URL들
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?m\.youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  /**
   * PT 형식의 duration을 초 단위로 변환
   */
  private parseDurationToSeconds(duration: string): number {
    if (!duration) return 0

    const pattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    const match = duration.match(pattern)

    if (!match) return 0

    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')

    return hours * 3600 + minutes * 60 + seconds
  }

  /**
   * PT 형식의 duration을 읽기 쉬운 형식으로 변환 (1:10:23 또는 0:53 형식)
   */
  private formatDuration(duration: string): string {
    if (!duration) return "0:00"

    const pattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    const match = duration.match(pattern)

    if (!match) return "0:00"

    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  /**
   * 업로드 기간에 따른 publishedAfter 날짜 계산
   */
  private getPublishedAfterDate(period: string): string | null {
    if (period === 'all') return null

    const now = new Date()
    const daysMap: Record<string, number> = {
      'day': 1,
      'week': 7,
      'month': 30,
      'month2': 60,
      'month3': 90,
      'month6': 180,
      'year': 365
    }

    const days = daysMap[period] || 60
    const publishedAfter = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return publishedAfter.toISOString()
  }

  /**
   * 언어별 지역 코드 매핑
   */
  private getRegionCode(language: string): string {
    const languageToRegion: Record<string, string> = {
      'ko': 'KR', 'en': 'US', 'ja': 'JP', 'zh': 'CN', 'es': 'ES',
      'fr': 'FR', 'de': 'DE', 'ru': 'RU', 'pt': 'BR', 'it': 'IT'
    }
    return languageToRegion[language] || 'KR'
  }

  /**
   * HTTP 요청 헬퍼
   */
  private async makeRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    const url = new URL(`${this.baseURL}/${endpoint}`)
    url.searchParams.set('key', this.apiKey)

    // null/undefined 값 제거
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, value.toString())
      }
    })

    console.log('YouTube API 요청:', {
      endpoint,
      url: url.toString(),
      params
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const reason = errorData?.error?.errors?.[0]?.reason || 'unknown'
      
      console.error('YouTube API 오류:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        reason,
        url: url.toString()
      })
      
      if (reason === 'quotaExceeded') {
        throw new YouTubeAPIError('API quota exceeded', 'QUOTA_EXCEEDED', response.status)
      } else if (reason === 'keyInvalid' || response.status === 403) {
        throw new YouTubeAPIError('Invalid API key', 'KEY_INVALID', response.status)
      } else {
        throw new YouTubeAPIError(
          errorData?.error?.message || 'API request failed',
          reason,
          response.status
        )
      }
    }

    const data = await response.json()
    console.log('YouTube API 응답:', {
      endpoint,
      itemsCount: data?.items?.length || 0,
      totalResults: data?.pageInfo?.totalResults || 0
    })

    return data
  }

  /**
   * 비디오 상세 정보 가져오기 (배치 처리)
   */
  private async getVideoDetails(videoIds: string[]): Promise<IYouTubeVideo[]> {
    if (videoIds.length === 0) return []

    const batchSize = 50
    const batches = []
    
    for (let i = 0; i < videoIds.length; i += batchSize) {
      batches.push(videoIds.slice(i, i + batchSize))
    }

    const allVideos: IYouTubeVideo[] = []

    for (const batch of batches) {
      const response = await this.makeRequest('videos', {
        part: 'snippet,statistics,contentDetails,status',
        id: batch.join(',')
      })

      for (const item of response.items || []) {
        const snippet = item.snippet as YouTubeVideoSnippet
        const statistics = item.statistics as YouTubeVideoStatistics
        const contentDetails = item.contentDetails as YouTubeVideoContentDetails
        const status = item.status as YouTubeVideoStatus

        const viewCount = parseInt(statistics.viewCount || '0')
        const likeCount = parseInt(statistics.likeCount || '0')
        const commentCount = parseInt(statistics.commentCount || '0')

        allVideos.push({
          videoId: item.id,
          title: snippet.title,
          description: snippet.description,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle,
          publishedAt: snippet.publishedAt,
          thumbnails: snippet.thumbnails,
          duration: this.formatDuration(contentDetails.duration),
          viewCount,
          likeCount,
          commentCount,
          subscriberCount: 0, // 채널 정보에서 별도로 가져옴
          tags: snippet.tags,
          categoryId: snippet.categoryId,
          defaultAudioLanguage: snippet.defaultAudioLanguage,
          license: status.license || 'youtube',
          engagementRate: likeCount / Math.max(viewCount, 1),
          reactionRate: commentCount / Math.max(viewCount, 1)
        })
      }
    }

    return allVideos
  }

  /**
   * 채널 구독자 수 가져오기 (배치 처리)
   */
  private async getChannelSubscribers(channelIds: string[]): Promise<Record<string, number>> {
    if (channelIds.length === 0) return {}

    const uniqueChannelIds = [...new Set(channelIds)]
    const batchSize = 50
    const batches = []
    
    for (let i = 0; i < uniqueChannelIds.length; i += batchSize) {
      batches.push(uniqueChannelIds.slice(i, i + batchSize))
    }

    const subscriberCounts: Record<string, number> = {}

    for (const batch of batches) {
      const response = await this.makeRequest('channels', {
        part: 'statistics',
        id: batch.join(',')
      })

      for (const item of response.items || []) {
        const statistics = item.statistics as YouTubeChannelStatistics
        subscriberCounts[item.id] = parseInt(statistics.subscriberCount || '0')
      }
    }

    return subscriberCounts
  }

  /**
   * 키워드 검색
   */
  async searchByKeyword(request: IYouTubeSearchRequest): Promise<IYouTubeSearchResponse> {
    const { query, resultsLimit, filters } = request

    // 필터가 있으면 더 많은 결과를 가져와서 필터링
    const hasFilters = filters.minViews || filters.maxSubscribers
    const fetchLimit = hasFilters ? Math.max(resultsLimit * 3, 150) : resultsLimit
    const maxPages = Math.ceil(fetchLimit / 50) // 최대 페이지 수 계산

    let allVideoIds: string[] = []
    let nextPageToken: string | undefined

    // 검색 파라미터 구성
    const searchParams: Record<string, any> = {
      part: 'snippet',
      type: 'video',
      q: query,
      order: 'relevance', // 일관성을 위해 relevance 사용
      maxResults: 50,
      relevanceLanguage: 'ko',
      regionCode: this.getRegionCode('ko')
    }

    if (filters.videoDuration && filters.videoDuration !== 'any') {
      searchParams.videoDuration = filters.videoDuration
    }

    if (filters.period) {
      const publishedAfter = this.getPublishedAfterDate(filters.period)
      if (publishedAfter) {
        searchParams.publishedAfter = publishedAfter
      }
    }

    // 페이지별로 검색 수행
    for (let page = 0; page < maxPages && allVideoIds.length < fetchLimit; page++) {
      if (nextPageToken) {
        searchParams.pageToken = nextPageToken
      }

      const response = await this.makeRequest('search', searchParams)
      
      const videoIds = response.items
        ?.filter((item: any) => item.id?.videoId)
        ?.map((item: any) => item.id.videoId) || []

      allVideoIds.push(...videoIds)
      nextPageToken = response.nextPageToken

      if (!nextPageToken) break
    }

    // 중복 제거 및 제한
    allVideoIds = [...new Set(allVideoIds)].slice(0, fetchLimit)

    // 비디오 상세 정보 가져오기
    let videos = await this.getVideoDetails(allVideoIds)

    // 채널 구독자 수 가져오기
    const channelIds = videos.map(v => v.channelId)
    const subscriberCounts = await this.getChannelSubscribers(channelIds)

    // 구독자 수 업데이트
    videos = videos.map(video => ({
      ...video,
      subscriberCount: subscriberCounts[video.channelId] || 0
    }))

    // 필터 적용
    if (filters.minViews) {
      videos = videos.filter(v => v.viewCount >= filters.minViews!)
    }

    if (filters.maxSubscribers) {
      videos = videos.filter(v => v.subscriberCount <= filters.maxSubscribers!)
    }

    // 정렬 (Python 앱에서처럼 여기서 처리)
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'viewCount':
          videos.sort((a, b) => b.viewCount - a.viewCount)
          break
        case 'engagement_rate':
          videos.sort((a, b) => b.engagementRate - a.engagementRate)
          break
        case 'reaction_rate':
          videos.sort((a, b) => b.reactionRate - a.reactionRate)
          break
        case 'date_desc':
          videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          break
        case 'date_asc':
          videos.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
          break
      }
    }

    // 최종 결과 수 제한
    const finalResults = videos.slice(0, resultsLimit)

    return {
      results: finalResults,
      totalCount: finalResults.length,
      searchType: 'keyword'
    }
  }

  /**
   * 유사 영상 검색 (Python 앱의 견고한 순차적 폴백 알고리즘 구현)
   */
  async searchSimilarVideos(request: IYouTubeSearchRequest): Promise<IYouTubeSearchResponse> {
    const { url, resultsLimit, filters } = request
    
    if (!url) {
      throw new Error('URL is required for similar video search')
    }

    const videoId = this.extractVideoIdFromUrl(url)
    if (!videoId) {
      throw new Error('Invalid YouTube URL')
    }

    // 원본 영상 메타데이터 확보
    const originalVideoResponse = await this.makeRequest('videos', {
      part: 'snippet,contentDetails,topicDetails',
      id: videoId
    })

    if (!originalVideoResponse.items?.length) {
      throw new Error('Original video not found')
    }

    const originalVideo = originalVideoResponse.items[0]
    const snippet = originalVideo.snippet as YouTubeVideoSnippet
    const topicDetails = originalVideo.topicDetails || {}

    // 검색 시점 고정
    const searchTime = new Date()
    const publishedAfter = filters.period ? this.getPublishedAfterDate(filters.period) : null

    // 언어 감지 및 지역 설정
    const defaultLanguage = snippet.defaultAudioLanguage || 'ko'
    const languageCode = defaultLanguage.substring(0, 2) || 'ko'
    const regionCode = this.getRegionCode(languageCode)

    // 동영상 길이 감지 및 필터 조정
    const durationMatch = originalVideo.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    let originalSeconds = 0
    if (durationMatch) {
      const h = parseInt(durationMatch[1] || '0')
      const m = parseInt(durationMatch[2] || '0')  
      const s = parseInt(durationMatch[3] || '0')
      originalSeconds = h * 3600 + m * 60 + s
    }

    const isOriginalShort = originalSeconds < 60
    let adjustedDuration = filters.videoDuration || 'any'

    if (adjustedDuration === 'any') {
      adjustedDuration = 'any'
    } else if (isOriginalShort && adjustedDuration === 'long') {
      adjustedDuration = 'any'
    } else if (!isOriginalShort && adjustedDuration === 'short') {
      adjustedDuration = 'any'
    }

    // main.py와 동일한 견고한 순차적 폴백 검색 전략 - 다양성 확보를 위한 조정
    const originalTags = snippet.tags || []
    const originalTitle = snippet.title || ''
    const originalDescription = snippet.description || ''
    
    // 해시태그 추출 (제목 + 설명에서)
    const hashtagMatches = [
      ...(originalTitle.match(/#(\w+)/g) || []),
      ...(originalDescription.match(/#(\w+)/g) || [])
    ]
    const originalHashtags = [...new Set(hashtagMatches.map(tag => tag.substring(1)))]
    
    const searchStrategies = [
      // 1차: 채널 우선 검색 (40개) - main.py와 동일하게 채널을 우선으로
      {
        channelId: snippet.channelId,
        maxResults: 40
      },
      // 2차: 제목 검색 (25개)
      {
        q: originalTitle,
        maxResults: 25
      },
      // 3차: 태그 검색 (20개) - 상위 3개 태그만 사용
      ...(originalTags.length > 0 ? [{
        q: originalTags.slice(0, 3).join(' '),
        maxResults: 20
      }] : []),
      // 4차: 해시태그 검색 (15개) - 상위 3개 해시태그만 사용
      ...(originalHashtags.length > 0 ? [{
        q: originalHashtags.slice(0, 3).map(tag => `#${tag}`).join(' '),
        maxResults: 15
      }] : []),
      // 5차: 주제/카테고리 검색 (15개)
      ...(topicDetails.relevantTopicIds?.length > 0 ? [{
        topicId: topicDetails.relevantTopicIds[0],
        maxResults: 15
      }] : snippet.categoryId ? [{
        videoCategoryId: snippet.categoryId,
        maxResults: 15
      }] : [])
    ]

    let candidateVideoIds = new Set<string>()

    // 공통 파라미터
    const commonParams: Record<string, any> = {
      part: 'snippet',
      type: 'video',
      order: 'relevance',
      relevanceLanguage: languageCode,
      regionCode: regionCode
    }

    if (adjustedDuration !== 'any') {
      commonParams.videoDuration = adjustedDuration
    }

    if (publishedAfter) {
      commonParams.publishedAfter = publishedAfter
    }

    // 순차적 폴백 검색 실행 - 더 많은 후보 수집
    const targetCandidates = Math.max(resultsLimit * 3, 100) // 최소 100개, 목표의 3배까지 후보 수집
    
    for (const strategy of searchStrategies) {
      if (candidateVideoIds.size >= targetCandidates) break

      try {
        const params = { ...commonParams, ...strategy }
        // null 값 제거
        Object.keys(params).forEach(key => {
          if ((params as any)[key] === null || (params as any)[key] === undefined) {
            delete (params as any)[key]
          }
        })

        const response = await this.makeRequest('search', params)
        
        for (const item of response.items || []) {
          if (item.id?.videoId && item.id.videoId !== videoId) { // 원본 영상 제외
            candidateVideoIds.add(item.id.videoId)
          }
        }
        
        // 각 전략에서 더 많은 결과 수집을 위해 페이지네이션 고려
        if (response.nextPageToken && candidateVideoIds.size < targetCandidates) {
          try {
            const nextPageParams = { ...params, pageToken: response.nextPageToken }
            const nextResponse = await this.makeRequest('search', nextPageParams)
            
            for (const item of nextResponse.items || []) {
              if (item.id?.videoId && item.id.videoId !== videoId) {
                candidateVideoIds.add(item.id.videoId)
              }
            }
          } catch (nextPageError) {
            console.warn('Next page search failed:', nextPageError)
          }
        }
      } catch (error) {
        console.warn('Search strategy failed:', strategy, error)
        continue
      }
    }

    if (candidateVideoIds.size === 0) {
      return {
        results: [],
        totalCount: 0,
        searchType: 'url',
        metadata: {
          originalVideoId: videoId,
          originalVideoTitle: snippet.title,
          languageDetected: languageCode
        }
      }
    }

    // 상세 정보 수집 - 더 많은 후보에서 선별
    const candidateList = Array.from(candidateVideoIds)
    let videos = await this.getVideoDetails(candidateList)

    // 채널 구독자 수 가져오기
    const channelIds = videos.map(v => v.channelId)
    const subscriberCounts = await this.getChannelSubscribers(channelIds)

    // 구독자 수 업데이트
    videos = videos.map(video => ({
      ...video,
      subscriberCount: subscriberCounts[video.channelId] || 0
    }))

    // main.py와 동일한 정교한 유사도 스코어링 시스템
    const titleKeywords = new Set(
      originalTitle.split(' ').filter(word => word.length > 2)
    )

    videos = videos.map(video => {
      let score = 0

      // 1. 채널 일치 보너스 (main.py와 동일)
      if (video.channelId === snippet.channelId) {
        score += 30
      }

      // 2. 태그 일치 보너스 (main.py와 동일)
      if (video.tags && originalTags.length > 0) {
        const commonTags = originalTags.filter(tag => video.tags?.includes(tag))
        score += commonTags.length * 15
      }

      // 3. 해시태그 일치 보너스 (main.py 추가 기능)
      if (originalHashtags.length > 0) {
        const videoDescription = video.description || ''
        const videoHashtags = [
          ...(video.title.match(/#(\w+)/g) || []),
          ...(videoDescription.match(/#(\w+)/g) || [])
        ].map(tag => tag.substring(1))
        
        const commonHashtags = originalHashtags.filter(tag => videoHashtags.includes(tag))
        score += commonHashtags.length * 8
      }

      // 4. 제목 키워드 일치 보너스 (main.py와 동일)
      const videoTitle = video.title.toLowerCase()
      for (const keyword of titleKeywords) {
        if (videoTitle.includes(keyword.toLowerCase())) {
          score += 5
        }
      }

      // 5. 다양성 보너스 - 다른 채널에게 가점 (main.py 개념 적용)
      if (video.channelId !== snippet.channelId) {
        score += 2 // 다른 채널에게 약간의 가점
      }

      return { ...video, similarityScore: score }
    })

    // main.py 스타일 채널 다양성 확보를 위한 정렬 - 결과 개수 최적화
    // 1차: 유사도 점수로 정렬
    videos.sort((a: any, b: any) => b.similarityScore - a.similarityScore)

    // 2차: 적응형 채널 다양성 확보 (결과 개수에 맞춰 유연하게 조정)
    const targetResults = Math.min(resultsLimit, videos.length)
    const channelCounts = new Map<string, number>()
    const diversifiedVideos: any[] = []
    const reservedVideos: any[] = [] // 다양성 제한에 걸린 영상들

    // 첫 번째 패스: 엄격한 다양성 적용
    for (const video of videos) {
      const channelCount = channelCounts.get(video.channelId) || 0

      // 원본 채널: 최대 5개, 다른 채널: 최대 3개 (기존보다 완화)
      const maxForChannel = video.channelId === snippet.channelId ? 5 : 3

      if (channelCount < maxForChannel) {
        diversifiedVideos.push(video)
        channelCounts.set(video.channelId, channelCount + 1)
      } else {
        reservedVideos.push(video)
      }

      // 목표 개수의 80%에 도달하면 첫 번째 패스 종료
      if (diversifiedVideos.length >= Math.floor(targetResults * 0.8)) {
        break
      }
    }

    // 두 번째 패스: 목표 개수에 못 미치면 제한 완화
    if (diversifiedVideos.length < targetResults) {
      const needed = targetResults - diversifiedVideos.length

      // 채널당 제한을 2개씩 더 늘려서 추가
      for (const video of reservedVideos) {
        if (diversifiedVideos.length >= targetResults) break

        const channelCount = channelCounts.get(video.channelId) || 0
        const relaxedMaxForChannel = video.channelId === snippet.channelId ? 8 : 5

        if (channelCount < relaxedMaxForChannel) {
          diversifiedVideos.push(video)
          channelCounts.set(video.channelId, channelCount + 1)
        }
      }
    }

    // 세 번째 패스: 여전히 부족하면 제한 없이 추가
    if (diversifiedVideos.length < targetResults) {
      const stillNeeded = targetResults - diversifiedVideos.length
      const remainingVideos = videos.filter(v => !diversifiedVideos.includes(v))
      diversifiedVideos.push(...remainingVideos.slice(0, stillNeeded))
    }

    videos = diversifiedVideos

    // 필터 적용
    if (filters.minViews) {
      videos = videos.filter(v => v.viewCount >= filters.minViews!)
    }

    if (filters.maxSubscribers) {
      videos = videos.filter(v => v.subscriberCount <= filters.maxSubscribers!)
    }

    // 최종 정렬 (유사도 정렬 후 사용자 정렬 적용)
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case 'viewCount':
          videos.sort((a, b) => b.viewCount - a.viewCount)
          break
        case 'engagement_rate':
          videos.sort((a, b) => b.engagementRate - a.engagementRate)
          break
        case 'reaction_rate':
          videos.sort((a, b) => b.reactionRate - a.reactionRate)
          break
        case 'date_desc':
          videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          break
        case 'date_asc':
          videos.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
          break
      }
    }

    return {
      results: videos.slice(0, resultsLimit),
      totalCount: videos.length,
      searchType: 'url',
      metadata: {
        originalVideoId: videoId,
        originalVideoTitle: snippet.title,
        languageDetected: languageCode
      }
    }
  }


  /**
   * 채널 기여도 분석 (주문형)
   */
  async analyzeChannelContribution(
    channelId: string,
    videoId: string,
    viewCount: number
  ): Promise<IYouTubeContributionData> {
    try {
      // 채널의 최근 업로드 영상들 가져오기 (최대 50개)
      const searchResponse = await this.makeRequest('search', {
        channelId,
        part: 'snippet',
        type: 'video',
        order: 'date',
        maxResults: 50
      })

      const recentVideoIds = searchResponse.items
        ?.map((item: any) => item.id?.videoId)
        ?.filter(Boolean) || []

      if (recentVideoIds.length === 0) {
        return {
          contributionScore: 0,
          channelAvgViews: 0,
          totalVideosAnalyzed: 0,
          error: 'No videos found'
        }
      }

      // 영상들의 조회수 가져오기
      const videosResponse = await this.makeRequest('videos', {
        part: 'statistics',
        id: recentVideoIds.join(',')
      })

      const viewCounts: number[] = []
      for (const item of videosResponse.items || []) {
        const statistics = item.statistics as YouTubeVideoStatistics
        const views = parseInt(statistics.viewCount || '0')
        viewCounts.push(views)
      }

      if (viewCounts.length === 0) {
        return {
          contributionScore: 0,
          channelAvgViews: 0,
          totalVideosAnalyzed: 0,
          error: 'No view data available'
        }
      }

      // 채널 평균 조회수 계산
      const channelAvgViews = Math.floor(viewCounts.reduce((sum, views) => sum + views, 0) / viewCounts.length)

      // 기여도 계산
      const contributionScore = channelAvgViews > 0 ? (viewCount / channelAvgViews) * 100 : 0

      return {
        contributionScore,
        channelAvgViews,
        totalVideosAnalyzed: viewCounts.length
      }
    } catch (error) {
      if (error instanceof YouTubeAPIError) {
        throw error
      }
      
      return {
        contributionScore: 0,
        channelAvgViews: 0,
        totalVideosAnalyzed: 0,
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}

export { YouTubeAPIError }
