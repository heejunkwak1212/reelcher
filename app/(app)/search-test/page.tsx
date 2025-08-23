'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState, Component, ErrorInfo, ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { VerificationModal } from '@/components/auth/VerificationModal'
import { useAuthStore } from '@/store/auth'

// 에러 바운더리 컴포넌트
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-4">페이지를 새로고침해주세요.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              새로고침
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Helpers first
function extractYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

function buildInitialPreviewSrc(row: any): string | null {
  if (row?.thumbnailUrl && typeof row.thumbnailUrl === 'string' && row.thumbnailUrl.trim() !== '') {
    return `/api/image-proxy?src=${encodeURIComponent(row.thumbnailUrl)}`
  }
  const g = buildGuessFromVideo(row)
  return g || null
}

function buildGuessFromVideo(row: any): string | null {
  const v: string | undefined = row?.videoUrl || row?.video_url
  if (v && typeof v === 'string') {
    try {
      const u = new URL(v)
      const guess = `${u.origin}${u.pathname.replace(/\.[a-z0-9]+$/i, '.jpg')}${u.search}`
      return `/api/image-proxy?src=${encodeURIComponent(guess)}`
    } catch {
      // URL 파싱 실패 시 null 반환
    }
  }
  return null
}

function PreviewContent({ row, videoDuration }: { row: any; videoDuration?: 'any' | 'short' | 'long' }) {
  const [src, setSrc] = useState<string | null>(() => buildInitialPreviewSrc(row))
  const [stage, setStage] = useState<'img' | 'guess' | 'video' | 'none'>(row?.thumbnailUrl ? 'img' : (row?.videoUrl || row?.video_url ? 'guess' : 'none'))
  const [retry, setRetry] = useState(0)
  const reelUrl: string = row?.url
  
  const tryNext = () => {
    // Retry same stage up to 2 times with cache-bust, then move on
    if (retry < 2 && (stage === 'img' || stage === 'guess')) {
      const bust = Date.now().toString(36)
      if (src) setSrc(`${src}${src.includes('?') ? '&' : '?'}b=${bust}`)
      setRetry((r) => r + 1)
      return
    }
    setRetry(0)
    if (stage === 'img') {
      const g = buildGuessFromVideo(row)
      if (g) { setSrc(g); setStage('guess'); return }
      setStage('video'); return
    }
    if (stage === 'guess') { setStage('video'); return }
    setStage('none')
  }
  
  // YouTube 영상 타입에 따른 미리보기 크기 결정
  const isYouTube = row?.url?.includes('youtube.com')
  
  let box = 'w-[280px] h-[420px]' // 기본 세로형
  
  if (isYouTube) {
    if (videoDuration === 'short') {
      // 쇼츠만 선택: 세로형 유지
      box = 'w-[280px] h-[420px]'
    } else if (videoDuration === 'long') {
      // 롱폼만 선택: 더 유연한 크기 (검은색 여백 최소화)
      box = 'max-w-[420px] max-h-[280px]'
    } else {
      // 전체 선택: 유연한 크기 사용
      box = 'max-w-[420px] max-h-[420px]'
    }
  }
  
  if (stage === 'video') {
    const v: string | undefined = row?.videoUrl || row?.video_url
    if (v) {
      return <video className={`rounded object-cover ${box}`} src={v} muted loop playsInline preload="metadata" />
    }
    setStage('none')
  }
  
  if (stage === 'none') {
    return <div className={`grid place-items-center bg-neutral-100 text-neutral-400 rounded ${box}`}>미리보기를 불러올 수 없습니다</div>
  }
  
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <div className="flex flex-col gap-3 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? (
        <img 
          src={src} 
          alt="thumb" 
          className="rounded object-contain" 
          onError={tryNext} 
          style={{ 
            maxWidth: '420px', 
            maxHeight: '420px',
            display: 'block',
            backgroundColor: 'transparent'
          }} 
        />
      ) : (
        <div className="grid place-items-center bg-neutral-100 text-neutral-400 rounded w-[280px] h-[200px]">이미지 없음</div>
      )}
      {typeof reelUrl === 'string' && reelUrl.startsWith('http') && (
        <a 
          href={reelUrl} 
          target="_blank" 
          rel="noreferrer" 
          className="w-full text-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium text-sm shadow-sm"
        >
          영상 바로가기
        </a>
      )}
    </div>
  )
}

// Small inline thumbnail that always shows; hover opens larger preview; click opens modal.
function InlineThumb({ row, videoDuration }: { row: any; videoDuration?: 'any' | 'short' | 'long' }) {
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(buildInitialPreviewSrc(row))
  const [imageError, setImageError] = useState(false)
  
  // 이미지 로드 오류 시 대체 이미지 처리
  const handleImageError = () => {
    setImageError(true)
    // YouTube 영상의 경우 다른 썸네일 URL 시도
    if (row?.url?.includes('youtube.com')) {
      const videoId = extractYouTubeVideoId(row.url)
      if (videoId && imageSrc?.includes('maxresdefault')) {
        // maxresdefault에서 hqdefault로 다운그레이드
        setImageSrc(`/api/image-proxy?src=${encodeURIComponent(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`)}`)
        setImageError(false)
        return
      } else if (videoId && imageSrc?.includes('hqdefault')) {
        // hqdefault에서 mqdefault로 다운그레이드
        setImageSrc(`/api/image-proxy?src=${encodeURIComponent(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`)}`)
        setImageError(false)
        return
      }
    }
  }
  
  const src = imageError ? null : imageSrc
  
  // 플랫폼과 영상 유형에 따른 썸네일 크기 및 스타일 분기
  const isYouTube = row?.url?.includes('youtube.com')
  const isShorts = row?.isShorts === true
  
  let thumbnailStyle = {}
  let box = ''
  
  if (isYouTube) {
    if (videoDuration === 'short') {
      // 쇼츠만 선택: 세로형 비율 유지
      box = 'w-16 h-24'
      thumbnailStyle = { width: 64, height: 96 }
    } else if (videoDuration === 'long') {
      // 롱폼만 선택: 16:9 비율
      box = 'w-20 h-12'
      thumbnailStyle = { width: 80, height: 48 }
    } else {
      // 전체 선택: 깔끔한 썸네일 표시 (검은 영역 제거)
      box = 'w-20 h-12'
      thumbnailStyle = { width: 80, height: 48 }
    }
  } else {
    // TikTok/Instagram은 기본 세로형
    box = 'w-16 h-24'
    thumbnailStyle = { width: 64, height: 96 }
  }
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<number | null>(null)
  const scheduleClose = () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); closeTimer.current = window.setTimeout(() => setHover(false), 250) }
  const cancelClose = () => { if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null } }
  useEffect(() => { return () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) } }, [])
  const previewId: string = row?.url || Math.random().toString(36)
  const claimGlobal = () => {
    try {
      const g = window as any
      if (g && g.__hoverPreviewActive && g.__hoverPreviewActive !== previewId) {
        if (typeof g.__hoverPreviewClose === 'function') g.__hoverPreviewClose()
      }
      if (g) {
        g.__hoverPreviewActive = previewId
        g.__hoverPreviewClose = () => {
          if ((window as any)?.__hoverPreviewActive === previewId) setHover(false)
        }
      }
    } catch (error) {
      console.warn('Failed to claim global hover state:', error)
    }
  }
  useEffect(() => {
    if (!hover) {
      const g = window as any
      if (g.__hoverPreviewActive === previewId) {
        g.__hoverPreviewActive = null
        g.__hoverPreviewClose = undefined
      }
    }
  }, [hover])
  useEffect(() => {
    if (!hover) return
    const compute = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const PREVIEW_H = 420
      const margin = 6
      const left = rect.right + margin
      let top = rect.top + rect.height / 2 - PREVIEW_H / 2
      const maxTop = window.innerHeight - PREVIEW_H - margin
      if (top < margin) top = margin
      if (top > maxTop) top = maxTop
      setPos({ left: Math.round(left), top: Math.round(top) })
    }
    compute()
    window.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [hover])
  return (
    <div ref={containerRef} className="relative flex justify-center" onMouseEnter={()=>{cancelClose(); claimGlobal(); setHover(true)}} onMouseLeave={scheduleClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? (
        <div className={`rounded overflow-hidden cursor-pointer ${box}`} style={thumbnailStyle} onClick={()=>setOpen(true)}>
          {/* 모든 썸네일을 깔끔하게 표시 (검은 영역 제거) */}
          <img src={src} alt="thumb" className="w-full h-full object-cover" onError={handleImageError} />
        </div>
      ) : (
        <div className={`rounded ${box} bg-neutral-100 flex items-center justify-center text-neutral-400 text-xs cursor-pointer`} style={thumbnailStyle} onClick={()=>setOpen(true)}>
          thumb
        </div>
      )}
      {hover && pos && (
        <div ref={previewRef} className="z-50" style={{ position: 'fixed', left: pos.left, top: pos.top }} onMouseEnter={cancelClose} onMouseLeave={()=>setHover(false)}>
          <div className="bg-white border border-gray-200 shadow rounded p-1">
            <PreviewContent row={row} videoDuration={videoDuration} />
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-[420px] p-3" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-sm">미리보기</h2>
              <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <PreviewContent row={row} videoDuration={videoDuration} />
          </div>
        </div>
      )}
    </div>
  )
}

// (imports moved to top with 'use client')

type SearchRow = {
  url: string
  username?: string
  views?: number
  likes?: number | 'private'
  comments?: number
  followers?: number
  following?: number
  thumbnailUrl?: string
  caption?: string
  duration?: number
  durationDisplay?: string // YouTube 1:10:23 형식 표시용
  takenDate?: string
  isShorts?: boolean // YouTube 쇼츠 여부
  videoUrl?: string // TikTok/Instagram 다운로드용 비디오 URL
  channelId?: string // YouTube 채널 ID
  channelUrl?: string // YouTube 채널 URL
}

