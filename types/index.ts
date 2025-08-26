export interface IHashtagItem {
  url: string
  ownerUsername?: string
  likes?: number
  comments?: number
  caption?: string
  timestamp?: string | number
}

export interface IReelDetail {
  url: string
  views?: number
  thumbnailUrl?: string
  videoUrl?: string
  takenAt?: string | number
  duration?: number
  ownerUsername?: string
}

export interface IProfileSummary {
  username?: string
  followers?: number
  following?: number
  profilePicUrl?: string
}

export interface ISearchRow {
  url: string
  username?: string
  views?: number
  likes?: number | 'private'
  comments?: number
  followers?: number
  following?: number
  thumbnailUrl?: string
  videoUrl?: string
  caption?: string
  duration?: number
  takenDate?: string
}

export interface IThemeTypographyScale {
  size: string
  lineHeight: string
  letterSpacing: string
}

export interface IThemeDefinition {
  mode: string
  htmlAttr?: Record<string, string>
  breakpoints: { sm: string; md: string }
  colors: {
    text: {
      primary: string
      secondary: string
      tertiary: string
      quaternary: string
    }
    selection: { dim: string }
    accentsObserved: {
      green: string
      gold: string
      cyan: string
      orangeAlpha: string
      redAlpha: string
    }
  }
  typography: {
    fonts: { monospace: string }
    weights: { normal: string; medium: string }
    scale: {
      title2: IThemeTypographyScale
      title5: IThemeTypographyScale
      title6: IThemeTypographyScale
      textLarge: IThemeTypographyScale
      textRegular: IThemeTypographyScale
      textSmall: IThemeTypographyScale
    }
  }
  radii: { full: string }
  spacingObservedPx: number[]
  gradients: { textPrimaryToTransparent: string }
  icon: { color: string }
  misc: { bentoBorder: string }
}

export interface IThemePayload {
  source: string
  theme: IThemeDefinition
  variableNamesObserved: string[]
}

// YouTube API 관련 타입 정의
export interface IYouTubeVideo {
  videoId: string
  title: string
  description?: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnails: {
    default?: { url: string; width: number; height: number }
    medium?: { url: string; width: number; height: number }
    high?: { url: string; width: number; height: number }
    maxres?: { url: string; width: number; height: number }
  }
  duration: string
  viewCount: number
  likeCount: number
  commentCount: number
  subscriberCount: number
  tags?: string[]
  categoryId?: string
  defaultAudioLanguage?: string
  license?: 'youtube' | 'creativeCommon'
  engagementRate: number
  reactionRate: number
}

export interface IYouTubeSearchRequest {
  searchType: 'keyword' | 'url' // URL은 유사영상 검색
  query: string
  url?: string // 유사영상 검색용 URL
  apiKey: string // 사용자가 제공하는 YouTube Data API v3 키
  resultsLimit: 5 | 15 | 30 | 50 | 60 | 90 | 120
  filters: {
    period?: 'day' | 'week' | 'month' | 'month2' | 'month3' | 'month6' | 'year' | 'all'
    minViews?: number
    maxSubscribers?: number
    videoDuration?: 'any' | 'short' | 'long'
    sortBy?: 'viewCount' | 'engagement_rate' | 'reaction_rate' | 'date_desc' | 'date_asc'
  }
}

export interface IYouTubeSearchResponse {
  results: IYouTubeVideo[]
  totalCount: number
  searchType: 'keyword' | 'url'
  metadata?: {
    originalVideoId?: string
    originalVideoTitle?: string
    languageDetected?: string
  }
}

export interface IYouTubeContributionData {
  contributionScore: number
  channelAvgViews: number
  totalVideosAnalyzed: number
  error?: string
}

// 통합 플랫폼 검색 요청
export interface IUniversalSearchRequest {
  platform: 'instagram' | 'tiktok' | 'youtube'
  searchType: 'keyword' | 'url' | 'profile'
  keyword?: string
  url?: string
  resultsLimit: 5 | 30 | 60 | 90 | 120
  filters: {
    // 공통 필터
    period?: string
    minViews?: number
    
    // TikTok 전용 필터 (프로필 검색 시 업로드 기간만 사용)
    
    // Instagram 프로필 검색 전용 필터
    onlyPostsNewerThan?: string // ISO 날짜 문자열
    
    // YouTube 전용 필터
    maxSubscribers?: number
    videoDuration?: 'any' | 'short' | 'long'
    sortBy?: string
  }
}

// TikTok API 관련 타입 정의
export interface ITikTokVideo {
  videoId: string
  title: string
  description?: string
  username: string
  authorName: string
  publishedAt: string
  thumbnailUrl?: string
  videoUrl?: string
  duration: number
  viewCount: number
  likeCount: number
  commentCount: number
  shareCount: number
  followersCount: number
  hashtags?: string[]
  musicInfo?: {
    musicName: string
    musicAuthor: string
  }
}

export interface ITikTokSearchRequest {
  searchType: 'keyword' | 'hashtag' | 'url' | 'profile' // 프로필 검색 추가
  query: string
  resultsLimit: 5 | 30 | 60 | 90 | 120
  filters: {
    period?: 'day' | 'week' | 'month' | 'month2' | 'month3' | 'month6' | 'year' | 'all'
    minViews?: number
    sortBy?: 'trending' | 'recent' | 'most_liked'
  }
}

export interface ITikTokSearchResponse {
  results: ITikTokVideo[]
  totalCount: number
  searchType: 'keyword' | 'hashtag' | 'url' | 'profile'
  metadata?: {
    searchTerm: string
    totalFound: number
  }
}

export interface IUniversalSearchResponse {
  platform: 'instagram' | 'tiktok' | 'youtube'
  results: ISearchRow[] | IYouTubeVideo[] | ITikTokVideo[]
  totalCount: number
  creditsUsed: number
  searchType: 'keyword' | 'url' | 'hashtag'
  metadata?: any
}

// 카카오 인증서 API 관련 타입
export interface ICertificationRequest {
  id: number
  userId: string
  txId: string
  status: 'pending' | 'success' | 'failed' | 'expired'
  expiresAt: string
  createdAt: string
}

export interface IKakaoCertRequest {
  tx_id: string
  user_name: string
  phone_number?: string
  identity_req_type: 'RESIDENT_REGISTRATION_NUMBER'
  return_url: string
  is_same_name: boolean
}

export interface IKakaoCertResponse {
  tx_id: string
  app_link: string
  qr_code_url: string
}

export interface IKakaoCertResult {
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED'
  phone_number?: string
  name?: string
  birth?: string
  gender?: string
}

// 토스 간편인증 API 관련 타입 (공식 문서 기준)
export interface ITossCertRequest {
  // 토스 간편인증 요청에는 추가 파라미터 불필요
}

export interface ITossCertResponse {
  txId: string
  authUrl: string // 토스 표준창 URL
  success: boolean
}

export interface ITossCertVerifyRequest {
  txId: string
}

export interface ITossCertVerifyResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  personalData?: {
    ci: string
    name: string
    phoneNumber: string
  }
  error?: string
  message?: string
}

