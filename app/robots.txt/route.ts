import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const robotsContent = `User-agent: Yeti
Allow: /
Allow: /pricing
Allow: /faq
Allow: /privacy
Allow: /terms
Allow: /contact
Allow: /*.css
Allow: /*.js
Allow: /favicon.ico
Allow: /logo.svg
Disallow: /dashboard
Disallow: /search-test
Disallow: /onboarding
Disallow: /sign-in
Disallow: /admin
Disallow: /api

User-agent: *
Allow: /
Allow: /pricing
Allow: /faq
Allow: /privacy
Allow: /terms
Allow: /contact
Allow: /*.css
Allow: /*.js
Allow: /favicon.ico
Allow: /logo.svg
Disallow: /dashboard
Disallow: /search-test
Disallow: /onboarding
Disallow: /sign-in
Disallow: /admin
Disallow: /api
Disallow: /_next

User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

Sitemap: https://reelcher.com/sitemap.xml`

  return new NextResponse(robotsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      // Content-Disposition 헤더를 명시적으로 설정하지 않음 (네이버 가이드 준수)
    },
  })
}