function SearchTestPageContent() {
  const [platform, setPlatform] = useState<'instagram' | 'youtube' | 'tiktok'>('instagram')
  const [searchType, setSearchType] = useState<'keyword' | 'url' | 'profile'>('keyword')
  const [expandedTitleRow, setExpandedTitleRow] = useState<string | null>(null) // 확장된 제목 행 관리
  
  // 본인인증 관련 상태 (비활성화됨 - 하드코딩으로 대체)
  const isVerified = true // 본인인증 비활성화로 인해 항상 true로 설정

  // 전역 오류 처리
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason)
      event.preventDefault() // 기본 오류 표시 방지
    }

    const handleError = (event: ErrorEvent) => {
      // null 에러는 무시 (의미없는 에러)
      if (event.error === null || event.error === undefined) {
        console.log('Global error: null/undefined - 무시됨')
        event.preventDefault()
        return
      }
      console.error('Global error:', event.error)
      event.preventDefault() // 기본 오류 표시 방지
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection)
      window.addEventListener('error', handleError)

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection)
        window.removeEventListener('error', handleError)
      }
    }
  }, [])
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 30
  
  // YouTube 검색 타입별 독립적인 키워드 상태
  const [youtubeKeywordSearch, setYoutubeKeywordSearch] = useState<string[]>([''])
  const [youtubeUrlSearch, setYoutubeUrlSearch] = useState<string[]>([''])
  
  // Instagram 검색 타입별 독립적인 키워드 상태
  const [instagramKeywordSearch, setInstagramKeywordSearch] = useState<string[]>(['재테크'])
  const [instagramProfileSearch, setInstagramProfileSearch] = useState<string[]>([''])
  
  // TikTok 검색 타입별 독립적인 키워드 상태
  const [tiktokKeywordSearch, setTiktokKeywordSearch] = useState<string[]>([''])
  const [tiktokUrlSearch, setTiktokUrlSearch] = useState<string[]>([''])
  const [tiktokProfileSearch, setTiktokProfileSearch] = useState<string[]>([''])
  
  // 현재 플랫폼의 키워드 getter/setter
  const keywords = useMemo(() => {
    switch (platform) {
      case 'instagram': 
        switch (searchType) {
          case 'keyword': return instagramKeywordSearch
          case 'profile': return instagramProfileSearch
          default: return instagramKeywordSearch
        }
      case 'youtube': 
        switch (searchType) {
          case 'keyword': return youtubeKeywordSearch
          case 'url': return youtubeUrlSearch
          default: return youtubeKeywordSearch
        }
      case 'tiktok': 
        switch (searchType) {
          case 'keyword': return tiktokKeywordSearch
          case 'url': return tiktokUrlSearch
          case 'profile': return tiktokProfileSearch
          default: return tiktokKeywordSearch
        }
      default: return instagramKeywordSearch
    }
  }, [platform, searchType, instagramKeywordSearch, instagramProfileSearch, youtubeKeywordSearch, youtubeUrlSearch, tiktokKeywordSearch, tiktokUrlSearch, tiktokProfileSearch])
  
  const setKeywords = useCallback((newKeywords: string[] | ((prev: string[]) => string[])) => {
    const updatedKeywords = typeof newKeywords === 'function' ? newKeywords(keywords) : newKeywords
    switch (platform) {
      case 'instagram': 
        switch (searchType) {
          case 'keyword': setInstagramKeywordSearch(updatedKeywords); break
          case 'profile': setInstagramProfileSearch(updatedKeywords); break
          default: setInstagramKeywordSearch(updatedKeywords); break
        }
        break
      case 'youtube': 
        switch (searchType) {
          case 'keyword': setYoutubeKeywordSearch(updatedKeywords); break
          case 'url': setYoutubeUrlSearch(updatedKeywords); break
          default: setYoutubeKeywordSearch(updatedKeywords); break
        }
        break
      case 'tiktok': 
        switch (searchType) {
          case 'keyword': setTiktokKeywordSearch(updatedKeywords); break
          case 'url': setTiktokUrlSearch(updatedKeywords); break
          case 'profile': setTiktokProfileSearch(updatedKeywords); break
          default: setTiktokKeywordSearch(updatedKeywords); break
        }
        break
    }
  }, [platform, searchType, keywords])
  const [user, setUser] = useState<any>(null)
  // period UI removed for MVP
  const [limit, setLimit] = useState<'5' | '15' | '30' | '50' | '60' | '90' | '120'>('30')
  // YouTube 전용 필터
  const [maxSubscribers, setMaxSubscribers] = useState<number>(0)
  const [videoDuration, setVideoDuration] = useState<'any' | 'short' | 'long'>('any')
  const [minViews, setMinViews] = useState<number>(0)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'month2' | 'month3' | 'month6' | 'year' | 'all'>('month2')
  
  // YouTube API 키 관리 (Supabase 기반)
  const [youtubeApiKey, setYoutubeApiKey] = useState<string>('')
  const [savedApiKeysOpen, setSavedApiKeysOpen] = useState(false)
  const [savedApiKeys, setSavedApiKeys] = useState<Array<{
    id: string
    platform: string
    api_key: string
    key_name?: string
    is_active: boolean
    created_at: string
  }>>([])
  const [newApiKey, setNewApiKey] = useState<string>('')
  const [newApiKeyName, setNewApiKeyName] = useState<string>('')
  
  // TikTok 전용 필터
  const [minLikes, setMinLikes] = useState<number>(0)
  
  // Instagram 프로필 검색 전용 필터
  const [instagramPeriod, setInstagramPeriod] = useState<'7' | '15' | '30' | '90' | '180' | '365' | 'custom'>('30')
  const [instagramCustomPeriod, setInstagramCustomPeriod] = useState<number>(7)
  const [instagramCustomUnit, setInstagramCustomUnit] = useState<'days' | 'months'>('days')
  
  // 플랫폼별 키워드 추천 상태
  const [selectedInstagramCategory, setSelectedInstagramCategory] = useState<string | null>(null)
  const [selectedTiktokCategory, setSelectedTiktokCategory] = useState<string | null>(null)
  const [selectedYoutubeCategory, setSelectedYoutubeCategory] = useState<string | null>(null)
  
  // 키워드 추천 섹션 접기/펼치기 상태
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false)
  
  // 협찬 필터 상태 (인스타그램 프로필 검색 전용)
  const [showSponsoredOnly, setShowSponsoredOnly] = useState(false)
  
  // Instagram 키워드 카테고리 및 추천 키워드
  const instagramKeywordCategories = {
    '패션': ['OOTD', '데일리룩', '코디', '스타일링', '빈티지', '미니멀', '하울', '쇼핑', '브랜드', '액세서리'],
    '뷰티': ['메이크업', '스킨케어', '네일아트', '헤어스타일', '뷰티팁', '화장품리뷰', '셀프케어', '뷰티룩', '컬러', '트렌드'],
    '라이프스타일': ['일상', '브이로그', '모닝루틴', '홈카페', '인테리어', '플래너', '취미', '미니멀라이프', '소확행', '힐링'],
    '음식': ['맛집', '카페', '홈쿡', '디저트', '레시피', '베이킹', '다이어트식단', '건강식', '음식스타그램', '커피'],
    '여행': ['국내여행', '해외여행', '여행스타그램', '숙소', '맛집투어', '경치', '호캉스', '캠핑', '백패킹', '로드트립'],
    '운동': ['홈트', '필라테스', '요가', '헬스', '다이어트', '런닝', '운동루틴', '바디프로필', '운동복', '피트니스'],
    '반려동물': ['강아지', '고양이', '펫스타그램', '반려동물용품', '산책', '훈련', '간식', '펫카페', '펫샵', '동물병원'],
    '취미': ['그림', '사진', '독서', '음악', '춤', '요리', '원예', 'DIY', '공예', '컬렉팅'],
    '직장': ['오피스룩', '회사생활', '자기계발', '스터디', '업무', '네트워킹', '커리어', '면접', '퇴근', '워라밸'],
    '학생': ['대학생', '스터디룩', '캠퍼스', '시험', '과제', '동아리', '알바', '졸업', '취업', '학교생활'],
    '육아': ['신생아', '육아일상', '이유식', '놀이', '교육', '육아용품', '아기옷', '육아템', '발달', '육아스타그램'],
    '재테크': ['주식', '부동산', '투자', '경제', '금융', '적금', '펀드', '코인', '소비', '절약'],
    '문화': ['전시', '공연', '영화', '드라마', '책', '뮤지컬', '콘서트', '페스티벌', '미술관', '박물관'],
    '계절': ['봄', '여름', '가을', '겨울', '크리스마스', '신정', '추석', '연말', '휴가', '시즌'],
    '감성': ['감성', '노스탤지어', '빈티지', '로맨틱', '우울', '힐링', '위로', '추억', '그리움', '설렘']
  }

  // TikTok 키워드 카테고리 및 추천 키워드
  const tiktokKeywordCategories = {
    '댄스': ['춤', '안무', '댄스챌린지', 'K-pop댄스', '버닝썬', '커버댄스', '프리스타일', '힙합', '발레', '라틴댄스'],
    '음악': ['노래', '커버', '라이브', '악기연주', '작곡', '랩', '보컬', '밴드', '음악추천', 'OST'],
    '코미디': ['개그', '웃긴영상', '몰카', '패러디', '성대모사', '짤', '밈', '리액션', '웃음', '유머'],
    '일상': ['브이로그', '데일리', '루틴', '하루', '생활', '취미', '일상템', '소소한', '리얼', '진짜'],
    '먹방': ['음식', '맛집', '레시피', '쿠킹', '먹는방송', '디저트', '간식', '홈쿡', '요리', '카페'],
    '패션뷰티': ['OOTD', '메이크업', '스타일링', '헤어', '네일', '쇼핑', '하울', '코디', '룩북', '뷰티팁'],
    '챌린지': ['도전', '챌린지', '트렌드', '유행', '따라하기', '연습', '시도', '테스트', '실험', '체험'],
    '동물': ['강아지', '고양이', '펫', '동물', '귀여운', '반려동물', '동물영상', '펫팸', '동물소리', '애완동물'],
    '운동': ['홈트', '다이어트', '운동', '헬스', '요가', '필라테스', '스트레칭', '피트니스', '바디', '건강'],
    '게임': ['게임', '모바일게임', '롤', '배그', '게임플레이', '게임리뷰', '스트리밍', 'e스포츠', '게이머', '플레이'],
    '학습': ['공부', '영어', '학습', '교육', '스터디', '시험', '자격증', '팁', '노하우', '꿀팁'],
    '여행': ['여행', '관광', '맛집투어', '여행지', '경치', '여행팁', '숙소', '액티비티', '체험', '투어'],
    'DIY': ['만들기', 'DIY', '수공예', '인테리어', '꾸미기', '아이디어', '창작', '리폼', '데코', '핸드메이드'],
    '라이프': ['힐링', '감성', '위로', '일상', '소확행', '휴식', '여유', '평화', '미니멀', '심플'],
    '트렌드': ['유행', '인기', '핫한', '새로운', '최신', '화제', '이슈', '바이럴', '인싸', '힙한']
  }

  // YouTube 키워드 카테고리 및 추천 키워드
  const youtubeKeywordCategories = {
    '엔터테인먼트': ['예능', '코미디', '리액션', '챌린지', '밈', '브이로그', '웃긴영상', '개그', '패러디', '소통'],
    '음악': ['k-pop', '힙합', '발라드', '댄스', '커버', '라이브', '가사', '뮤직비디오', '피아노', '기타'],
    '게임': ['롤', '배그', '마크', '피파', '포트나이트', '스타', '오버워치', '모바일게임', '스팀', '인디게임'],
    '요리': ['레시피', '간단요리', '집밥', '베이킹', '디저트', '도시락', '한식', '양식', '일식', '중식'],
    '뷰티': ['메이크업', '스킨케어', '헤어', '네일', '향수', '브랜드리뷰', '룩북', '화장품', '뷰티루틴', '셀프'],
    '패션': ['코디', '룩북', '하울', '브랜드', '스타일링', '쇼핑', '옷장정리', '액세서리', '신발', '가방'],
    '여행': ['국내여행', '해외여행', '맛집', '호텔', '항공', '배낭여행', '가족여행', '커플여행', '혼행', '캠핑'],
    '운동': ['홈트', '헬스', '다이어트', '요가', '필라테스', '러닝', '수영', '등산', '사이클', '복근운동'],
    '교육': ['영어', '수학', '과학', '역사', '강의', '공부법', '시험', '독서', '자격증', '입시'],
    '기술': ['프로그래밍', 'AI', '코딩', '웹개발', '앱개발', '데이터', '블록체인', 'IT뉴스', '리뷰', '튜토리얼'],
    '재테크': ['주식', '부동산', '코인', '투자', '경제', '펀드', '적금', '보험', '세금', '연금'],
    '육아': ['신생아', '유아', '육아용품', '이유식', '교육', '놀이', '발달', '건강', '임신', '출산'],
    '반려동물': ['강아지', '고양이', '훈련', '건강', '용품', '간식', '놀이', '병원', '입양', '케어'],
    '취미': ['독서', '그림', '사진', '영화', '드라마', '애니', '수집', '만들기', '원예', '낚시'],
    '자기계발': ['자기관리', '시간관리', '독서', '성공', '동기부여', '목표설정', '습관', '마인드셋', '스피치', '리더십']
  }
  
  // YouTube에서 searchType 변경 시 limit 조정
  useEffect(() => {
    if (platform === 'youtube') {
      if (searchType === 'keyword') {
        // 키워드 검색으로 변경 시 기본값 30으로 설정
        if (limit === '15' || limit === '50') {
          setLimit('30')
        }
      } else {
        // URL 검색으로 변경 시 기본값 15로 설정
        if (limit === '60' || limit === '90' || limit === '120') {
          setLimit('15')
        }
      }
    }
  }, [platform, searchType, limit])
  


  // 플랫폼 전환 경고 기능
  const handlePlatformSwitch = (newPlatform: 'instagram' | 'youtube' | 'tiktok') => {
    // 현재 검색 결과가 있고, 다른 플랫폼으로 전환하려는 경우
    if (baseItems && baseItems.length > 0 && newPlatform !== platform) {
      // 경고 팝업 표시 (7일 옵트아웃 기능 제거)
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
      modal.innerHTML = `
        <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
          <div class="text-base font-semibold mb-3">검색 결과가 초기화돼요</div>
          <div class="text-sm text-neutral-700 mb-4">다른 플랫폼으로 전환하면 현재 검색 결과가 사라집니다.</div>
          <div class="flex items-center justify-end gap-3">
            <button id="cancel" class="px-3 py-2 border rounded text-sm">취소</button>
            <button id="confirm" class="px-3 py-2 border rounded bg-black text-white text-sm">확인</button>
          </div>
        </div>`
      
      document.body.appendChild(modal)
      
      const cleanup = () => modal.remove()
      
      modal.querySelector('#cancel')?.addEventListener('click', cleanup)
      modal.querySelector('#confirm')?.addEventListener('click', () => {
        setPlatform(newPlatform)
        setBaseItems(null) // 검색 결과 초기화
        // 플랫폼별 기본 limit 설정
        if (newPlatform === 'youtube') {
          setLimit('30') // YouTube는 키워드 검색 기본값
        } else {
          setLimit('30')
        }
        cleanup()
      })
    } else {
      // 검색 결과가 없거나 같은 플랫폼이면 바로 전환
      setPlatform(newPlatform)
      // 플랫폼별 기본 limit 설정
      if (newPlatform === 'youtube') {
        setLimit('30') // YouTube는 키워드 검색 기본값
      } else {
        setLimit('30')
      }
    }
  }

  // Load saved API keys from Supabase on mount
  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/user-api-keys?platform=youtube')
      if (response.ok) {
        const { apiKeys } = await response.json()
        setSavedApiKeys(apiKeys || [])
        
        // 활성화된 키가 있으면 자동으로 설정
        const activeKey = apiKeys?.find((key: any) => key.is_active)
        if (activeKey) {
          setYoutubeApiKey(activeKey.api_key)
        }
      }
    } catch (error) {
      console.error('API 키 로딩 오류:', error)
    }
  }

  // API 키 관련 유틸리티 함수들 (Supabase 기반)
  const addNewApiKey = async () => {
    if (!newApiKey.trim()) {
      alert('API 키를 입력해주세요.')
      return
    }
    
    const trimmedKey = newApiKey.trim()
    if (savedApiKeys.some(key => key.api_key === trimmedKey)) {
      alert('이미 저장된 API 키입니다.')
      return
    }
    
    try {
      const response = await fetch('/api/user-api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'youtube',
          apiKey: trimmedKey,
          keyName: newApiKeyName.trim() || undefined
        })
      })
      
      const result = await response.json()
      if (response.ok) {
        setNewApiKey('')
        setNewApiKeyName('')
        alert(result.message)
        await loadApiKeys() // 목록 새로고침
        setYoutubeApiKey(trimmedKey) // 새 키로 자동 설정
      } else {
        alert(result.error || 'API 키 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('API 키 저장 오류:', error)
      alert('API 키 저장 중 오류가 발생했습니다.')
    }
  }

  const deleteApiKey = async (keyId: string) => {
    try {
      const response = await fetch('/api/user-api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: keyId })
      })
      
      const result = await response.json()
      if (response.ok) {
        alert(result.message)
        await loadApiKeys() // 목록 새로고침
        
        // 삭제된 키가 현재 사용중이었다면 초기화
        const deletedKey = savedApiKeys.find(key => key.id === keyId)
        if (deletedKey && youtubeApiKey === deletedKey.api_key) {
          setYoutubeApiKey('')
        }
      } else {
        alert(result.error || 'API 키 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('API 키 삭제 오류:', error)
      alert('API 키 삭제 중 오류가 발생했습니다.')
    }
  }

  const useApiKey = async (keyData: { id: string; api_key: string }) => {
    try {
      // 해당 키를 활성화
      const response = await fetch('/api/user-api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: keyData.id,
          isActive: true 
        })
      })
      
      if (response.ok) {
        setYoutubeApiKey(keyData.api_key)
        setSavedApiKeysOpen(false)
        await loadApiKeys() // 활성 상태 업데이트
      }
    } catch (error) {
      console.error('API 키 활성화 오류:', error)
      // 오류가 발생해도 UI에서는 일단 사용
      setYoutubeApiKey(keyData.api_key)
      setSavedApiKeysOpen(false)
    }
  }

  // Load user data immediately from Supabase client + API
  useEffect(() => {
    async function loadUserData() {
      try {
        // First: Check Supabase client session (instant)
        const { supabaseBrowser } = await import('@/lib/supabase/client')
        const supabase = supabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          // Quick set from session data
          setUser({
            id: session.user.id,
            email: session.user.email,
            ...session.user.user_metadata
          })
        }

        // Second: Fetch full user data from API (background update)
        const userRes = await fetch('/api/me?scope=search-stats', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          console.log('✅ 초기 로딩 - 사용자 데이터:', userData)
          setUser(userData)
          setMyCredits(userData.credits || 0)
          setTodayCount(userData.today || 0)  // todaySearches → today 수정
          setMonthCount(userData.month || 0)  // monthSearches → month 수정
          setMonthCredits(userData.monthCredits || 0)
          setRecentKeywords(userData.recent || [])  // recentKeywords → recent 수정
          setIsAdmin(userData.role === 'admin')
          setPlan(userData.plan || 'free')
        } else if (!session?.user) {
          setUser(null)
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
      }
    }
    loadUserData()
  }, [])
  const [myCredits, setMyCredits] = useState<number | null>(null)
  const [todayCount, setTodayCount] = useState<number>(0)
  const [monthCount, setMonthCount] = useState<number>(0)
  const [recentKeywords, setRecentKeywords] = useState<string[]>([])
  const [monthCredits, setMonthCredits] = useState<number>(0)
  const [keywordPage, setKeywordPage] = useState(0) // 최근 키워드 페이지네이션
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [plan, setPlan] = useState<'free' | 'starter' | 'pro' | 'business' | string>('free')
  const prevLimitRef = useRef<typeof limit>(limit)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [baseItems, setBaseItems] = useState<SearchRow[] | null>(null)
  const [sort, setSort] = useState<'views' | 'latest' | 'oldest'>('views')
  const [filters, setFilters] = useState<{ views?: [number, number]; followers?: [number, number]; date?: [string, string] }>({})
  const [debug, setDebug] = useState<any>(null)
  const [raw, setRaw] = useState<string>('')
  const [checkAllToggle, setCheckAllToggle] = useState<number>(0)
  
  // 페이지네이션 계산
  const totalPages = baseItems ? Math.ceil(baseItems.length / itemsPerPage) : 0
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const [templateOpen, setTemplateOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  // Turnstile (env-gated)
  const [turnstileToken, setTurnstileToken] = useState<string>('')
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const [, forceTick] = useState(0)
  // progress overlay (search/export/download/subtitle)
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressTitle, setProgressTitle] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const progressTimer = useRef<number | null>(null)
  const openProgress = (title: string, initial = 5) => {
    setProgressTitle(title)
    setProgressPercent(initial)
    setProgressOpen(true)
  }
  const tickProgress = (max = 92, step = 2, ms = 250) => {
    if (progressTimer.current && typeof window !== 'undefined') window.clearInterval(progressTimer.current)
    progressTimer.current = (typeof window !== 'undefined' ? window.setInterval(() => {
      setProgressPercent((p) => (p < max ? p + step : p))
    }, ms) : null) as any
  }
  const finishProgress = (delay = 600) => {
    if (progressTimer.current && typeof window !== 'undefined') { window.clearInterval(progressTimer.current as any); progressTimer.current = null }
    setProgressPercent(100)
    if (typeof window !== 'undefined') window.setTimeout(() => setProgressOpen(false), delay)
  }

  // Stats reload helpers for immediate UI refresh after searches
  const loadStats = async () => {
    try {
      console.log('Loading stats for platform:', platform)
      const cacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
      
      const [statsRes, keywordsRes] = await Promise.all([
        fetch('/api/me/stats', { cache: 'no-store', headers: cacheHeaders }),
        fetch('/api/me/recent-keywords', { cache: 'no-store', headers: cacheHeaders })
      ])
      
      // Process stats
      if (statsRes.ok) {
        const stats = await statsRes.json()
        setTodayCount(Number(stats.today_searches || 0))
        setMonthCount(Number(stats.month_searches || 0)) // 이번달 검색수 추가
        setMonthCredits(Number(stats.month_credits || 0)) // month_credits는 크레딧 사용량
        console.log('✅ 통계 데이터 로드 완료:', {
          today: stats.today_searches,
          month: stats.month_searches,
          monthCredits: stats.month_credits
        })
      } else {
        console.warn('⚠️ loadStats 실패, 기본값 설정')
        setTodayCount(0)
        setMonthCount(0)
        setMonthCredits(0)
      }
      
      // Process keywords
      if (keywordsRes.ok) {
        const keywords = await keywordsRes.json()
        if (Array.isArray(keywords.recent)) {
          const keywordStrings = keywords.recent.map((k: any) => k.keyword).filter(Boolean)
          setRecentKeywords(keywordStrings)
          console.log('✅ 최근 키워드 로드 완료:', keywordStrings.length)
        }
      } else {
        console.warn('⚠️ loadStats에서 키워드 로드 실패')
        // 실패 시 현재 상태 유지 (빈 배열로 리셋하지 않음)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }
  const loadCredits = async () => {
    try {
      const res = await fetch('/api/me', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      if (res.ok) {
        const j = await res.json()
        setMyCredits(typeof j?.credits === 'number' ? j.credits : null)
        setIsAdmin(j?.role === 'admin')
        if (j?.plan) setPlan(j.plan)
        console.log('크레딧 정보 업데이트 완료:', j.credits)
      }
    } catch (error) {
      console.error('Error loading credits:', error)
    }
  }
  
  // Combined reload for faster refreshes
  const reloadUserData = async () => {
    try {
      const cacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
      
      const [userRes, statsRes] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', headers: cacheHeaders }),
        fetch('/api/me?scope=search-stats', { cache: 'no-store', headers: cacheHeaders })
      ])
      
      if (userRes.ok) {
        const j = await userRes.json()
        setMyCredits(typeof j?.credits === 'number' ? j.credits : null)
        setIsAdmin(j?.role === 'admin')
        if (j?.plan) setPlan(j.plan)
      }
      
      if (statsRes.ok) {
        const stats = await statsRes.json()
        setTodayCount(Number(stats.today || 0))
        setMonthCount(Number(stats.month || 0))
        setMonthCredits(Number(stats.monthCredits || 0))
        if (Array.isArray(stats.recent)) setRecentKeywords(stats.recent as string[])
        console.log('통합 데이터 로드 완료:', {
          today: stats.today,
          month: stats.month,
          monthCredits: stats.monthCredits,
          recent: stats.recent?.length || 0
        })
      }
    } catch (error) {
      console.error('Error reloading user data:', error)
    }
  }
  

  const nf = useMemo(() => new Intl.NumberFormat('ko-KR'), [])
  const formatNumber = (n?: number | 'private', showExact: boolean = false) => {
    if (typeof n === 'number') {
      // 모든 플랫폼에서 천단위 구분자 적용 (TikTok도 포함)
      return nf.format(n)
    }
    return n === 'private' ? '비공개' : '-'
  }
  const formatDuration = (sec?: number) => {
    if (typeof sec !== 'number' || !Number.isFinite(sec)) return '-'
    const s = Math.max(0, Math.floor(sec))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2,'0')}`
  }

  // 검색 전 확인 및 실행 함수
  const checkVerificationAndRun = () => {
    // 검색 전 알림 팝업 표시
    const showSearchConfirmation = () => {
      return new Promise<boolean>((resolve) => {
        const modal = document.createElement('div')
        modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
        
        const creditCosts = {
          instagram: { 30: 100, 60: 200, 90: 300, 120: 400 },
          youtube: { 30: 50, 60: 100, 90: 150, 120: 200 },
          tiktok: { 30: 100, 60: 200, 90: 300, 120: 400 }
        }
        
        const platformCosts = creditCosts[platform as keyof typeof creditCosts] || {}
        const currentCost = (platformCosts as any)[Number(limit)] || 0
        const platformName = platform === 'youtube' ? 'YouTube' : platform === 'tiktok' ? 'TikTok' : 'Instagram'
        
        modal.innerHTML = `
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div class="text-lg font-semibold text-gray-800 mb-3">${platformName} 검색</div>
            <div class="text-sm text-gray-600 mb-4">
              ${limit}개 결과를 검색합니다.<br/>
              <span class="font-medium text-blue-600">${currentCost} 크레딧</span>이 차감됩니다.
            </div>
            <div class="flex items-center justify-end gap-3">
              <button id="cancel-btn" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
              <button id="confirm-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">검색 시작</button>
            </div>
          </div>
        `
        
        const cancelBtn = modal.querySelector('#cancel-btn')
        const confirmBtn = modal.querySelector('#confirm-btn')
        
        cancelBtn?.addEventListener('click', () => {
          document.body.removeChild(modal)
          resolve(false)
        })
        
        confirmBtn?.addEventListener('click', () => {
          document.body.removeChild(modal)
          resolve(true)
        })
        
        document.body.appendChild(modal)
      })
    }
    
    // 검색 확인 후 실행
    showSearchConfirmation().then((confirmed) => {
      if (confirmed) {
        run()
      }
    })
  }

  // 본인인증 성공 시 실행될 함수 (비활성화됨)
  // const handleVerificationSuccess = () => {
  //   setShowVerificationModal(false)
  //   if (pendingSearchAction) {
  //     pendingSearchAction()
  //     setPendingSearchAction(null)
  //   }
  // }

  // 본인인증 모달 닫기 함수 (비활성화됨)
  // const handleVerificationClose = () => {
  //   setShowVerificationModal(false)
  //   setPendingSearchAction(null)
  // }

  const run = async () => {
    // 새 검색 시 페이지 리셋
    setCurrentPage(1)
    
    // On first click, check 7-day opt-out
    const optKey = 'reelcher.search.confirm.optout.until'
    const until = typeof window !== 'undefined' ? Number(localStorage.getItem(optKey) || 0) : 0
    const now = Date.now()
    
    // 7일 옵트아웃 상태 체크
    if (until > now) {
      console.log('검색 시작 팝업 7일 옵트아웃 적용 중:', new Date(until).toLocaleString())
      // 팝업 없이 바로 검색 진행
    } else if (until > 0) {
      console.log('검색 시작 팝업 7일 옵트아웃 만료됨:', new Date(until).toLocaleString())
    }
    
    // 플랫폼별 크레딧 계산
    const getCreditCost = () => {
      if (platform === 'instagram') {
        return { '30': 100, '60': 200, '90': 300, '120': 400, '5': 0 }[String(limit)] ?? 0
      } else if (platform === 'youtube') {
        if (searchType === 'keyword') {
          // YouTube 키워드 검색: 할인된 체계 (Instagram 대비 50% 할인)
          return { '30': 50, '60': 100, '90': 150, '120': 200, '5': 0 }[String(limit)] ?? 0
        } else {
          // YouTube URL 검색: 새로운 체계
          return { '15': 25, '30': 50, '50': 70, '5': 0 }[String(limit)] ?? 0
        }
      } else if (platform === 'tiktok') {
        return { '30': 100, '60': 200, '90': 300, '120': 400, '5': 0 }[String(limit)] ?? 0
      }
      return 0
    }
    
    const nCredits = getCreditCost()
    
    // 7일 옵트아웃 상태면 팝업 건너뛰고 바로 검색 진행
    if (until > now) {
      console.log('검색 시작 팝업 7일 옵트아웃으로 인해 팝업 건너뛰기')
    } else {
      // Show confirmation with 7-day opt-out
      const ok = await new Promise<boolean>((resolve) => {
        const modal = document?.createElement('div') as HTMLDivElement
        modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
        modal.innerHTML = `
          <div class="bg-white rounded shadow-lg w-full max-w-md p-5" role="dialog">
            <div class="text-base font-semibold mb-3">검색을 시작할까요?</div>
            <div class="text-sm text-neutral-700 space-y-2">
              <p>데이터 수집으로 인해 검색 시간은 최대 1분 이상 소요될 수 있으며 시작 즉시 크레딧이 소모돼요.</p>
            <p>${limit}개의 결과를 바로 받아볼까요? 예상 차감: <b>${nCredits} 크레딧</b></p>
            </div>
            <div class="flex items-center justify-between mt-4">
            <label class="text-xs text-neutral-600 flex items-center gap-3 cursor-pointer">
              <input id="opt7" type="checkbox" class="w-4 h-4 rounded border-gray-300" ${ (until>now)?'checked':'' } onchange=""/>
              7일 동안 보지 않기
            </label>
              <div class="flex items-center gap-3">
                <button id="cnl" class="px-3 py-2 border rounded">취소</button>
                <button id="go" class="px-3 py-2 border rounded bg-black text-white">시작(${nCredits}크레딧)</button>
              </div>
            </div>
          </div>`
        document?.body?.appendChild(modal)
        const cleanup = () => { modal.remove() }
        modal.querySelector('#cnl')?.addEventListener('click', () => { cleanup(); resolve(false) })
        modal.querySelector('#go')?.addEventListener('click', () => {
          const chk = (modal.querySelector('#opt7') as HTMLInputElement | null)?.checked
          if (chk) {
            const sevenDays = 7 * 24 * 60 * 60 * 1000
            const optoutUntil = Date.now() + sevenDays
            if (typeof window !== 'undefined') {
              localStorage.setItem(optKey, String(optoutUntil))
              console.log('검색 시작 팝업 7일 옵트아웃 설정:', new Date(optoutUntil).toLocaleString())
            }
          } else {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(optKey)
              console.log('검색 시작 팝업 7일 옵트아웃 해제')
            }
          }
          cleanup(); resolve(true)
        })
      })
      if (!ok) return
    }
    
    setLoading(true)
    abortRef.current = new AbortController()
    setDebug(null)
    setRaw('')
    openProgress('검색을 진행 중입니다…', 5)
    tickProgress(92, 1, 500)
    try {
      let payload: any
      let apiEndpoint: string
      
      if (platform === 'youtube') {
        // YouTube API 키 확인
        if (!youtubeApiKey.trim()) {
          alert('YouTube API 키를 입력해주세요.')
          setLoading(false)
          setProgressOpen(false)
          return
        }
        
        // YouTube 검색 페이로드
        payload = {
          searchType,
          query: keywords[0] || '',
          resultsLimit: Number(limit),
          apiKey: youtubeApiKey.trim(),
          filters: {
            period,
            minViews: minViews > 0 ? minViews : undefined,
            maxSubscribers: maxSubscribers > 0 ? maxSubscribers : undefined,
            videoDuration
          }
        }
        if (searchType === 'url') {
          payload.url = keywords[0] || ''
        }
        apiEndpoint = '/api/search/youtube'
      } else if (platform === 'tiktok') {
        // TikTok 검색 페이로드 (키워드/URL/프로필 검색 지원)
        const query = keywords[0] || ''
        
        // 검색 타입 결정
        let tiktokSearchType: 'keyword' | 'hashtag' | 'url' | 'profile' = 'hashtag'
        if (searchType === 'profile') {
          tiktokSearchType = 'profile'
        } else if (searchType === 'url' || query.includes('tiktok.com')) {
          tiktokSearchType = 'url'
        } else {
          tiktokSearchType = 'hashtag'
        }
        
        payload = {
          searchType: tiktokSearchType,
          query: query,
          resultsLimit: Number(limit),
          filters: {
            sortBy: 'trending',
            // 프로필 검색 시에만 minLikes 필터 적용
            ...(searchType === 'profile' && minLikes > 0 ? { minLikes } : {})
          }
        }
        apiEndpoint = '/api/search/tiktok'
      } else {
        // Instagram 검색
        if (searchType === 'profile') {
          // 프로필 검색
          const profileUrl = keywords[0]?.trim() || ''
          if (!profileUrl) {
            throw new Error('프로필 URL 또는 사용자명을 입력해주세요.')
          }
          
          // 기간 필터 계산 (Apify 형식으로)
          let onlyPostsNewerThan: string | undefined = undefined
          if (instagramPeriod !== '30') { // 기본값이 아닌 경우
            if (instagramPeriod === 'custom') {
              // 사용자 정의 기간
              if (instagramCustomUnit === 'days') {
                onlyPostsNewerThan = `${instagramCustomPeriod} days`
              } else {
                onlyPostsNewerThan = `${instagramCustomPeriod} months`
              }
            } else {
              // 미리 정의된 기간
              const periodDays = Number(instagramPeriod)
              if (periodDays === 7) {
                onlyPostsNewerThan = '7 days'
              } else if (periodDays === 15) {
                onlyPostsNewerThan = '15 days'
              } else if (periodDays === 30) {
                onlyPostsNewerThan = '1 month'
              } else if (periodDays === 90) {
                onlyPostsNewerThan = '3 months'
              } else if (periodDays === 180) {
                onlyPostsNewerThan = '6 months'
              } else if (periodDays === 365) {
                onlyPostsNewerThan = '12 months'
              }
            }
          }
          
          payload = { 
            searchType: 'profile',
            profileUrl,
            limit, 
            debug: true,
            onlyPostsNewerThan
          }
        } else {
          // 키워드 검색 (기존)
          const list = keywords.map(s=>s.trim()).filter(Boolean).slice(0,3)
          payload = { 
            searchType: 'keyword',
            keyword: (list[0] || '재테크'), 
            limit, 
            debug: true 
          }
          if (list.length) payload.keywords = list
        }
        apiEndpoint = '/api/search'
      }
      
      if (turnstileSiteKey) payload.turnstileToken = turnstileToken

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current?.signal,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        console.error('검색 API 오류:', {
          status: res.status,
          statusText: res.statusText,
          platform,
          payload,
          response: j,
          fullError: j
        })
        
        // 더 자세한 에러 메시지 구성
        let msg = `Request failed (${res.status})`
        if (j) {
          if (j.error) msg = j.error
          if (j.message) msg = j.message
          if (j.details?.issues) {
            const issues = j.details.issues.map((issue: any) => 
              `${issue.path?.join('.') || 'root'}: ${issue.message}`
            ).join(', ')
            msg = `Validation Error: ${issues}`
          }
        }
        if (res.status === 402) {
          const modal = document.createElement('div')
          modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
          modal.innerHTML = `
            <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
              <div class="text-base font-semibold mb-3">크레딧이 부족해요</div>
              <div class="text-sm text-neutral-700">크레딧을 충전하시겠어요?</div>
              <div class="flex items-center justify-end gap-3 mt-4">
                <button id="cnl" class="px-3 py-2 border rounded">취소</button>
                <a id="go" class="px-3 py-2 border rounded bg-black text-white" href="/pricing">구매</a>
              </div>
            </div>`
          document.body.appendChild(modal)
          modal.querySelector('#cnl')?.addEventListener('click', () => modal.remove())
        } else {
        alert(msg)
        }
        setRaw(JSON.stringify(j || { error: msg }, null, 2))
        setProgressOpen(false)
        return
      }
      const json = await res.json()
      let arr: SearchRow[] = []
      
      if (platform === 'youtube') {
        // YouTube 응답 처리
        arr = Array.isArray(json.results) ? json.results.map((item: any) => ({
          url: `https://www.youtube.com/watch?v=${item.videoId}`,
          username: item.channelTitle,
          views: item.viewCount,
          likes: item.likeCount,
          comments: item.commentCount,
          followers: item.subscriberCount,
          thumbnailUrl: item.thumbnails?.high?.url || item.thumbnails?.medium?.url,
          caption: item.title + (item.description ? '\n\n' + item.description : ''),
          duration: item.durationSeconds,
          durationDisplay: item.duration, // 1:10:23 형식의 표시용 duration
          takenDate: item.publishedAt,
          isShorts: item.durationSeconds && item.durationSeconds <= 60, // 쇼츠 여부 (60초 이하)
          channelId: item.channelId, // YouTube 채널 ID
          channelUrl: `https://www.youtube.com/channel/${item.channelId}` // 실제 채널 URL
        })) : []
      } else if (platform === 'tiktok') {
        // TikTok 응답 처리 (Instagram과 동일한 구조: json.items)
        console.log('TikTok 프론트엔드 응답 전체:', json)
        console.log('TikTok json.items 존재 여부:', Array.isArray(json.items))
        console.log('TikTok json.items 길이:', json.items?.length)
        
        arr = Array.isArray(json.items) ? json.items.map((item: any) => {
          console.log('TikTok 개별 아이템 매핑:', {
            videoId: item.videoId,
            username: item.username,
            viewCount: item.viewCount,
            likeCount: item.likeCount,
            thumbnailUrl: item.thumbnailUrl,
            title: item.title
          })
          
          // TikTok API 응답에서 필요한 필드 추출
          return {
            url: item.webVideoUrl || `https://www.tiktok.com/@${item.username}/video/${item.videoId}`,
            username: item.username || 'unknown',
            views: item.viewCount || 0,
            likes: item.likeCount || 0,
            comments: item.commentCount || 0,
            followers: item.followersCount || 0,
            thumbnailUrl: item.thumbnailUrl || null,
            caption: item.title || item.description || '',
            duration: item.duration || 0,
            takenDate: item.publishedAt || new Date().toISOString(),
            videoUrl: item.videoUrl || item.webVideoUrl
          }
        }) : []
        
        console.log('TikTok 최종 매핑된 배열:', arr)
        console.log('TikTok 배열 길이:', arr.length)
        console.log('TikTok 첫 번째 아이템:', arr[0])
      } else {
        // Instagram 응답 처리 (기존 방식)
        arr = Array.isArray(json.items) ? json.items : []
      }
      
      // default sort: views desc
      arr.sort((a, b) => (b.views || 0) - (a.views || 0))
      setBaseItems(arr)
      setDebug(json.debug ?? null)
      setRaw(JSON.stringify(json, null, 2))
      finishProgress()
      
      // 검색 완료 후 즉시 통계 업데이트
      Promise.all([loadStats(), loadCredits()]).catch(console.warn)
      
      // 검색 성공 시 최근 키워드를 서버에 저장 (모든 플랫폼, 키워드 검색만, URL 검색 제외)
      console.log(`키워드 저장 조건 체크: arr.length=${arr.length}, searchType=${searchType}, platform=${platform}`)
      if (arr.length > 0 && searchType === 'keyword') {
        const keyword = (platform === 'youtube' || platform === 'tiktok') 
          ? keywords[0]?.trim() 
          : keywords[0]?.trim()
        
        console.log(`키워드 저장 준비: keyword="${keyword}", keywords=`, keywords)
        
        // 키워드 검색인 경우만 저장 (URL, 프로필 검색 제외)
        const isKeywordSearch = searchType === 'keyword' && keyword && keyword.length > 0 && !keyword.includes('http') && !keyword.includes('@')
        console.log(`키워드 저장 가능 여부: isKeywordSearch=${isKeywordSearch}`)
        if (isKeywordSearch) {
          try {
            console.log(`Saving recent keyword for ${platform}:`, keyword)
            // 서버에 키워드 저장
            const keywordRes = await fetch('/api/me/recent-keywords', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword, platform })
            })
            if (!keywordRes.ok) {
              const errorText = await keywordRes.text().catch(() => 'Unknown error')
              console.warn(`Failed to save keyword (${keywordRes.status}):`, errorText)
            } else {
              console.log(`Recent keyword saved successfully for ${platform}`)
            }
          } catch (error) {
            console.warn(`Failed to save recent keyword for ${platform}:`, error)
          }
        }
      }
      // 환불 안내 (플랫폼별 크레딧 계산)
      try {
        let returned = 0
        let requested = Number(payload?.limit || 30)
        
        if (platform === 'youtube') {
          returned = Array.isArray(json?.results) ? json.results.length : 0
        } else if (platform === 'tiktok') {
          returned = Array.isArray(json?.results) ? json.results.length : 0
        } else {
          returned = Array.isArray(json?.items) ? json.items.length : 0
        }
        
        if (returned < requested) {
          // 플랫폼별 크레딧 계산 및 환불 처리
          let actualCredits = 0
          let reserved = 0
          
          if (platform === 'youtube') {
            if (searchType === 'keyword') {
              // YouTube 키워드 검색: 할인된 체계 (Instagram 대비 50% 할인)
              if (requested === 30) {
                actualCredits = Math.round((returned / 30) * 50)
                reserved = 50
              } else if (requested === 60) {
                actualCredits = Math.round((returned / 60) * 100)
                reserved = 100
              } else if (requested === 90) {
                actualCredits = Math.round((returned / 90) * 150)
                reserved = 150
              } else if (requested === 120) {
                actualCredits = Math.round((returned / 120) * 200)
                reserved = 200
              }
            } else {
              // YouTube URL 검색: 새로운 체계
              if (requested === 15) {
                actualCredits = Math.round((returned / 15) * 25)
                reserved = 25
              } else if (requested === 30) {
                actualCredits = Math.round((returned / 30) * 50)
                reserved = 50
              } else if (requested === 50) {
                actualCredits = Math.round((returned / 50) * 70)
                reserved = 70
              }
            }
          } else if (platform === 'tiktok') {
            // TikTok: 30개당 50크레딧 기준 (요구사항에 따라 변경)
            actualCredits = Math.round((returned / 30) * 100)
            reserved = (requested / 30) * 100
          } else {
            // Instagram: 30개당 100크레딧 기준
            actualCredits = Math.round((returned / 30) * 100)
            reserved = (requested / 30) * 100
          }
          
          const refund = Math.max(0, reserved - actualCredits)
          
          if (refund > 0) {
            const toast = document.createElement('div')
            toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-black text-white text-sm px-4 py-2 rounded shadow'
            toast.textContent = `반환 안내: 결과가 적어 ${refund} 크레딧이 환불되었습니다.`
            document.body.appendChild(toast)
            setTimeout(()=>toast.remove(), 4000)
          }
        }
      } catch {
        // 환불 계산 실패 시 무시
      }
    } catch (e) {
      console.error('검색 함수 전체 오류:', e)
      const msg = (e as Error)?.message || 'Unknown error'
      setRaw(msg)
      setProgressOpen(false)
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const cancel = () => {
    try { 
      abortRef.current?.abort() 
    } catch {
      // abort 실패 시 무시
    }
    setProgressOpen(false)
    setLoading(false)
  }

  // Derived items from baseItems + filters + sort
  const items = useMemo(() => {
    if (!baseItems || !Array.isArray(baseItems) || baseItems.length === 0) return null
    let arr = baseItems
    const v = filters
    if (v && (v.views || v.followers || v.date)) {
      const [vMin, vMax] = v.views || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
      const [fMin, fMax] = v.followers || [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
      const [dMin, dMax] = v.date || ['', '']
      arr = arr.filter((i) => {
        const okViews = (i.views || 0) >= vMin && (i.views || 0) <= vMax
        const okFollowers = (i.followers || 0) >= fMin && (i.followers || 0) <= fMax
        const ts = i.takenDate ? Date.parse(i.takenDate) : 0
        const okDate = !dMin || !dMax ? true : (ts >= Date.parse(dMin) && ts <= Date.parse(dMax))
        return okViews && okFollowers && okDate
      })
    }
    
    // 인스타그램 검색 시 협찬 필터링 (키워드/프로필 모두)
    if (platform === 'instagram' && showSponsoredOnly) {
      arr = arr.filter((i) => {
        return (i as any).paidPartnership === true
      })
    }
    
    const sorted = [...arr]
    if (sort === 'views') {
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0))
    } else if (sort === 'latest') {
      sorted.sort((a, b) => (Date.parse(b.takenDate || '') || 0) - (Date.parse(a.takenDate || '') || 0))
    } else {
      sorted.sort((a, b) => (Date.parse(a.takenDate || '') || 0) - (Date.parse(b.takenDate || '') || 0))
    }
    // 페이지네이션 적용
    return sorted.slice(startIndex, endIndex)
  }, [baseItems, filters, sort, startIndex, endIndex, platform, searchType, showSponsoredOnly])

  // 현재 페이지 아이템들을 전역에 저장 (Shift 선택용)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && items && window) {
        ;(window as any).__currentPageItems = items
      }
    } catch (error) {
      console.warn('Failed to store current page items:', error)
    }
  }, [items])

  // Prefetch thumbnails (all) to make modal open instantly
  useEffect(() => {
    if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return
    ensurePreconnect('https://images.apifyusercontent.com')
    const unique = new Set<string>()
    for (const row of items) {
      const src = buildInitialPreviewSrc(row)
      if (src && !unique.has(src)) {
        unique.add(src)
      }
    }
    unique.forEach((src) => preloadImage(src))
  }, [items])

  // Load Turnstile widget only when site key exists
  useEffect(() => {
    if (typeof window === 'undefined' || !turnstileSiteKey) return
    const id = 'cf-turnstile'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.defer = true
      s.id = id
      document.head.appendChild(s)
    }
    const i = setInterval(() => {
      const anyWin = window as any
      if (anyWin.turnstile && widgetRef.current) {
        anyWin.turnstile.render(widgetRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          'refresh-expired': 'auto',
          size: 'flexible',
          theme: 'light',
        })
        clearInterval(i)
      }
    }, 200)
    return () => clearInterval(i)
  }, [turnstileSiteKey])

  // 데이터 새로고침 함수
  const refreshData = async () => {
    try {
      console.log('🔄 데이터 새로고침 시작')
      const cacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
      
      // Parallel API calls for faster loading with timestamp to prevent caching
      const timestamp = Date.now()
      const [userRes, statsRes, keywordsRes] = await Promise.all([
        fetch(`/api/me?_t=${timestamp}`, { cache: 'no-store', headers: cacheHeaders }).catch(e => {
          console.error('❌ 사용자 API 호출 실패:', e)
          return new Response(JSON.stringify({ error: 'Failed to fetch user data' }), { status: 500 })
        }),
        fetch(`/api/me/stats?_t=${timestamp}`, { cache: 'no-store', headers: cacheHeaders }).catch(e => {
          console.error('❌ 통계 API 호출 실패:', e)
          return new Response(JSON.stringify({ error: 'Failed to fetch stats' }), { status: 500 })
        }),
        fetch(`/api/me/recent-keywords?_t=${timestamp}`, { cache: 'no-store', headers: cacheHeaders }).catch(e => {
          console.error('❌ 키워드 API 호출 실패:', e)
          return new Response(JSON.stringify({ error: 'Failed to fetch keywords' }), { status: 500 })
        })
      ])
      
      // Process user data with safe JSON parsing
      if (userRes.ok) {
        try {
          const j = await userRes.json().catch(() => ({}))
          setMyCredits(typeof j?.credits === 'number' ? j.credits : null)
          setIsAdmin(j?.role === 'admin')
          setUser(j?.user || null)
          if (j?.plan) setPlan(j.plan)
          console.log('✅ 사용자 데이터 새로고침 완료:', { credits: j?.credits, role: j?.role, plan: j?.plan })
        } catch (parseError) {
          console.error('❌ 사용자 데이터 JSON 파싱 실패:', parseError)
          setMyCredits(null)
        }
      } else {
        console.error('❌ 사용자 데이터 새로고침 실패:', userRes.status, userRes.statusText)
        setMyCredits(null)
      }
      
      // Process stats data with safe JSON parsing
      if (statsRes.ok) {
        try {
          const stats = await statsRes.json().catch(() => ({}))
          const todaySearches = Number(stats.today_searches || 0)
          const monthSearches = Number(stats.month_searches || 0)
          const monthCreditsUsed = Number(stats.month_credits || 0)
          
          setTodayCount(todaySearches)
          setMonthCount(monthSearches)
          setMonthCredits(monthCreditsUsed)
          
          console.log('✅ 통계 데이터 새로고침 완료:', {
            today: todaySearches,
            month: monthSearches,
            monthCredits: monthCreditsUsed
          })
        } catch (parseError) {
          console.error('❌ 통계 데이터 JSON 파싱 실패:', parseError)
          setTodayCount(0)
          setMonthCount(0)
          setMonthCredits(0)
        }
      } else {
        console.error('❌ 통계 데이터 새로고침 실패:', statsRes.status, statsRes.statusText)
        setTodayCount(0)
        setMonthCount(0)
        setMonthCredits(0)
      }
      
      // Process keywords data with safe JSON parsing
      if (keywordsRes.ok) {
        try {
          const keywords = await keywordsRes.json().catch(() => ({ recent: [] }))
          if (Array.isArray(keywords.recent)) {
            const keywordStrings = keywords.recent.map((k: any) => k.keyword || k).filter(Boolean)
            setRecentKeywords(keywordStrings)
            console.log('✅ 최근 키워드 새로고침 완료:', keywordStrings.length, '개')
          } else {
            console.warn('⚠️ keywords.recent이 배열이 아님:', keywords)
            setRecentKeywords([])
          }
        } catch (parseError) {
          console.error('❌ 키워드 데이터 JSON 파싱 실패:', parseError)
          setRecentKeywords([])
        }
      } else {
        console.error('❌ 최근 키워드 새로고침 실패:', keywordsRes.status, keywordsRes.statusText)
        setRecentKeywords([])
      }
    } catch (error) {
      console.error('❌ 데이터 새로고침 실패:', error)
    }
  }

  // load my credits, role, user info, and search counters/recent keywords
  useEffect(() => {
    refreshData()
  }, [])
  
  // 검색 성공 후 데이터 새로고침을 위해 글로벌 함수로 노출
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__refreshSearchData = refreshData
    }
  }, [refreshData])

  // 검색 후 자동으로 데이터 새로고침 (결과 개수가 변경될 때)
  useEffect(() => {
    if (baseItems && baseItems.length > 0) {
      // 검색 결과가 나온 후 1초 뒤에 데이터 새로고침
      const timer = setTimeout(() => {
        refreshData()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [baseItems?.length])

  // 키보드 이벤트 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault()
      checkVerificationAndRun()
    }
  }

  const showUpgradeModal = (message = '해당 기능은 스타터 플랜부터 이용이 가능해요') => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
    modal.innerHTML = `
      <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
        <div class="text-base font-semibold mb-3">사용 제한</div>
        <div class="text-sm text-neutral-700">${message}</div>
        <div class="flex items-center justify-end gap-3 mt-4">
          <button id="cnl" class="px-3 py-1.5 text-sm border rounded">닫기</button>
          <a id="go" class="px-3 py-1.5 text-sm border rounded bg-black text-white" href="/pricing">업그레이드 바로가기</a>
        </div>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('#cnl')?.addEventListener('click', () => modal.remove())
  }

  return (
    <div className="min-h-screen">
      {/* Header Bar */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-[1320px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-0.05 hover:opacity-80 transition-opacity">
              <picture>
                <source srcSet="/logo.svg" type="image/svg+xml" />
                <source srcSet="/favicon-64x64.png" type="image/png" />
                <img
                  src="/icon-64"
                  alt="Reelcher Logo"
                  className="w-10 h-10 flex-shrink-0"
                  loading="eager"
                  decoding="sync"
                  style={{
                    imageRendering: 'crisp-edges'
                  } as React.CSSProperties & {
                    WebkitImageRendering?: string;
                    MozImageRendering?: string;
                    msImageRendering?: string;
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('icon-64')) {
                      target.src = '/favicon-64x64.png';
                    } else if (target.src.includes('favicon-64x64.png')) {
                      target.src = '/favicon-32x32.png';
                    } else if (target.src.includes('favicon-32x32.png')) {
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.text-logo-fallback')) {
                        const textLogo = document.createElement('div');
                        textLogo.className = 'text-logo-fallback w-10 h-10 bg-black text-white rounded flex items-center justify-center font-bold text-sm';
                        textLogo.textContent = 'R';
                        parent.insertBefore(textLogo, target);
                      }
                    }
                  }}
                />
              </picture>
              <span className="font-bold text-xl text-black">Reelcher</span>
            </Link>
            
            {/* Navigation */}
            <div className="flex items-center gap-3">
              {user ? (
                <Button asChild variant="outline" className="text-sm font-medium border-2 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                  <Link href="/dashboard">
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      대시보드
      </div>
                  </Link>
                </Button>
              ) : (
                <Button asChild className="text-sm font-medium bg-black text-white hover:bg-gray-800 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                  <Link href="/sign-in">무료로 시작하기</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1320px] mx-auto p-6 pt-8 space-y-8">
        
        {/* Platform Selection Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-[400px]">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">플랫폼 선택</h2>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg w-full">
              <button
                onClick={() => handlePlatformSwitch('instagram')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  platform === 'instagram'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram
              </button>
              <button
                onClick={() => handlePlatformSwitch('youtube')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  platform === 'youtube'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube
              </button>
              <button
                onClick={() => handlePlatformSwitch('tiktok')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  platform === 'tiktok'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-1.032-.083 6.411 6.411 0 0 0-6.41 6.41 6.411 6.411 0 0 0 6.41 6.41 6.411 6.411 0 0 0 6.41-6.41V9.054a8.05 8.05 0 0 0 4.6 1.432v-3.4a4.751 4.751 0 0 1-.745-.4z"/>
                </svg>
                TikTok
              </button>
            </div>
            
            {/* Search Type Selection for YouTube */}


            {/* YouTube API Key Input */}
            {platform === 'youtube' && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">YouTube API 키</h3>
                <div className="flex items-center gap-3">
                  <input 
                    type="password"
                    className="w-80 h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all bg-white" 
                    placeholder="YouTube Data API v3 키를 입력하세요"
                    value={youtubeApiKey} 
                    onChange={(e) => {
                      setYoutubeApiKey(e.target.value)
                    }} 
                  />
                  <button
                    onClick={() => setSavedApiKeysOpen(true)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all whitespace-nowrap"
                  >
                    내 API 키
                  </button>
                  <button
                    onClick={() => window.open('https://www.notion.so/API-2521b7e096df800f96f6d494596f5e5c?source=copy_link', '_blank')}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-medium transition-all whitespace-nowrap"
                  >
                    발급 방법
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex gap-10">
        {/* Left Column: Search Controls */}
        <div className="w-[420px] space-y-7" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
          {/* 검색 입력 */}
          <div>
            {/* 검색 방식 선택 버튼 (TikTok과 YouTube용) */}
            {(platform === 'instagram' || platform === 'tiktok' || platform === 'youtube') ? (
              <div className="mb-3">
                {platform === 'instagram' ? (
                  // Instagram: 2개 버튼 (키워드, 프로필)
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                        searchType === 'keyword'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setSearchType('keyword')}
                    >
                      키워드 검색
                    </button>
                    <button
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                        searchType === 'profile'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setSearchType('profile')}
                    >
                      프로필 검색
                    </button>
                  </div>
                ) : platform === 'tiktok' ? (
                  // TikTok: 3개 버튼 (키워드, URL, 프로필)
                  <div className="grid grid-cols-3 bg-gray-100 rounded-lg p-1 gap-1">
                    <button
                      className={`py-2 px-3 text-sm font-medium rounded-md transition-all ${
                        searchType === 'keyword'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setSearchType('keyword')}
                    >
                      키워드 검색
                    </button>
                    <button
                      className={`py-2 px-3 text-sm font-medium rounded-md transition-all ${
                        searchType === 'url'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setSearchType('url')}
                    >
                      유사 영상 검색
                    </button>
                    <button
                      className={`py-2 px-3 text-sm font-medium rounded-md transition-all ${
                        searchType === 'profile'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setSearchType('profile')}
                    >
                      프로필 검색
                    </button>
                  </div>
                ) : (
                  // YouTube: 기존 2개 버튼
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                        searchType === 'keyword'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => setSearchType('keyword')}
                    >
                      키워드 검색
                    </button>
                    <button
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
                        searchType === 'url'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      onClick={() => {
                        // YouTube 유사 영상 검색 경고 팝업
                        const optKey = 'reelcher.youtube.similar.warning.optout.until'
                        const until = typeof window !== 'undefined' ? Number(localStorage.getItem(optKey) || 0) : 0
                        const now = Date.now()
                        
                        if (until > now) {
                          // 7일 동안 보지 않기가 활성화된 경우 바로 전환
                          console.log('유사 영상 검색 팝업 7일 옵트아웃 적용 중:', new Date(until).toLocaleString())
                          setSearchType('url')
                          return
                        } else if (until > 0) {
                          console.log('유사 영상 검색 팝업 7일 옵트아웃 만료됨:', new Date(until).toLocaleString())
                        }
                        
                        // 경고 팝업 표시
                        const modal = document.createElement('div')
                        modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
                        modal.innerHTML = `
                          <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
                            <div class="text-base font-semibold mb-3">유사 영상 검색 안내</div>
                            <div class="text-sm text-neutral-700 space-y-2 mb-4">
                              <p>• 유튜브 링크 기반 검색은 <strong>최대 50개 결과</strong>만 제공됩니다.</p>
                              <p>• 일반 키워드 검색에 비해 <strong>API 사용량이 많습니다</strong>.</p>
                            </div>
                            <div class="flex items-center gap-2 mb-4">
                              <input type="checkbox" id="opt7days-similar" class="rounded">
                              <label for="opt7days-similar" class="text-sm text-neutral-600">7일 동안 보지 않기</label>
                            </div>
                            <div class="flex items-center justify-end gap-2">
                              <button id="cancel-similar" class="px-3 py-2 border rounded text-sm">취소</button>
                              <button id="confirm-similar" class="px-3 py-2 border rounded bg-black text-white text-sm">확인</button>
                            </div>
                          </div>`
                        
                        document.body.appendChild(modal)
                        
                        const cleanup = () => modal.remove()
                        
                        modal.querySelector('#cancel-similar')?.addEventListener('click', cleanup)
                        modal.querySelector('#confirm-similar')?.addEventListener('click', () => {
                          const checkbox = modal.querySelector('#opt7days-similar') as HTMLInputElement
                          if (checkbox?.checked) {
                            const sevenDays = 7 * 24 * 60 * 60 * 1000
                            const optoutUntil = Date.now() + sevenDays
                            if (typeof window !== 'undefined') {
                              localStorage.setItem(optKey, String(optoutUntil))
                              console.log('7일 옵트아웃 설정:', new Date(optoutUntil).toLocaleString())
                            }
                          }
                          
                          setSearchType('url')
                          cleanup()
                        })
                      }}
                    >
                      유사 영상 검색
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-base font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                키워드
              </div>
            )}
            {(((platform === 'youtube' || platform === 'tiktok') && (searchType === 'url' || searchType === 'profile')) || (platform === 'instagram' && searchType === 'profile')) ? (
              <div>
                <input 
                  className="w-full h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                  style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  placeholder={
                    platform === 'instagram' && searchType === 'profile'
                      ? '예: https://www.instagram.com/abc 또는 abc'
                      : searchType === 'profile' 
                        ? '예: https://www.tiktok.com/@abc 또는 abc'
                        : platform === 'youtube' 
                          ? '예: https://www.youtube.com/watch?v=...' 
                          : '예: https://www.tiktok.com/@username/video/...'
                  }
                  value={keywords[0]} 
                  onChange={(e)=>setKeywords([e.target.value])} 
                />
                
                {/* Instagram 프로필 검색 시 업로드 기간 필터 */}
                {platform === 'instagram' && searchType === 'profile' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      업로드 기간 설정
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(['7', '15', '30', '90', '180', '365', 'custom'] as const).map((period) => (
                        <button
                          key={period}
                          className={`px-3 py-1 text-xs rounded-md border transition-all ${
                            instagramPeriod === period
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => setInstagramPeriod(period)}
                        >
                          {period === 'custom' 
                            ? '직접 입력' 
                            : period === '7' ? '7일'
                            : period === '15' ? '15일'
                            : period === '30' ? '1개월'
                            : period === '90' ? '3개월'
                            : period === '180' ? '6개월'
                            : '1년'
                          }
                        </button>
                      ))}
                    </div>
                    
                    {instagramPeriod === 'custom' && (
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          className="flex-1 h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                          style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                          placeholder="숫자만 입력"
                          min="1"
                          value={instagramCustomPeriod > 0 ? instagramCustomPeriod : ''}
                          onChange={(e) => setInstagramCustomPeriod(Number(e.target.value) || 1)}
                        />
                        <div className="flex bg-gray-100 rounded-lg p-1">
                          <button
                            className={`px-3 py-1 text-xs rounded-md transition-all ${
                              instagramCustomUnit === 'days'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => setInstagramCustomUnit('days')}
                          >
                            일
                          </button>
                          <button
                            className={`px-3 py-1 text-xs rounded-md transition-all ${
                              instagramCustomUnit === 'months'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                            onClick={() => setInstagramCustomUnit('months')}
                          >
                            개월
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* TikTok 프로필 검색 시 최소 좋아요 필터 */}
                {platform === 'tiktok' && searchType === 'profile' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      최소 좋아요 수 (선택사항)
        </label>
                    <input 
                      type="number"
                      className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                      style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                      placeholder="예: 500 (해당 계정에서 500 좋아요 이상인 영상만 검색)"
                      min="0"
                      value={minLikes > 0 ? minLikes : ''}
                      onChange={(e) => setMinLikes(Number(e.target.value) || 0)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      설정하지 않으면 모든 영상을 검색합니다
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
            <div className="flex items-center gap-3">
                  <input 
                    className="flex-1 h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                    style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                    placeholder={`예: ${platform === 'youtube' ? '요리, 게임, 뷰티...' : platform === 'tiktok' ? '재테크, 음식, 패션...' : '맛집, 여행, 패션...'}`}
                    value={keywords[0]} 
                    onChange={(e)=>setKeywords([e.target.value, ...keywords.slice(1)])} 
                  />
                  {keywords.length < 3 && platform !== 'youtube' && platform !== 'tiktok' && (
                    <button 
                      className="h-12 px-4 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-all" 
                      style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                      onClick={(e)=>{e.preventDefault(); if (plan==='free'){ showUpgradeModal('여러 키워드 검색은 스타터 플랜부터 이용이 가능해요'); return } setKeywords(prev=>[...prev,''])}}
                    >
                      + 키워드 추가
                    </button>
                  )}
            </div>
            
            {/* 키워드 검색 시 추천 키워드 (모든 플랫폼) */}
            {(
              (platform === 'youtube' && searchType === 'keyword') ||
              (platform === 'instagram' && searchType === 'keyword') ||
              (platform === 'tiktok' && searchType === 'keyword')
            ) && (
              <div className="mt-3">
                <button
                  onClick={() => setShowKeywordSuggestions(!showKeywordSuggestions)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 shadow-sm"
                >
                  <span>주제별 추천 키워드</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${showKeywordSuggestions ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showKeywordSuggestions && (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                
                {/* 카테고리 버튼들 */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {Object.keys(
                    platform === 'youtube' ? youtubeKeywordCategories :
                    platform === 'tiktok' ? tiktokKeywordCategories :
                    instagramKeywordCategories
                  ).map((category) => {
                    const selectedCategory = platform === 'youtube' ? selectedYoutubeCategory :
                                           platform === 'tiktok' ? selectedTiktokCategory :
                                           selectedInstagramCategory
                    const setSelectedCategory = platform === 'youtube' ? setSelectedYoutubeCategory :
                                              platform === 'tiktok' ? setSelectedTiktokCategory :
                                              setSelectedInstagramCategory
                    
                    return (
                      <button
                        key={category}
                        className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                          selectedCategory === category
                            ? 'bg-gray-900 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => setSelectedCategory(
                          selectedCategory === category ? null : category
                        )}
                      >
                        {category}
                      </button>
                    )
                  })}
                </div>
                
                {/* 선택된 카테고리의 키워드들 */}
                {(() => {
                  const selectedCategory = platform === 'youtube' ? selectedYoutubeCategory :
                                         platform === 'tiktok' ? selectedTiktokCategory :
                                         selectedInstagramCategory
                  const categories = platform === 'youtube' ? youtubeKeywordCategories :
                                   platform === 'tiktok' ? tiktokKeywordCategories :
                                   instagramKeywordCategories
                  
                  if (!selectedCategory) return null
                  
                  return (
                    <div className="grid grid-cols-5 gap-2">
                      {(categories as any)[selectedCategory].map((keyword: string) => (
                        <button
                          key={keyword}
                          className="px-2 py-1 text-xs text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-all"
                          onClick={() => setKeywords([keyword])}
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>
                  )
                })()}
                  </div>
                )}
              </div>
            )}
                {platform !== 'youtube' && platform !== 'tiktok' && keywords.slice(1).map((kw, idx)=> (
                  <div key={idx} className="flex items-center gap-3 mt-2">
                    <input 
                      className="flex-1 h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all" 
                      style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                      placeholder={`키워드 ${idx + 2}`}
                      value={kw} 
                      onChange={(e)=>setKeywords(prev=>prev.map((v,i)=>i===idx+1?e.target.value:v))} 
                    />
                    <button 
                      className="h-12 px-4 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium transition-all" 
                      style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                      onClick={(e)=>{e.preventDefault(); setKeywords(prev=>prev.filter((_,i)=>i!==idx+1))}}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
          


          {/* YouTube 전용 고급 필터 */}
          {platform === 'youtube' && (
            <div className="space-y-4">
              <div className="text-base font-semibold text-gray-700" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>고급 필터</div>
              
              {/* 그리드 레이아웃으로 필터들 배치 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 업로드 기간 */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">업로드 기간</div>
                  <select 
                    className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all bg-white" 
                    value={period} 
                    onChange={(e)=>setPeriod(e.target.value as any)}
                  >
                    <option value="day">최근 하루</option>
                    <option value="week">최근 일주일</option>
                    <option value="month">최근 한 달</option>
                    <option value="month2">최근 2개월</option>
                    <option value="month3">최근 3개월</option>
                    <option value="month6">최근 6개월</option>
                    <option value="year">최근 1년</option>
                    <option value="all">전체</option>
          </select>
      </div>

                {/* 영상 길이 */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">영상 길이</div>
                  <select 
                    className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all bg-white" 
                    value={videoDuration} 
                    onChange={(e)=>setVideoDuration(e.target.value as any)}
                  >
                    <option value="any">모든 길이</option>
                    <option value="short">쇼츠</option>
                    <option value="long">롱폼</option>
                  </select>
                </div>

                {/* 최소 조회수 - 입력 필드 */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">최소 조회수</div>
                  <NumberInput
                    value={minViews}
                    onChange={setMinViews}
                    placeholder="예: 10,000 (빈 값: 제한 없음)"
                  />
                </div>

                {/* 최대 구독자 수 - 입력 필드 */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">최대 구독자 수</div>
                  <NumberInput
                    value={maxSubscribers}
                    onChange={setMaxSubscribers}
                    placeholder="예: 100,000 (빈 값: 제한 없음)"
                  />
                </div>
              </div>
            </div>
          )}



          {/* 결과 개수와 검색 버튼 */}
          <div>
            <div className="text-base font-semibold text-gray-700 mb-3" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>결과 개수</div>
            <div className="flex items-end gap-3">
              <div className="flex-1 max-w-[200px]">
                <select 
                  className="w-full h-12 border border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all bg-white" 
                  style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                  value={limit} 
                  onChange={(e)=>{
                    const v = e.target.value as any
                    // Plan-based locking (플랫폼별 제한)
                    if (platform === 'youtube') {
                      if (searchType === 'keyword') {
                        // YouTube 키워드: 30/60/90/120
                        if (plan==='free' && (v==='60'||v==='90'||v==='120')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('FREE 플랜은 30개만 가능합니다'); return }
                        if (plan==='starter' && (v==='90'||v==='120')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('STARTER 플랜은 60개까지만 가능합니다'); return }
                        if (plan==='pro' && v==='120') { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('PRO 플랜은 90개까지만 가능합니다'); return }
                      } else {
                        // YouTube URL: 15/30/50
                        if (plan==='free' && (v==='30'||v==='50')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('FREE 플랜은 15개만 가능합니다'); return }
                        if (plan==='starter' && v==='50') { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('STARTER 플랜은 30개까지만 가능합니다'); return }
                      }
                    } else if (platform === 'instagram' && searchType === 'keyword') {
                      // Instagram 키워드 검색: 베타 단계에서 30개만 허용
                      if (v !== '30') { e.preventDefault(); (e.target as HTMLSelectElement).value = '30'; showUpgradeModal('베타 단계에서는 인스타그램 키워드 검색은 30개만 가능합니다'); return }
                    } else {
                      // Instagram 프로필 검색/TikTok: 30/60/90/120
                      if (plan==='free' && (v==='60'||v==='90'||v==='120')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('FREE 플랜은 30개만 가능합니다'); return }
                      if (plan==='starter' && (v==='90'||v==='120')) { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('STARTER 플랜은 60개까지만 가능합니다'); return }
                      if (plan==='pro' && v==='120') { e.preventDefault(); (e.target as HTMLSelectElement).value = prevLimitRef.current as any; showUpgradeModal('PRO 플랜은 90개까지만 가능합니다'); return }
                    }
                    prevLimitRef.current = v; setLimit(v)
                  }}
                >
                  {isAdmin && <option value="5">5 (개발용)</option>}
                  {platform === 'instagram' ? (
                    <>
                      {/* 인스타그램은 베타 단계에서 키워드 검색만 30개로 제한 (프로필 검색은 제한 없음) */}
                      {searchType === 'keyword' ? (
                        <option value="30">30개 (100크레딧)</option>
                      ) : (
                        <>
                          <option value="30">30개 (100크레딧)</option>
                          <option value="60">60개 (200크레딧){plan==='free'?' 🔒':''}</option>
                          <option value="90">90개 (300크레딧){(plan==='free'||plan==='starter')?' 🔒':''}</option>
                          <option value="120">120개 (400크레딧){(plan==='free'||plan==='starter'||plan==='pro')?' 🔒':''}</option>
                        </>
                      )}
                    </>
                  ) : platform === 'youtube' ? (
                    <>
                      {searchType === 'keyword' ? (
                        <>
                          <option value="30">30개 (50크레딧)</option>
                          <option value="60">60개 (100크레딧){plan==='free'?' 🔒':''}</option>
                          <option value="90">90개 (150크레딧){(plan==='free'||plan==='starter')?' 🔒':''}</option>
                          <option value="120">120개 (200크레딧){(plan==='free'||plan==='starter'||plan==='pro')?' 🔒':''}</option>
                        </>
                      ) : (
                        <>
                          <option value="15">15개 (25크레딧)</option>
                          <option value="30">30개 (50크레딧){plan==='free'?' 🔒':''}</option>
                          <option value="50">50개 (70크레딧){(plan==='free'||plan==='starter')?' 🔒':''}</option>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <option value="30">30개 (50크레딧)</option>
                      <option value="60">60개 (100크레딧){plan==='free'?' 🔒':''}</option>
                      <option value="90">90개 (150크레딧){(plan==='free'||plan==='starter')?' 🔒':''}</option>
                      <option value="120">120개 (200크레딧){(plan==='free'||plan==='starter'||plan==='pro')?' 🔒':''}</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <button 
                  onClick={(e)=>{e.preventDefault(); checkVerificationAndRun()}} 
                  disabled={loading} 
                  className={`h-12 px-6 rounded-lg text-sm font-medium text-white transition-all duration-200 ${
                    loading 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-black hover:bg-gray-800 hover:-translate-y-0.5'
                  }`}
                  style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                >
                  {loading ? '진행 중…' : '검색 시작'}
                </button>
              </div>
            </div>
            {loading && (
              <button 
                className="h-12 px-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition-all mt-3" 
                style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                onClick={(e)=>{e.preventDefault(); cancel()}}
              >
                취소
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Statistics and Info - 더욱 넓은 레이아웃 */}
        <div className="w-[600px] space-y-5" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
          <div className="flex gap-6">
            {/* 좌측: 검색 통계 + 크레딧 사용량 (하나의 박스에 구분선으로 분리) */}
            <div className="flex-1 p-6 border border-gray-200 rounded-lg bg-gray-50 flex flex-col">
              {/* 검색 통계 */}
              <div className="text-base font-semibold text-gray-700 mb-5">검색 통계</div>
              <div className="space-y-4 text-sm mb-6">
                <div className="flex items-center justify-between text-gray-600">
                  <span>오늘 검색</span>
                  <span className="font-semibold text-gray-900">{todayCount}회</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>이번 달</span>
                  <span className="font-semibold text-gray-900">{monthCount}회</span>
                </div>
              </div>
              
              {/* 더 명확한 구분선 */}
              <div className="border-t border-gray-300 my-5"></div>
              
              {/* 크레딧 사용량 */}
              <div className="text-base font-semibold text-gray-700 mb-5">크레딧 사용량</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between text-gray-600">
                  <span>이번 달</span>
                  <span className="font-semibold text-gray-900">{new Intl.NumberFormat('en-US').format(monthCredits)} 크레딧</span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>잔여</span>
                  <span className="font-semibold text-gray-900">{typeof myCredits === 'number' ? new Intl.NumberFormat('en-US').format(myCredits) : '-'} 크레딧</span>
                </div>
              </div>
            </div>

            {/* 우측: 나의 최근 키워드 (별도 박스) */}
            <div className="flex-1 p-6 border border-gray-200 rounded-lg bg-gray-50 flex flex-col justify-between">
              {/* 상단 콘텐츠 (제목 + 키워드)를 하나로 묶음 */}
              <div>
                <div className="text-base font-semibold text-gray-700 mb-4">나의 최근 키워드</div>
                <div className="flex flex-wrap gap-3 content-start">
                  {recentKeywords.length > 0 ? (() => {
                    const itemsPerPage = 11 // 페이지당 키워드 개수
                    const currentPageKeywords = recentKeywords.slice(
                      keywordPage * itemsPerPage,
                      (keywordPage + 1) * itemsPerPage
                    )

                    return currentPageKeywords.map(k => {
                      const displayText = k.length > 7 ? k.substring(0, 7) + '...' : k
                      return (
                        <Badge
                          key={k}
                          variant="outline"
                          className="cursor-pointer hover:bg-gray-100 transition-colors text-sm px-3 py-1 border-gray-200 hover:border-gray-300"
                          onClick={() => setKeywords([k])}
                          title={k}
                        >
                          {displayText}
                        </Badge>
                      )
                    })
                  })() : (
                    <div className="text-sm text-gray-500">
                      키워드 검색 후 입력된 키워드가 표시돼요.
                    </div>
                  )}
                </div>
              </div>

              {/* 페이지네이션 버튼 */}
              {(() => {
                const itemsPerPage = 11 // 페이지당 키워드 개수
                const totalPages = Math.ceil(recentKeywords.length / itemsPerPage)
                
                // 키워드가 하나라도 있을 때 페이지네이션을 보여주되, 버튼은 비활성화 처리합니다.
                if (recentKeywords.length === 0) return null

                return (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-2 pb-1 border-t border-gray-200">
                    <button
                      onClick={() => setKeywordPage(Math.max(0, keywordPage - 1))}
                      disabled={keywordPage === 0}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-xs text-gray-500">
                      {keywordPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setKeywordPage(Math.min(totalPages - 1, keywordPage + 1))}
                      disabled={keywordPage >= totalPages - 1}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Results Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">
              검색 결과 <span className="text-gray-600 text-sm">({baseItems?.length || 0}개 중 {items?.length || 0}개)</span>
            </h2>
            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center gap-3 ml-4">
                <button 
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  이전
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button 
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  다음
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                className={`px-3 py-1.5 text-sm border rounded transition-all duration-200 font-medium ${
                  (() => {
                    if (typeof window === 'undefined') return 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    const api = (window as any).__rowSelect as { selected?: Set<string> } | undefined
                    const currentSelected = api?.selected || new Set<string>()
                    const anySelected = currentSelected.size > 0
                    // checkAllToggle 상태를 참조하여 리렌더링 강제
                    const _ = checkAllToggle
                    return anySelected 
                      ? 'border-gray-400 bg-gray-100 text-gray-700 shadow-sm' 
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  })()
                }`}
                onClick={() => {
                  try {
                    if (typeof window === 'undefined' || !window) return
                    
                    const api = (window as any).__rowSelect as { selected?: Set<string>; setSelected?: any }
                    const allUrls = baseItems ? baseItems.map(i => i.url) : []
                    
                    // 현재 선택 상태 확인
                    const currentSelected = api?.selected || new Set<string>()
                    const anySelected = currentSelected.size > 0
                    const next = new Set<string>(anySelected ? [] : allUrls)
                    
                    // 즉시 UI 업데이트를 위해 먼저 상태 변경
                    setCheckAllToggle((v: number) => v+1)
                    
                    // 전역 상태 업데이트 - 더 안정적인 방식
                    if (api && typeof api.setSelected === 'function') {
                      api.setSelected(next)
                    } else {
                      // API가 없거나 setSelected가 함수가 아닐 경우 새로 생성
                      ;(window as any).__rowSelect = { 
                        selected: next, 
                        setSelected: (newSet: Set<string>) => {
                          try {
                            if (window && (window as any).__rowSelect) {
                              ;(window as any).__rowSelect.selected = newSet
                              window.dispatchEvent(new CustomEvent('rowSelectUpdate'))
                            }
                          } catch (error) {
                            console.warn('Failed to update row selection:', error)
                          }
                        }
                      }
                    }
                    
                    // 즉시 UI 반영을 위한 이벤트 발생
                    window.dispatchEvent(new CustomEvent('rowSelectUpdate'))
                    
                    // 추가 강제 리렌더링
                    setTimeout(() => setCheckAllToggle((v: number) => v+1), 0)
                  } catch (error) {
                    console.error('Failed to handle select all click:', error)
                  }
                }}
              >
                {(() => {
                  if (typeof window === 'undefined') return '전체선택'
                  const api = (window as any).__rowSelect as { selected?: Set<string> } | undefined
                  const currentSelected = api?.selected || new Set<string>()
                  const anySelected = currentSelected.size > 0
                  // checkAllToggle 상태를 참조하여 리렌더링 강제
                  const _ = checkAllToggle
                  return anySelected ? '선택해제' : '전체선택'
                })()}
              </button>
            </div>
            </div>
          <div className="flex items-center gap-3">
            {baseItems ? (
              <>
        <div className="flex items-center gap-3">
            <ClientFilters baseItems={baseItems} setFilters={setFilters} />
          <SortMenu sort={sort} setSort={setSort} />
          
          {/* 인스타그램 검색 시 협찬 필터 버튼 (키워드/프로필 모두) */}
          {platform === 'instagram' && (
            <button
              className={`px-3 py-1.5 text-sm border rounded transition-all font-medium ${
                showSponsoredOnly
                  ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                  : 'border-gray-300 hover:border-gray-400 text-gray-700'
              }`}
              onClick={() => setShowSponsoredOnly(!showSponsoredOnly)}
            >
              협찬 {showSponsoredOnly ? '해제' : ''}
            </button>
          )}
          </div>
                <div className="h-6 w-px bg-gray-300"></div>
                <ExportButtons items={items || []} platform={platform} onProgress={{ open: openProgress, tick: tickProgress, finish: finishProgress }} />
              </>
            ) : (
              <>
                <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed font-medium" disabled title="검색 후 사용 가능">필터</button>
                <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed font-medium" disabled title="검색 후 사용 가능">정렬</button>
                {/* 인스타그램일 때 협찬 버튼 (비활성화) */}
                {platform === 'instagram' && (
                  <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed font-medium" disabled title="검색 후 사용 가능">협찬</button>
                )}
                <div className="h-4 w-px bg-gray-300"></div>
                <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">영상 바로가기</button>
                <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">엑셀 추출</button>
                <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">썸네일 추출</button>
                <button className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-gray-50 text-gray-400 cursor-not-allowed" disabled title="검색 후 사용 가능">영상 추출</button>
              </>
            )}
        </div>
      </div>
      <div className="sr-only" aria-hidden>{turnstileSiteKey ? <div ref={widgetRef} /> : null}</div>
      

        <div className="overflow-x-auto p-6">
          <table className="w-full text-sm table-fixed">
            <thead className="bg-gray-50">
              <tr className="border-b-2 border-gray-300">
                <th className="p-3 text-center font-bold text-gray-800 w-[50px] border-r border-gray-200">선택</th>
                <th className="p-3 text-center font-bold text-gray-800 w-[90px] border-r border-gray-200">썸네일</th>
                <th className="p-3 text-center font-bold text-gray-800 w-[110px] border-r border-gray-200">업로드</th>
                <th className="p-3 text-center font-bold text-gray-800 w-[90px] border-r border-gray-200">조회수</th>
                <th className="p-3 text-center font-bold text-gray-800 w-[70px] border-r border-gray-200">길이</th>
                <th className="p-3 text-center font-bold text-gray-800 w-[80px] border-r border-gray-200">좋아요</th>
                <th className="p-3 text-center font-bold text-gray-800 w-[80px] border-r border-gray-200">댓글</th>
                {platform === 'youtube' && (
                  <th className="p-3 text-center font-bold text-gray-800 w-[380px] border-r border-gray-200">제목</th>
                )}
                <th className="p-3 text-center font-bold text-gray-800 w-[140px]">
                  {platform === 'youtube' ? '채널' : platform === 'tiktok' ? '계정' : '계정'}
                </th>
                {platform !== 'youtube' && (
                  <th className="p-3 text-center font-bold text-gray-800 w-[100px]">기능</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items && items.length > 0 ? items.map((r, index) => {
                const isExpanded = expandedTitleRow === r.url
                return (
                  <React.Fragment key={`row-${index}-${r.url?.replace(/[^a-zA-Z0-9]/g, '')}-${r.username || 'unknown'}`}>
                    <tr className="border-b border-gray-200 hover:bg-gray-50/70 transition-colors h-[64px]">
                      <td className="p-3 text-center align-middle border-r border-gray-100"><RowCheck url={r.url} index={index} /></td>
                      <td className="p-3 text-center align-middle border-r border-gray-100"><InlineThumb row={r as any} videoDuration={videoDuration} /></td>
                      <td className="p-3 text-center align-middle border-r border-gray-100 text-gray-800 font-semibold">
                        {r.takenDate ? (() => {
                          const date = new Date(r.takenDate)
                          if (isNaN(date.getTime())) return r.takenDate
                          return (
                            <div className="text-center">
                              <div className="text-sm leading-tight" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{date.toISOString().split('T')[0]}</div>
                              <div className="text-sm text-gray-600 leading-tight" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{date.toTimeString().substring(0, 5)}</div>
                            </div>
                          )
                        })() : '-'}
                      </td>
                      <td className="p-3 text-center align-middle border-r border-gray-100 font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{formatNumber(r.views)}</td>
                      <td className="p-3 text-center align-middle border-r border-gray-100 text-gray-800 font-semibold" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{r.durationDisplay || formatDuration(r.duration)}</td>
                      <td className="p-3 text-center align-middle border-r border-gray-100 font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{r.likes === 'private' || r.likes === 0 ? '-' : formatNumber(r.likes as number)}</td>
                      <td className="p-3 text-center align-middle border-r border-gray-100 font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>{formatNumber(r.comments)}</td>
                      {platform === 'youtube' && (
                        <td className="p-3 text-center align-middle border-r border-gray-100">
                          <div 
                            className="cursor-pointer text-gray-800 font-semibold hover:text-blue-600 transition-colors"
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedTitleRow(null)
                              } else {
                                setExpandedTitleRow(r.url)
                              }
                            }}
                          >
                            <div className="truncate max-w-[380px] leading-relaxed mx-auto" title={r.caption || ''}>
                              {r.caption || '-'}
                            </div>
                            {/* 모든 제목에 전체보기 버튼 표시 */}
                            <div className="text-xs text-blue-500 mt-1">
                              {isExpanded ? '축소 ▲' : '전체보기'}
                            </div>
                          </div>
                        </td>
                      )}
                                              <td className="p-3 text-center align-middle">
                    {r.username ? (
                        <div className="flex flex-col items-center">
                          <a 
                            className="text-gray-900 hover:text-gray-700 font-semibold text-center" 
                            style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }} 
                            href={
                              platform === 'youtube' 
                                ? (r.channelUrl || (r.channelId ? `https://www.youtube.com/channel/${r.channelId}` : `https://www.youtube.com/channel/${r.channelId || r.username}`))
                                : platform === 'tiktok' 
                                  ? `https://www.tiktok.com/@${r.username}` 
                                  : `https://www.instagram.com/${r.username}/`
                            } 
                            target="_blank" 
                            rel="noreferrer"
                          >
                            {platform === 'youtube' ? r.username : `@${r.username}`}
                          </a>
                          {/* 인스타그램 프로필 검색에서는 팔로워 수 숨기기 */}
                          {!(platform === 'instagram' && searchType === 'profile') && (
                            <div className="text-xs text-gray-600 text-center font-semibold" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
                              {typeof r.followers === 'number' ? new Intl.NumberFormat('en-US').format(r.followers) : '-'} {platform === 'youtube' ? '구독자' : '팔로워'}
                            </div>
                          )}
                      </div>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                      {platform !== 'youtube' && (
                        <td className="p-3 text-center align-middle">
                          <div className="flex flex-col gap-3 items-center">
                            <CaptionDialog caption={r.caption || ''} platform={platform} />
                            <SubtitleDialog url={r.url} />
                          </div>
                        </td>
                      )}
                    </tr>
                    
                    {/* YouTube 제목 확장 행 */}
                    {platform === 'youtube' && isExpanded && (
                      <tr className="bg-blue-50 border-b border-gray-200">
                        <td colSpan={8} className="p-4">
                          <div className="text-sm text-gray-800 leading-relaxed space-y-4">
                            {/* 제목 */}
                      <div>
                              <div className="font-medium text-gray-900 mb-2">전체 제목</div>
                              <div className="whitespace-pre-wrap">{r.caption?.split('\n')[0] || '제목 없음'}</div>
                      </div>
                            
                            {/* 구분선 */}
                            <div className="border-t border-gray-200"></div>
                            
                            {/* 설명란 */}
                            <div>
                              <div className="font-medium text-gray-900 mb-2">설명란</div>
                              <div className="whitespace-pre-wrap text-gray-700">
                                {(() => {
                                  const description = (r as any).description || r.caption?.split('\n').slice(1).join('\n') || ''
                                  return description.trim() || <span className="text-gray-400">설명 없음</span>
                                })()}
                              </div>
                            </div>
                            
                            {/* 버튼들 */}
                            <div className="flex gap-3 pt-2">
                              <button 
                                className="px-2 py-1.5 text-xs border rounded hover:bg-neutral-50"
                                onClick={() => {
                                  if (r.url) {
                                    window.open(r.url, '_blank', 'noopener,noreferrer')
                                  }
                                }}
                              >
                                영상 바로가기
                              </button>
                              {/* YouTube일 때만 자막 추출 버튼 표시 */}
                              {platform === 'youtube' && (
                                <SubtitleDialog url={r.url} platform={platform} />
                              )}
                              <button 
                                className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                onClick={() => setExpandedTitleRow(null)}
                              >
                                축소 ▲
                              </button>
                            </div>
                          </div>
                  </td>
                </tr>
                    )}
                  </React.Fragment>
                )
              }) : (
                <tr>
                  <td className="p-12 text-center text-gray-500" colSpan={platform === 'youtube' ? 8 : 9}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="text-lg font-medium text-gray-700">검색 결과가 없습니다</div>
                      <div className="text-sm text-gray-500">상단에서 키워드를 입력하고 검색을 실행해보세요</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <pre className="whitespace-pre-wrap text-xs bg-neutral-50 border border-gray-200 rounded p-3 overflow-auto max-h-[60vh]">
        {raw}
      </pre>
      {progressOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => {}}>
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="text-base font-semibold mb-3">{progressTitle}</div>
            <div className="w-full h-3 bg-neutral-200 rounded">
              <div className="h-3 bg-black rounded" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
            </div>
            <div className="mt-2 text-sm text-neutral-600">{Math.round(progressPercent)}%</div>
            <div className="mt-3 text-xs text-neutral-500">창을 닫지 말아주세요</div>
          </div>
        </div>
      )}

      {/* Saved API Keys Modal */}
      {savedApiKeysOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSavedApiKeysOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-md p-5 max-h-[80vh] overflow-auto" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">저장된 API 키 관리</h2>
              <button 
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setSavedApiKeysOpen(false)}
              >
                ✕
              </button>
            </div>
            
            {/* 새 API 키 추가 */}
            <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-2">새 API 키 추가</div>
              <div className="space-y-2">
                <input 
                  type="text"
                  className="w-full h-8 border border-gray-300 rounded px-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="API 키 이름 (선택사항)"
                  value={newApiKeyName}
                  onChange={(e) => setNewApiKeyName(e.target.value)}
                />
                <div className="flex gap-3">
                  <input 
                    type="text"
                    className="flex-1 h-8 border border-gray-300 rounded px-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="새 API 키를 입력하세요..."
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNewApiKey()}
                  />
                  <button 
                    className="px-3 py-1 text-sm bg-black text-white rounded hover:bg-gray-800"
                    onClick={addNewApiKey}
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>

            {/* 저장된 키 목록 */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">저장된 API 키들</div>
              {savedApiKeys.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">저장된 API 키가 없습니다</div>
              ) : (
                savedApiKeys.map((keyData) => (
                  <div key={keyData.id} className={`flex items-center gap-3 p-3 border rounded ${
                    keyData.is_active ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {keyData.key_name || '이름 없음'}
                        {keyData.is_active && <span className="ml-2 text-xs text-green-600 font-medium">(현재 사용중)</span>}
                      </div>
                      <div className="text-xs font-mono text-gray-500">
                        {keyData.api_key.length > 30 ? `${keyData.api_key.substring(0, 30)}...` : keyData.api_key}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(keyData.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!keyData.is_active && (
                        <button 
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          onClick={() => useApiKey(keyData)}
                        >
                          사용
                        </button>
                      )}
                      <button 
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        onClick={() => deleteApiKey(keyData.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              • 선택한 API 키를 복사하거나 삭제할 수 있습니다.<br/>
              • '사용' 버튼을 누르면 메인 화면의 API 키 입력란에 자동으로 입력됩니다.<br/>
              • 저장된 키는 브라우저에만 저장되며 외부로 전송되지 않습니다.
            </div>
          </div>
        </div>
      )}
      </div>
      
      {/* 본인인증 모달 (비활성화됨) */}
      {/* <VerificationModal
        isOpen={showVerificationModal}
        onClose={handleVerificationClose}
        onSuccess={handleVerificationSuccess}
      /> */}
    </div>
  )
}

// Expandable template picker with 15+ categories and 10 keywords each
function TemplatePicker({ selectedCategory, setSelectedCategory, onPick }: { selectedCategory: string; setSelectedCategory: (v: string)=>void; onPick: (keyword: string)=>void }) {
  const categories: { name: string; keywords: string[] }[] = [
    { name: '카페/디저트', keywords: ['카페','디저트','빵스타그램','카페투어','커피','라떼','브런치','맛집','케이크','스콘'] },
    { name: 'PT/헬스', keywords: ['헬스','pt','다이어트','운동루틴','하체운동','등운동','가슴운동','홈트','스트레칭','체지방'] },
    { name: '교육/스터디', keywords: ['영어공부','공부법','토익','어학연수','자격증','스터디','수학문제','코딩공부','국어공부','메모공부'] },
    { name: '뷰티/헤어', keywords: ['헤어스타일','메이크업','염색','단발','펌','아이메이크업','쿠션추천','립추천','스킨케어','네일아트'] },
    { name: '패션', keywords: ['데일리룩','OOTD','패션','코디','가을코디','겨울패션','운동화추천','원피스','데님','니트'] },
    { name: '로컬서비스', keywords: ['인테리어','이사','청소','수리','목공','타일','조명','커튼','리모델링','셀프인테리어'] },
    { name: '전자상거래', keywords: ['쇼핑추천','가성비템','온라인쇼핑','리뷰','언박싱','인기상품','세일정보','핫딜','생활용품','주방용품'] },
    { name: '여행', keywords: ['여행','국내여행','해외여행','핫플','맛집투어','호캉스','제주도','일본여행','유럽여행','여행코스'] },
    { name: '사진/영상', keywords: ['사진찍는법','영상편집','브이로그','필름카메라','아이폰사진','색보정','룩북','타임랩스','감성사진','튜토리얼'] },
    { name: '반려동물', keywords: ['멍스타그램','냥스타그램','강아지산책','고양이','훈련','간식','미용','유기동물','입양','반려견용품'] },
    { name: '요리/레시피', keywords: ['집밥','레시피','쿠킹','간단요리','다이어트식단','에어프라이어','밀프렙','도시락','브런치','야식'] },
    { name: '부동산/재테크', keywords: ['재테크','부동산','주식','ETF','적금','절약','신용카드','월급관리','사업아이템','사이드잡'] },
    { name: '교육/키즈', keywords: ['육아','키즈카페','놀이교육','동화책','미술놀이','키즈패션','간식만들기','유치원','초등공부','교육정보'] },
    { name: '음악/악기', keywords: ['피아노','기타','보컬','드럼','작곡','연습영상','커버곡','버스킹','음원추천','플레이리스트'] },
    { name: '아웃도어/캠핑', keywords: ['캠핑','백패킹','차박','캠핑용품','등산','하이킹','낚시','불멍','바비큐','캠핑요리'] },
  ]
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white">
      <div className="text-[13px] text-neutral-600 mb-2">카테고리를 선택하면 추천 키워드가 펼쳐집니다.</div>
      <div className="flex flex-wrap gap-3 mb-3">
        {categories.map(c => (
          <button key={c.name} className={`px-3 py-1.5 text-[12px] border border-gray-200 rounded-full transition-colors ${selectedCategory===c.name?'bg-black text-white border-black':'bg-neutral-50 text-neutral-800 hover:border-gray-300'}`} onClick={(e)=>{e.preventDefault(); setSelectedCategory(selectedCategory === c.name ? '' : c.name)}}>{c.name}</button>
        ))}
      </div>
      {selectedCategory && (
        <div className="border-t border-gray-200 pt-3">
          <div className="text-[13px] text-neutral-600 mb-2">추천 키워드</div>
          <div className="flex flex-wrap gap-3">
            {categories.find(c=>c.name===selectedCategory)?.keywords.map(k => (
              <button key={k} className="px-3 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white hover:bg-neutral-50 hover:border-gray-300 transition-colors" onClick={(e)=>{e.preventDefault(); onPick(k)}}>{k}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SortMenu({ sort, setSort }: { sort: 'views' | 'latest' | 'oldest'; setSort: (v: 'views' | 'latest' | 'oldest') => void }) {
  const [open, setOpen] = useState(false)
  const apply = (mode: 'latest' | 'oldest' | 'views') => {
    // only update sort; items is derived via useMemo
    setSort(mode)
    setOpen(false)
  }
  return (
    <div className="relative">
      <button className="px-3 py-1.5 text-sm border rounded hover:border-gray-300 transition-colors" onClick={() => setOpen((v) => !v)}>
        정렬 ({sort === 'views' ? '조회수순' : sort === 'latest' ? '최신' : '오래된'})
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border rounded shadow z-10 text-sm min-w-[140px]">
          <button className="block px-3 py-2 hover:bg-neutral-50 w-full text-left" onClick={() => apply('latest')}>최신 날짜순</button>
          <button className="block px-3 py-2 hover:bg-neutral-50 w-full text-left" onClick={() => apply('oldest')}>오래된 날짜순</button>
          <button className="block px-3 py-2 hover:bg-neutral-50 w-full text-left" onClick={() => apply('views')}>조회수순</button>
        </div>
      )}
    </div>
  )
}

function ClientFilters({ baseItems, setFilters }: { baseItems: SearchRow[]; setFilters: (v: any) => void }) {
  const [open, setOpen] = useState(false)
  // ranges derive from base items (original search result)
  const viewsArr = baseItems.map(i => i.views || 0)
  const followersArr = baseItems.map(i => i.followers || 0)
  const minViews = Math.min(...viewsArr, 0)
  const maxViews = Math.max(...viewsArr, 0)
  const minFollowers = Math.min(...followersArr, 0)
  const maxFollowers = Math.max(...followersArr, 0)
  const dates = baseItems.map(i => i.takenDate ? Date.parse(i.takenDate) : 0).filter(Boolean)
  const minDate = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0,10) : ''
  const maxDate = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0,10) : ''

  const [vMin, setVMin] = useState<number>(minViews)
  const [vMax, setVMax] = useState<number>(maxViews)
  const [fMin, setFMin] = useState<number>(minFollowers)
  const [fMax, setFMax] = useState<number>(maxFollowers)
  const [dMin, setDMin] = useState<string>(minDate)
  const [dMax, setDMax] = useState<string>(maxDate)

  useEffect(() => { setVMin(minViews); setVMax(maxViews); setFMin(minFollowers); setFMax(maxFollowers); setDMin(minDate); setDMax(maxDate) }, [minViews, maxViews, minFollowers, maxFollowers, minDate, maxDate])

  const apply = () => {
    setFilters({ views: [vMin, vMax], followers: [fMin, fMax], date: [dMin, dMax] })
    setOpen(false)
  }
  const reset = () => { setFilters({}); setOpen(false) }
  return (
    <div className="relative">
      <button className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:border-gray-300 transition-colors" onClick={() => setOpen(v => !v)}>필터</button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded shadow z-10 text-sm p-3 w-[20rem] space-y-2">
          <div>
            <div className="mb-1">조회수 범위</div>
            <div className="flex gap-3">
              <CommaInput value={vMin} onChange={setVMin} />
              <CommaInput value={vMax} onChange={setVMax} />
            </div>
          </div>
          <div>
            <div className="mb-1">팔로워 범위</div>
            <div className="flex gap-3">
              <CommaInput value={fMin} onChange={setFMin} />
              <CommaInput value={fMax} onChange={setFMax} />
            </div>
          </div>
          <div>
            <div className="mb-1">업로드 기간</div>
            <div className="flex gap-3">
              <input type="date" className="border rounded px-2 py-1 w-1/2" value={dMin} min={minDate} max={maxDate} onChange={e=>setDMin(e.target.value)} />
              <input type="date" className="border rounded px-2 py-1 w-1/2" value={dMax} min={minDate} max={maxDate} onChange={e=>setDMax(e.target.value)} />
            </div>
            <div className="text-xs text-neutral-500 mt-1">현재 결과의 범위 밖 날짜는 자동으로 제한됩니다.</div>
          </div>
          <div className="flex justify-end gap-3">
            <button className="px-2 py-1 border rounded" onClick={reset}>초기화</button>
            <button className="px-2 py-1 border rounded bg-black text-white" onClick={apply}>적용</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ExportButtons({ items, platform, onProgress }: { items: SearchRow[]; platform: 'instagram' | 'youtube' | 'tiktok'; onProgress: { open: (t:string, i?:number)=>void; tick: (max?:number, step?:number, ms?:number)=>void; finish: (delay?:number)=>void } }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  
  // 새로운 검색 결과가 나올 때 선택 상태 초기화
  useEffect(() => {
    setSelected(new Set())
  }, [items])
  
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window) return
      ;(window as any).__rowSelect = { selected, setSelected }
    } catch (error) {
      console.warn('Failed to set global row select:', error)
    }
  }, [selected])
  const guardSelected = () => {
    if (!selected.size) { alert('선택된 콘텐츠가 없습니다.'); return false }
    return true
  }
  
  // 확인 팝업 함수
  const showConfirmDialog = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
      modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div class="text-lg font-semibold text-gray-800 mb-3">${title}</div>
          <div class="text-sm text-gray-600 mb-6">${message}</div>
          <div class="flex items-center justify-end gap-3">
            <button id="cancel-btn" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">취소</button>
            <button id="confirm-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">확인</button>
          </div>
        </div>
      `
      
      const cancelBtn = modal.querySelector('#cancel-btn')
      const confirmBtn = modal.querySelector('#confirm-btn')
      
      cancelBtn?.addEventListener('click', () => {
        document.body.removeChild(modal)
        resolve(false)
      })
      
      confirmBtn?.addEventListener('click', () => {
        document.body.removeChild(modal)
        resolve(true)
      })
      
      document.body.appendChild(modal)
    })
  }
  const toXlsx = async () => {
    if (!guardSelected()) return
    
    const confirmed = await showConfirmDialog(
      '엑셀 추출',
      `선택된 ${selected.size}개의 콘텐츠를 엑셀 파일로 추출하시겠습니까?`
    )
    if (!confirmed) return
    
    onProgress.open('엑셀을 생성하고 있습니다…', 5)
    onProgress.tick(90, 1, 450)
    const selectedItems = items.filter(i => selected.has(i.url))
    const res = await fetch('/api/export-xlsx', { 
      method: 'POST', 
      headers: { 'content-type': 'application/json' }, 
      body: JSON.stringify({ rows: selectedItems, platform }) 
    })
    if (!res.ok) return alert('엑셀 생성 실패')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    // Content-Disposition 헤더에서 파일명 추출
    const contentDisposition = res.headers.get('content-disposition')
    let filename = `${platform}-data.xlsx` // 기본 파일명
    
    if (contentDisposition) {
      // filename="filename.xlsx" 형태 매칭
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i) || 
                           contentDisposition.match(/filename=([^;\s]+)/i)
      if (filenameMatch && filenameMatch[1]) {
        try {
          filename = decodeURIComponent(filenameMatch[1])
        } catch {
          filename = filenameMatch[1]
        }
      }
    }
    
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    onProgress.finish()
  }
  const downloadVideos = async () => {
    if (!guardSelected()) return
    
    const confirmed = await showConfirmDialog(
      '영상(MP4) 추출',
      `선택된 ${selected.size}개의 영상을 다운로드하시겠습니까?`
    )
    if (!confirmed) return
    
    try {
      onProgress.open('영상을 준비하고 있습니다…', 5)
      onProgress.tick(92, 1, 450)
      
      const selectedItems = items.filter(i => selected.has(i.url))
      let urls: string[] = []
      
      if (platform === 'youtube') {
        // YouTube의 경우 item.url (YouTube URL) 사용
        urls = selectedItems.map(i => i.url).filter(u => typeof u === 'string' && u.includes('youtube.com'))
      } else {
        // Instagram/TikTok의 경우 videoUrl 사용
        urls = selectedItems.map(i => (i as any).videoUrl).filter(u => typeof u === 'string' && u.startsWith('http'))
      }
      
      if (!urls.length) {
        alert('다운로드 가능한 영상 URL이 없습니다')
        return
      }
      
    const res = await fetch('/api/downloads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ urls }) })
      if (!res.ok) {
        const errorText = await res.text()
        alert(`영상 다운로드 실패: ${errorText}`)
        return
      }
      
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
      
      // 날짜와 플랫폼별 파일명 생성
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
      const platformNames = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram'
      }
      const platformName = platformNames[platform] || 'Reelcher'
      
      a.download = urls.length === 1 ? 
        `${platformName}_영상_${dateStr}.mp4` : 
        `${platformName}_영상모음_${dateStr}.zip`
    a.click()
    URL.revokeObjectURL(url)
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('영상 다운로드 중 오류가 발생했습니다')
    } finally {
      // 성공/실패와 관계없이 항상 로딩 상태 종료
      onProgress.finish()
    }
  }



    const downloadThumbnails = async () => {
    if (!guardSelected()) return
    
    const confirmed = await showConfirmDialog(
      '썸네일 추출',
      `선택된 ${selected.size}개의 썸네일을 다운로드하시겠습니까?`
    )
    if (!confirmed) return
    
    try {
      onProgress.open('썸네일을 준비하고 있습니다…', 5)
      onProgress.tick(85, 1, 300)
      
      const selectedItems = items.filter(i => selected.has(i.url))
      
      if (selectedItems.length === 1) {
        // 단일 썸네일 다운로드
        const item = selectedItems[0]
        const thumbnailUrl = item.thumbnailUrl
        
        if (!thumbnailUrl) {
          alert('썸네일 URL이 없습니다')
          return
        }
        
        // 썸네일 다운로드 (쇼츠인 경우 특별 처리)
        const isShorts = item.isShorts === true
        let downloadUrl = `/api/image-proxy?src=${encodeURIComponent(thumbnailUrl)}&download=true`
        
        // YouTube 쇼츠인 경우 세로형 비율 파라미터 추가
        if (platform === 'youtube' && isShorts) {
          downloadUrl += '&shorts=true'
        }
        
        const response = await fetch(downloadUrl)
        
        if (!response.ok) {
          alert('썸네일 다운로드 실패')
          return
        }
        
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // 날짜와 플랫폼별 썸네일 파일명 생성
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
        const platformNames = {
          youtube: 'YouTube',
          tiktok: 'TikTok',
          instagram: 'Instagram'
        }
        const platformName = platformNames[platform] || 'Reelcher'
        
        a.download = `${platformName}_썸네일_${dateStr}.png`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // 다중 썸네일 ZIP 다운로드
        const thumbnailUrls = selectedItems
          .map(item => item.thumbnailUrl)
          .filter(url => url && typeof url === 'string')
        
        if (!thumbnailUrls.length) {
          alert('다운로드 가능한 썸네일이 없습니다')
          return
        }
        
        const res = await fetch('/api/downloads/thumbnails', { 
          method: 'POST', 
          headers: { 'content-type': 'application/json' }, 
          body: JSON.stringify({ urls: thumbnailUrls, platform }) 
        })
        
        if (!res.ok) {
          const errorText = await res.text()
          alert(`썸네일 다운로드 실패: ${errorText}`)
          return
        }
        
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // 날짜와 플랫폼별 썸네일 ZIP 파일명 생성
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
        const platformNames = {
          youtube: 'YouTube',
          tiktok: 'TikTok',
          instagram: 'Instagram'
        }
        const platformName = platformNames[platform] || 'Reelcher'
        
        a.download = `${platformName}_썸네일모음_${dateStr}.zip`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('썸네일 다운로드 오류:', error)
      alert('썸네일 다운로드 중 오류가 발생했습니다')
    } finally {
      onProgress.finish()
    }
  }

  const openLinks = () => {
    if (!guardSelected()) return
    const urls = items.filter(i => selected.has(i.url)).map(i => i.url)
    if (typeof window !== 'undefined') urls.forEach(u => window.open(u, '_blank'))
  }
  return (
    <div className="flex items-center gap-1.5">
      <button className="px-3 py-1.5 text-sm border rounded" onClick={openLinks}>영상 바로가기</button>
      <button className="px-3 py-1.5 text-sm border rounded" onClick={toXlsx}>엑셀 추출</button>
      <button className="px-3 py-1.5 text-sm border rounded" onClick={downloadThumbnails}>썸네일 추출</button>
      <button className="px-3 py-1.5 text-sm border rounded" onClick={downloadVideos}>영상(mp4) 추출</button>
    </div>
  )
}

function RowCheck({ url, index }: { url: string; index: number }) {
  const [isChecked, setIsChecked] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  
  // 전역 선택 상태와 동기화
  useEffect(() => {
    if (typeof window === 'undefined') return
    const api = (window as any).__rowSelect as { selected?: Set<string> } | undefined
    setIsChecked(!!api?.selected?.has?.(url))
  }, [url, forceUpdate])
  
  // 전역 상태 변경 감지를 위한 리스너 설정
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleGlobalUpdate = () => setForceUpdate(prev => prev + 1)
    window.addEventListener('rowSelectUpdate', handleGlobalUpdate)
    return () => window.removeEventListener('rowSelectUpdate', handleGlobalUpdate)
  }, [])
  
  const handleToggle = (checked: boolean, shiftKey = false) => {
    // 즉시 로컬 상태 업데이트
    setIsChecked(checked)
    
    // 전역 상태 업데이트
    try {
      if (typeof window === 'undefined' || !window) return
      const api = (window as any).__rowSelect as { selected?: Set<string>; setSelected?: any; lastSelectedIndex?: number }
    if (!api) return
      
      if (shiftKey && api.lastSelectedIndex !== undefined) {
        // Shift 다중선택
        const currentItems = (window as any).__currentPageItems as SearchRow[] || []
        const startIdx = Math.min(api.lastSelectedIndex, index)
        const endIdx = Math.max(api.lastSelectedIndex, index)
      
      if (typeof api.setSelected === 'function') {
        api.setSelected((prev: Set<string>) => {
          const next = new Set(prev || [])
          for (let i = startIdx; i <= endIdx; i++) {
            if (currentItems[i]?.url) {
              next.add(currentItems[i].url)
            }
          }
          return next
        })
      }
    } else {
      // 일반 선택
      if (typeof api.setSelected === 'function') {
        api.setSelected((prev: Set<string>) => {
          const next = new Set(prev || [])
          if (checked) next.add(url); else next.delete(url)
          return next
        })
      } else if (api.selected) {
    if (checked) api.selected.add(url); else api.selected.delete(url)
      }
    }
    
      // 마지막 선택 인덱스 업데이트
      if (checked) {
        api.lastSelectedIndex = index
      }
      
      // 전역 상태 변경 이벤트 발생
      window.dispatchEvent(new CustomEvent('rowSelectUpdate'))
    } catch (error) {
      console.warn('Failed to handle row selection:', error)
    }
  }
  
  return (
    <div 
      onClick={(e) => {
        e.stopPropagation()
        handleToggle(!isChecked, e.shiftKey)
      }} 
      className="flex items-center justify-center cursor-pointer"
    >
      <Checkbox 
        checked={isChecked} 
        className="w-5 h-5 border-2 border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 pointer-events-none"
      />
    </div>
  )
}

