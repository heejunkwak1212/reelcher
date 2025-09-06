import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { defaultCsp } from '@/lib/csp'
import ThemeProvider from '@/components/ThemeProvider'
import { siteBusiness } from '@/lib/site'
import ErrorBoundary from '@/components/ErrorBoundary'
import SupabaseProvider from '@/components/providers/SupabaseProvider'
import { RelcherDialogProvider } from '@/components/ui/relcher-dialog'
import { supabaseServer } from '@/lib/supabase/server'

// 전역 에러 핸들링
if (typeof window !== 'undefined') {
  // Unhandled Promise Rejection 핸들링
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason, event.promise);
    // 기본 브라우저 경고 방지
    event.preventDefault();
  });

  // Uncaught Error 핸들링
  window.addEventListener('error', (event) => {
    console.error('🚨 Uncaught Error:', event.error, event.message, event.filename, event.lineno);
  });

  // React Error Boundary에서 잡히지 않는 에러들을 위한 추가 핸들링
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Promise rejection 관련 에러들을 필터링
    if (args.some(arg => typeof arg === 'string' && arg.includes('Unhandled promise rejection'))) {
      console.warn('🎯 Promise rejection detected:', args);
    }
    originalConsoleError.apply(console, args);
  };
}

// Ensure this layout renders on the Node runtime to avoid edge manifest issues
export const runtime = 'nodejs'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  title: {
    default: "릴처: 릴스 틱톡 유튜브 검색 벤치마킹 솔루션",
    template: "%s | 릴처"
  },
  description: "릴스 검색, 틱톡 검색, 유튜브 쇼츠 검색을 한 곳에서! 인스타그램 릴스, 틱톡, 유튜브 쇼츠를 쉽게 검색하고 다운로드할 수 있는 서비스입니다.",
  keywords: [
    "릴스 검색 사이트", "릴스 다운로드 사이트", "틱톡 검색 사이트", "유튜브 검색 사이트",
    "인스타그램 릴스 검색", "틱톡 다운로드", "유튜브 쇼츠 검색", "릴스 검색",
    "틱톡 검색", "유튜브 검색", "무료 다운로드 사이트", "동영상 검색 사이트",
    "릴스 다운로드", "바이럴 영상 검색", "릴스 사이트", "틱톡 사이트"
  ],
  authors: [{ name: 'Reelcher Team', url: 'https://reelcher.com' }],
  creator: 'Reelcher',
  publisher: 'Reelcher',
  applicationName: 'Reelcher',
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/logo.svg', type: 'image/svg+xml', sizes: 'any' }
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      { url: '/logo.svg', sizes: '180x180', type: 'image/svg+xml' },
      { url: '/logo.svg', sizes: '152x152', type: 'image/svg+xml' },
      { url: '/logo.svg', sizes: '120x120', type: 'image/svg+xml' }
    ],
    other: [
      {
        rel: 'icon',
        url: '/logo.svg',
        type: 'image/svg+xml',
        sizes: 'any',
      },
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#000000',
      }
    ]
  },
  manifest: '/site.webmanifest',

  // Open Graph
  openGraph: {
    title: '릴처: SNS 벤치마킹 콘텐츠 검색 분석',
    description: '릴스, 틱톡, 유튜브 콘텐츠를 검색 한 번으로 주요 지표까지 확인하고 각종 데이터까지 추출해보세요.',
    url: 'https://reelcher.com',
    siteName: '릴처',
    locale: 'ko_KR',
    type: 'website',
    images: [
      {
        url: 'https://reelcher.com/og-image.png',
        width: 1200,
        height: 630,
        alt: '릴처 - 릴스, 틱톡, 유튜브 쇼츠 검색 사이트',
      },
      {
        url: 'https://reelcher.com/logo.svg',
        width: 512,
        height: 512,
        alt: '릴처 로고',
      }
    ],
  },

  // Twitter Card
  twitter: {
    card: 'summary_large_image',
    title: '릴처: SNS 벤치마킹 콘텐츠 검색 분석',
    description: '릴스, 틱톡, 유튜브 콘텐츠를 검색 한 번으로 주요 지표까지 확인하고 각종 데이터까지 추출해보세요.',
    creator: '@reelcher',
    images: ['https://reelcher.com/og-image.png'],
  },

  // 검색엔진 최적화
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 대체 URL (다국어/모바일 등)
  alternates: {
    canonical: 'https://reelcher.com',
    languages: {
      'ko-KR': 'https://reelcher.com',
      'en-US': 'https://reelcher.com/en',
    },
  },

  // 카테고리 및 분류
  category: 'technology',
  
  // 형식 감지 비활성화 (모바일에서 자동 링크 생성 방지)
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  
  // 추가 메타 태그 (네이버 + 구글 + 모바일 최적화)
  other: {
    // Apple 모바일 웹앱 설정
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Reelcher',
    
    // 네이버 검색 최적화
    'naver-site-verification': process.env.NAVER_SITE_VERIFICATION || '',
    'NaverBot': 'All',
    'Yeti': 'All', // 네이버 검색로봇 추가 허용
    
    // 추가 검색엔진 최적화
    'msapplication-TileColor': '#ffffff',
    'theme-color': '#ffffff',
    
    // 소셜 미디어 최적화  
    'fb:app_id': '123456789',
    
    // 강제 캐시 무효화를 위한 타임스탬프
    'cache-version': `2024-12-19-v3-${Date.now()}`,
    'last-modified': new Date().toISOString(),
    
    // 네이버 검색 결과 개선을 위한 추가 태그
    'subject': '릴스 검색 사이트, 틱톡 검색 사이트, 유튜브 검색',
    'classification': 'Technology, Social Media, Content Analysis',
    'reply-to': 'reelcher1@gmail.com',
    'distribution': 'global',
    'rating': 'general',
    
    // 네이버 특화 메타태그 추가
    'content-language': 'ko-KR',
    'geo.region': 'KR',
    'geo.country': 'South Korea',
    'DC.language': 'ko',
    'DC.title': '릴처: 릴스 틱톡 유튜브 검색 벤치마킹 솔루션',
    'DC.creator': 'Reelcher Team',
    'DC.subject': '릴스 검색, 틱톡 검색, 유튜브 쇼츠 검색, SNS 콘텐츠 분석',
    'DC.description': '릴스 검색, 틱톡 검색, 유튜브 쇼츠 검색을 한 곳에서! 인스타그램 릴스, 틱톡, 유튜브 쇼츠를 쉽게 검색하고 다운로드할 수 있는 서비스입니다.',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headers = defaultCsp()
  
  // Get initial user session
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('unhandledrejection', function(event) {
                console.error('Unhandled promise rejection:', event.reason);
                event.preventDefault();
              });
              window.addEventListener('error', function(event) {
                console.error('Global error:', event.error);
              });
            `
          }}
        />
        <ErrorBoundary>
          <SupabaseProvider user={user}>
            <RelcherDialogProvider>
              <ThemeProvider />
              {/* Toss SDK */}
              <script src="https://js.tosspayments.com/v2/standard" async defer></script>
              {children}
            </RelcherDialogProvider>
          </SupabaseProvider>
        </ErrorBoundary>
        <footer className="mt-16 border-t">
          <div className="max-w-6xl mx-auto px-4 py-6 text-[13px] text-neutral-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div>© {new Date().getFullYear()} Reelcher. All rights reserved.</div>
              <span aria-hidden>·</span>
              <a href="/privacy" className="hover:underline">개인정보처리방침</a>
              <span aria-hidden>·</span>
              <a href="/terms" className="hover:underline">이용약관</a>
              <span aria-hidden>·</span>
              <a href="/faq" className="hover:underline">FAQ</a>
              <span aria-hidden>·</span>
              <a href="/contact" className="hover:underline">문의</a>
              <span aria-hidden>·</span>
              <div>상호 {siteBusiness.name}</div>
              <span aria-hidden>·</span>
              <div>대표자명 {siteBusiness.owner}</div>
              <span aria-hidden>·</span>
              <div>사업자등록번호 {siteBusiness.businessNumber}</div>
              <span aria-hidden>·</span>
              <div>사업장 주소 {siteBusiness.address}</div>
              <span aria-hidden>·</span>
              <div>연락처 <a href={`tel:${siteBusiness.phone}`} className="hover:underline">{siteBusiness.phone}</a></div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
