import { Metadata } from 'next'

// 공통 메타데이터 타입 정의
export interface PageMetadata {
  title: string
  description: string
  path: string
  image?: string
  noIndex?: boolean
}

// 기본 도메인 설정
const DOMAIN = 'https://reelcher.com'

// 페이지별 메타데이터 생성 함수
export function createPageMetadata({
  title,
  description,
  path,
  image = '/og-image.png',
  noIndex = false
}: PageMetadata): Metadata {
  const url = `${DOMAIN}${path}`
  
  return {
    title,
    description,
    
    // Open Graph
    openGraph: {
      title,
      description,
      url,
      siteName: 'Reelcher',
      locale: 'ko_KR',
      type: 'website',
      images: [
        {
          url: `${DOMAIN}${image}`,
          width: 1200,
          height: 630,
          alt: title,
        }
      ],
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: '@reelcher',
      images: [`${DOMAIN}${image}`],
    },

    // 캐노니컬 URL
    alternates: {
      canonical: url,
    },

    // 로봇 설정
    robots: noIndex ? 'noindex,nofollow' : 'index,follow',
  }
}

// 미리 정의된 페이지 메타데이터
export const pageMetadata = {
  home: createPageMetadata({
    title: '릴처: 릴스 검색 사이트 | 틱톡 유튜브 다운로드',
    description: '릴스, 틱톡, 유튜브 검색을 한번에, 인스타그램 릴스, 틱톡, 유튜브 쇼츠를 쉽게 검색하고 다운로드할 수 있는 사이트예요.',
    path: '',
  }),

  dashboard: createPageMetadata({
    title: '대시보드 | 릴처',
    description: '나의 검색 기록, 크레딧 사용량, 분석 결과를 한눈에 확인해보세요.',
    path: '/dashboard',
    noIndex: true, // 개인 대시보드는 검색엔진에 노출하지 않음
  }),

  search: createPageMetadata({
    title: '릴처 | 릴스 틱톡 유튜브 검색',
    description: '릴스 검색, 틱톡 검색, 유튜브 쇼츠 검색을 한 곳에서! 키워드로 쉽게 찾고 다운로드까지 해보세요.',
    path: '/search-test',
  }),

  pricing: createPageMetadata({
    title: '요금제 | 릴처',
    description: '릴처의 요금제를 확인해보세요. 릴스, 틱톡, 유튜브 검색과 다운로드 기능을 무료부터 프리미엄까지 다양한 플랜으로 이용할 수 있어요.',
    path: '/pricing',
  }),

  contact: createPageMetadata({
    title: '문의하기 | 릴처',
    description: '릴처 서비스 이용 중 궁금한 점이나 문의사항이 있으시면 언제든 연락해주세요. 빠른 시간 내에 친절하게 답변드릴게요.',
    path: '/contact',
    noIndex: true,
  }),

  privacy: createPageMetadata({
    title: '개인정보처리방침 | 릴처',
    description: '릴처의 개인정보 수집, 이용, 보관에 관한 정책을 확인해보세요. 사용자의 개인정보 보호를 위한 릴처의 정책을 안내해드려요.',
    path: '/privacy',
  }),

  terms: createPageMetadata({
    title: '이용약관 | 릴처',
    description: '릴처 서비스 이용에 관한 약관과 규정을 확인해보세요. 안전하고 올바른 서비스 이용을 위한 가이드라인을 제공해드려요.',
    path: '/terms',
  }),

  faq: createPageMetadata({
    title: '자주 묻는 질문 | 릴처',
    description: '릴처 이용 시 자주 묻는 질문과 답변을 확인해보세요. 릴스, 틱톡, 유튜브 검색 및 다운로드 관련 궁금증을 해결해드릴게요.',
    path: '/faq',
  }),

  signIn: createPageMetadata({
    title: '로그인 | 릴처',
    description: '릴처에 로그인하여 더 많은 기능을 이용해보세요. 릴스, 틱톡, 유튜브 검색 및 다운로드 서비스를 시작해보세요.',
    path: '/sign-in',
    noIndex: true,
  }),

  onboarding: createPageMetadata({
    title: '시작하기 | 릴처',
    description: '릴처 서비스를 시작하기 위한 간단한 설정을 완료해보세요. 맞춤형 서비스 이용을 위한 초기 설정을 진행해드려요.',
    path: '/onboarding',
    noIndex: true,
  }),
}

// 다이나믹 메타데이터 생성 함수들
export function createSearchResultMetadata(keyword: string, resultCount: number): Metadata {
  return createPageMetadata({
    title: `"${keyword}" 검색 결과 | 릴처`,
    description: `"${keyword}" 키워드로 검색한 ${resultCount}개의 릴스, 틱톡, 유튜브 쇼츠 결과를 확인해보세요.`,
    path: `/search-test?q=${encodeURIComponent(keyword)}`,
  })
}

export function createBlogPostMetadata(title: string, description: string, slug: string): Metadata {
  return createPageMetadata({
    title,
    description,
    path: `/blog/${slug}`,
    image: `/blog/${slug}/og-image.png`,
  })
}

// JSON-LD 구조화 데이터 생성 함수
export function generateOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Reelcher',
    description: '릴스 검색 사이트, 틱톡 검색 사이트, 유튜브 검색 사이트',
    url: 'https://reelcher.com',
    logo: 'https://reelcher.com/logo.svg',
    sameAs: [
      // 소셜 미디어 링크가 있다면 추가
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'support@reelcher.com',
    },
  }
}

export function generateWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Reelcher',
    description: '릴스 검색 사이트, 틱톡 검색 사이트, 유튜브 검색을 한번에 이용할 수 있는 플랫폼입니다.',
    url: 'https://reelcher.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://reelcher.com/search-test?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
    mainEntity: {
      '@type': 'WebApplication',
      name: '릴처',
      applicationCategory: 'Social Media Analysis',
      operatingSystem: 'Web Browser',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'KRW',
        description: '무료 플랜 제공'
      }
    }
  }
}

// 네이버 특화 구조화 데이터 생성
export function generateNaverOptimizedJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '릴처',
    description: '릴스 검색, 틱톡 검색, 유튜브 쇼츠 검색을 한 곳에서 이용할 수 있는 SNS 콘텐츠 분석 플랫폼',
    url: 'https://reelcher.com',
    applicationCategory: 'Social Media Tools',
    operatingSystem: 'Web',
    author: {
      '@type': 'Organization',
      name: 'Reelcher Team'
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock'
    },
    featureList: [
      '인스타그램 릴스 검색',
      '틱톡 영상 검색',
      '유튜브 쇼츠 검색',
      '영상 다운로드',
      '데이터 분석',
      '엑셀 내보내기'
    ],
    screenshot: 'https://reelcher.com/dash.png',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150'
    }
  }
}