function CaptionDialog({ caption, platform }: { caption: string; platform: 'youtube' | 'tiktok' | 'instagram' }) {
  const [open, setOpen] = useState(false)
  
  const buttonText = platform === 'youtube' ? '설명란 확인' : '캡션 확인'
  const modalTitle = platform === 'youtube' ? '설명란' : '캡션'
  
  return (
    <>
      <button className="px-2 py-1.5 text-xs border rounded hover:bg-neutral-50" onClick={() => setOpen(true)}>
        {buttonText}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg max-w-xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">{modalTitle}</h2>
              <div className="flex items-center gap-3">
                <button className="text-xs px-2 py-1 border rounded" onClick={() => { navigator.clipboard.writeText(caption || ''); alert('복사되었습니다') }}>복사</button>
                <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-left max-h-[60vh] overflow-auto">{caption || '-'}</div>
          </div>
        </div>
      )}
    </>
  )
}

function SubtitleDialog({ url, platform }: { url: string; platform?: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  // simple in-memory cache per URL
  const cache = (globalThis as any).__subtitleCache || ((globalThis as any).__subtitleCache = new Map<string, string>())
  const showCreditModal = (message = '자막 추출에는 크레딧이 필요해요. 업그레이드 또는 충전 후 다시 시도해 주세요.') => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
    modal.innerHTML = `
      <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
        <div class="text-base font-semibold mb-3">크레딧 부족</div>
        <div class="text-sm text-neutral-700">${message}</div>
        <div class="flex items-center justify-end gap-3 mt-4">
          <button id="cnl" class="px-3 py-1.5 text-sm border rounded">닫기</button>
          <a id="go" class="px-3 py-1.5 text-sm border rounded bg-black text-white" href="/pricing">업그레이드/충전</a>
        </div>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('#cnl')?.addEventListener('click', () => modal.remove())
  }

  const showCooldownModal = () => {
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4'
    modal.innerHTML = `
      <div class="bg-white rounded shadow-lg w-full max-w-md p-5">
        <div class="text-base font-bold mb-3">잠시만 기다려주세요!</div>
        <div class="text-sm text-neutral-700 mb-4">과부하 방지를 위해, 자막 추출은 30초 단위로 가능해요.</div>
        <div class="flex items-center justify-center">
          <button id="confirm" class="px-4 py-2 text-sm border rounded bg-black text-white">확인</button>
        </div>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('#confirm')?.addEventListener('click', () => modal.remove())
  }
  const ensureCredits = async (): Promise<boolean> => {
    try {
      // 크레딧 정보를 더 정확하게 가져오기 (reserved 고려)
      const res = await fetch('/api/me?scope=credits-detail', { cache: 'no-store' })
      if (!res.ok) return false
      const j = await res.json().catch(() => ({}))
      
      // balance와 reserved를 모두 고려한 사용 가능 크레딧 계산
      const balance = Number(j?.balance || 0)
      const reserved = Number(j?.reserved || 0)
      const availableCredits = balance - reserved
      
      const requiredCredits = platform === 'youtube' ? 10 : 20
      const platformName = platform === 'youtube' ? 'YouTube' : (platform === 'tiktok' ? 'TikTok' : 'Instagram')
      
      console.log(`🔍 자막 추출 크레딧 체크: 잔액=${balance}, 예약=${reserved}, 사용가능=${availableCredits}, 필요=${requiredCredits}, 플랫폼=${platformName}`)
      
      if (!Number.isFinite(availableCredits) || availableCredits < requiredCredits) { 
        console.warn(`❌ 크레딧 부족: 사용가능=${availableCredits}, 필요=${requiredCredits}`)
        showCreditModal(`${platformName} 자막 추출에는 ${requiredCredits} 크레딧이 필요해요. 업그레이드 또는 충전 후 다시 시도해 주세요.`); 
        return false 
      }
      console.log(`✅ 크레딧 충분: 사용가능=${availableCredits}, 필요=${requiredCredits}`)
      return true
    } catch (error) {
      console.error('❌ 크레딧 체크 오류:', error)
      return false
    }
  }
  const load = async () => {
    if (!url) { alert('영상 URL이 없습니다'); return }
    // if cached, show immediately
    if (cache.has(url)) {
      setText(cache.get(url) || '')
      setOpen(true)
      return
    }
    setLoading(true)
    // tie into page-level overlay via DOM events
    document.body.dispatchEvent(new CustomEvent('relcher:progress', { detail: { action: 'open', title: '자막을 추출하고 있습니다…' } }))
    document.body.dispatchEvent(new CustomEvent('relcher:progress', { detail: { action: 'tick', max: 92, step: 2, ms: 250 } }))
    try {
      // YouTube와 다른 플랫폼에 따라 다른 API 사용
      const apiEndpoint = platform === 'youtube' ? '/api/youtube/subtitles' : '/api/captions'
      const res = await fetch(apiEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        let errorMessage = '자막 추출 실패'
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.error === 'SUBTITLE_COOLDOWN') {
            showCooldownModal()
            return
          }
          errorMessage = errorJson.error || errorMessage
        } catch {
          // JSON 파싱 실패시 기본 메시지 사용
        }
        throw new Error(errorMessage)
      }
      
      const j = await res.json()
      const t = (platform === 'youtube' ? j?.subtitles : j?.captions) || ''
      cache.set(url, t)
      setText(t)
      setOpen(true)
    } catch (e: any) {
      console.error('자막 추출 오류:', e)
      const errorMessage = e?.message || '자막 추출 실패'
      alert(errorMessage)
    } finally {
      setLoading(false)
      document.body.dispatchEvent(new CustomEvent('relcher:progress', { detail: { action: 'finish' } }))
    }
  }
  return (
    <>
      <button
        className="px-2 py-1.5 text-xs border rounded hover:bg-neutral-50"
        onClick={() => { if (cache.has(url)) { setText(cache.get(url) || ''); setOpen(true); } else { setConfirmOpen(true) } }}
        disabled={loading}
      >
        {loading ? '추출 중…' : (cache.has(url) ? '자막 확인' : '자막 추출')}
      </button>
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-md p-4" onClick={(e)=>e.stopPropagation()}>
            <div className="text-sm text-left">
              음성이 없는 영상의 경우 빈 값이 출력될 수 있습니다. 먼저 음성이 있는 영상인지 확인해주세요.
            </div>
            <div className="flex items-center justify-end gap-3 mt-4">
              <button className="px-3 py-1 border rounded" onClick={()=>setConfirmOpen(false)}>취소</button>
              <button className="px-3 py-1 border rounded bg-black text-white" onClick={async ()=>{ const ok = await ensureCredits(); if (!ok) return; setConfirmOpen(false); load(); }}>추출 (20크레딧)</button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg max-w-xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium">자막</h2>
              <div className="flex items-center gap-3">
                <button className="text-xs px-2 py-1 border rounded" onClick={() => { navigator.clipboard.writeText(text || ''); alert('복사되었습니다') }}>복사</button>
                <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
              </div>
            </div>
            <div className="text-sm whitespace-pre-wrap text-left max-h-[60vh] overflow-auto">{text || '-'}</div>
          </div>
        </div>
      )}
    </>
  )
}

