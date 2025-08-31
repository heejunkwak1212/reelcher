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
  title: "Reelcher: 릴스 틱톡 유튜브 검색 벤치마킹 솔루션",
  description: "터진 콘텐츠와 데이터를 효율적으로 분석하고 트렌드를 파악하세요",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/logo.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.ico',
    apple: '/logo.svg'
  },
  manifest: '/site.webmanifest',

  robots: 'index, follow',
  authors: [{ name: 'Reelcher' }],
  creator: 'Reelcher',
  publisher: 'Reelcher',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
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
