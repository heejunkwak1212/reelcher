import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://reelcher.com'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pricing',
          '/faq',
          '/privacy',
          '/terms',
          '/contact',
        ],
        disallow: [
          '/dashboard',
          '/search-test',
          '/onboarding',
          '/sign-in',
          '/admin',
          '/api',
          '/_next',
          '/api/*',
          '/*?*', // 쿼리 파라미터가 있는 페이지는 제외
        ],
      },
      {
        userAgent: 'Yeti', // 네이버 검색봇
        allow: [
          '/',
          '/pricing',
          '/faq',
          '/privacy',
          '/terms',
          '/contact',
          '/*.css',   // CSS 파일 허용 (네이버 가이드 권장)
          '/*.js',    // JavaScript 파일 허용
          '/favicon.ico', // 파비콘 명시적 허용
          '/logo.svg',    // 로고 파일 허용
        ],
        disallow: [
          '/dashboard',
          '/search-test',
          '/onboarding', 
          '/sign-in',
          '/admin',
          '/api',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/', // AI 크롤러 차단
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'PerplexityBot',
        disallow: '/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
