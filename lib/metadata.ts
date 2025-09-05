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
    description: '릴스 검색 사이트, 틱톡 검색 사이트, 유튜브 검색 사이트를 한번에! 인스타그램 릴스, 틱톡, 유튜브 쇼츠를 쉽게 검색하고 다운로드할 수 있는 무료 사이트입니다.',
    path: '',
  }),

  dashboard: createPageMetadata({
    title: '대시보드',
    description: '나의 검색 기록, 크레딧 사용량, 분석 결과를 한눈에 확인하세요.',
    path: '/dashboard',
    noIndex: true, // 개인 대시보드는 검색엔진에 노출하지 않음
  }),

  search: createPageMetadata({
    title: '릴스 틱톡 유튜브 검색',
    description: '릴스 검색, 틱톡 검색, 유튜브 쇼츠 검색을 한번에! 키워드로 쉽게 찾고 다운로드하세요.',
    path: '/search-test',
  }),

  pricing: createPageMetadata({
    title: '릴스 검색 사이트 요금제',
    description: '릴스 검색 사이트 릴처의 요금제를 확인하세요. 무료로 릴스, 틱톡, 유튜브 검색과 다운로드를 이용할 수 있습니다.',
    path: '/pricing',
  }),

  contact: createPageMetadata({
    title: '릴스 검색 사이트 문의하기',
    description: '릴스 검색 사이트 릴처 이용 중 궁금한 점이나 문의사항이 있으시면 언제든 연락주세요.',
    path: '/contact',
    noIndex: true,
  }),

  privacy: createPageMetadata({
    title: '릴스 검색 사이트 개인정보처리방침',
    description: '릴스 검색 사이트 릴처의 개인정보 수집, 이용, 보관에 관한 정책을 확인하세요.',
    path: '/privacy',
  }),

  terms: createPageMetadata({
    title: '릴스 검색 사이트 이용약관',
    description: '릴스 검색 사이트 릴처 서비스 이용에 관한 약관과 규정을 확인하세요.',
    path: '/terms',
  }),

  faq: createPageMetadata({
    title: '릴스 검색 사이트 자주 묻는 질문',
    description: '릴스 검색 사이트, 틱톡 검색 사이트, 유튜브 검색 사이트 이용 시 자주 묻는 질문과 답변을 확인하세요.',
    path: '/faq',
  }),

  signIn: createPageMetadata({
    title: '로그인',
    description: 'Reelcher에 로그인하여 더 많은 기능을 이용하세요.',
    path: '/sign-in',
    noIndex: true,
  }),

  onboarding: createPageMetadata({
    title: '시작하기',
    description: 'Reelcher 서비스를 시작하기 위한 간단한 설정을 완료하세요.',
    path: '/onboarding',
    noIndex: true,
  }),
}

// 다이나믹 메타데이터 생성 함수들
export function createSearchResultMetadata(keyword: string, resultCount: number): Metadata {
  return createPageMetadata({
    title: `"${keyword}" 검색 결과`,
    description: `"${keyword}" 키워드로 검색한 ${resultCount}개의 릴스, 틱톡, 유튜브 쇼츠 결과를 확인하세요.`,
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
    description: '릴스 검색 사이트, 틱톡 검색 사이트, 유튜브 검색 사이트를 한번에 이용할 수 있는 무료 사이트',
    url: 'https://reelcher.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://reelcher.com/search-test?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }
}
