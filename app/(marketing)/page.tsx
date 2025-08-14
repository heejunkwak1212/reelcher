import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Avoid static export bugs on this route by forcing dynamic rendering
export const dynamic = 'force-dynamic'

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h1
          className="text-4xl md:text-6xl font-bold tracking-tight"
          style={{
            background: 'linear-gradient(to right, #0B0C0E, transparent 80%), #9C9DA1',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'unset'
          }}
        >
          릴처: 인스타 릴스 분석 SaaS
        </h1>
        <p className="mt-4 text-[15px] leading-6" style={{ color: '#3A3B3F' }}>
        키워드만 넣어주세요. 인기 릴스와 데이터, 다 찾아드릴게요.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/sign-in" prefetch={false}>
            <Button className="h-10 px-5 rounded-full bg-black text-white hover:bg-black/90">시작하기</Button>
          </Link>
          <Link href="/search" prefetch={false}>
            <Button variant="outline" className="h-10 px-5 rounded-full">데모 보기</Button>
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#3A3B3F' }}>키워드 기반 분석</div>
            <p className="text-[15px] leading-6" style={{ color: '#0B0C0E' }}>해시태그만 입력하면 릴스 핵심 지표를 한 번에 수집합니다.</p>
          </div>
          <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#3A3B3F' }}>빠른 배치 처리</div>
            <p className="text-[15px] leading-6" style={{ color: '#0B0C0E' }}>요청 건을 자동 배치로 병렬 처리해 기다림을 최소화합니다.</p>
          </div>
          <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#3A3B3F' }}>다운로드 / 엑셀</div>
            <p className="text-[15px] leading-6" style={{ color: '#0B0C0E' }}>원하는 항목만 선택해 MP4/ZIP, .xlsx로 바로 내보낼 수 있습니다.</p>
          </div>
        </div>
      </section>

      <footer className="mt-4 border-t">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm" style={{ color: '#3A3B3F' }}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div>© {new Date().getFullYear()} Reelcher. All rights reserved.</div>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="hover:underline">이용약관</Link>
            <span aria-hidden>·</span>
            <Link href="/contact" className="hover:underline">문의</Link>
          </div>
        </div>
      </footer>
      {/* Toss SDK is already included in app/layout.tsx */}
    </main>
  )
}