// Button that opens a modal preview with robust fallbacks (image → derived jpg → looping video)
function PreviewThumbButton({ row, videoDuration }: { row: any; videoDuration?: 'any' | 'short' | 'long' }) {
  const [open, setOpen] = useState(false)
  const warmup = () => {
    const src = buildInitialPreviewSrc(row)
    if (src) preloadImage(src)
  }
  return (
    <>
      <button className="px-2 py-1 text-xs border rounded hover:bg-neutral-50" onMouseEnter={warmup} onClick={() => setOpen(true)}>썸네일 보기</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-lg w-full max-w-[420px] p-3" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-medium text-sm">미리보기</h2>
              <button className="text-sm text-neutral-600" onClick={() => setOpen(false)}>닫기</button>
            </div>
            <PreviewContent row={row} videoDuration={videoDuration} />
          </div>
        </div>
      )}
    </>
  )
}

// warm up cache for an image URL using Image() loader
const __imgCache: Record<string, boolean> = (globalThis as any).__imgCache || ((globalThis as any).__imgCache = {})
function preloadImage(src: string) {
  if (!src || __imgCache[src]) return
  const img = new Image()
  img.onload = () => { __imgCache[src] = true }
  img.onerror = () => { /* ignore; modal fallback will handle */ }
  // add a small cache-bust the first time to avoid stale 404s from intermediary caches
  const url = new URL(src, location.origin)
  if (!url.searchParams.has('pre')) url.searchParams.set('pre', Date.now().toString(36))
  img.src = url.toString()
}

function ensurePreconnect(href: string) {
  try {
    const id = `preconnect-${href}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preconnect'
    link.href = href
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch {}
}

function CommaInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState<string>(new Intl.NumberFormat('en-US').format(value || 0))
  useEffect(() => { setText(new Intl.NumberFormat('en-US').format(value || 0)) }, [value])
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    
    // 빈 문자열인 경우
    if (input === '') {
      setText('')
      onChange(0)
      return
    }
    
    // 숫자와 콤마만 허용
    const numericOnly = input.replace(/[^0-9,]/g, '')
    
    // 콤마 제거하고 숫자로 변환
    const raw = numericOnly.replace(/,/g, '')
    const num = Number(raw)
    
    if (Number.isFinite(num) && num >= 0) {
      onChange(num)
      // 숫자가 0이 아닐 때만 콤마 포맷팅
      if (num > 0) {
        setText(new Intl.NumberFormat('en-US').format(num))
      } else {
        setText('')
      }
    } else {
      // 잘못된 입력인 경우 이전 값 유지
      setText(text)
    }
  }
  return <input inputMode="numeric" pattern="[0-9,]*" className="border rounded px-2 py-1 w-1/2 text-right" value={text} onChange={onInput} />
}

// YouTube 필터용 숫자 입력 컴포넌트 (천단위 콤마, 숫자만 입력)
function NumberInput({ value, onChange, placeholder, className }: { 
  value: number; 
  onChange: (v: number) => void; 
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState<string>('')

  useEffect(() => {
    // value가 0이 아닐 때만 포맷팅해서 표시
    if (value && value > 0) {
      setText(new Intl.NumberFormat('en-US').format(value))
    } else {
      setText('')
    }
  }, [value])

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    
    // 빈 문자열인 경우
    if (input === '') {
      setText('')
      onChange(0)
      return
    }
    
    // 숫자와 콤마만 허용
    const numericOnly = input.replace(/[^0-9,]/g, '')
    
    // 콤마 제거하고 숫자로 변환
    const raw = numericOnly.replace(/,/g, '')
    const num = Number(raw)
    
    if (Number.isFinite(num) && num >= 0) {
      onChange(num)
      // 숫자가 0이 아닐 때만 콤마 포맷팅
      if (num > 0) {
        setText(new Intl.NumberFormat('en-US').format(num))
      } else {
        setText('')
      }
    } else {
      // 잘못된 입력인 경우 이전 값 유지
      setText(text)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 허용된 키: 숫자, 백스페이스, 삭제, 탭, 화살표 키
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    const isNumber = e.key >= '0' && e.key <= '9'
    
    if (!isNumber && !allowedKeys.includes(e.key)) {
      e.preventDefault()
    }
  }

  return (
    <input 
      inputMode="numeric" 
      pattern="[0-9,]*" 
      className={className || "w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 transition-all bg-white"} 
      value={text} 
      onChange={onInput}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
    />
  )
}

// ErrorBoundary로 감싼 메인 컴포넌트 export
export default function SearchTestPage() {
  return (
    <ErrorBoundary>
      <SearchTestPageContent />
    </ErrorBoundary>
  )
}


