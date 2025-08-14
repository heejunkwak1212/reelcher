import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import { Button } from '@/components/ui/button'
import Reveal from '@/components/ux/Reveal'
import { supabaseServer } from '@/lib/supabase/server'
// no styled-jsx; animations are defined in globals.css

export default async function Home() {
  const supabase = supabaseServer()
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }))
  const user = data?.user
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] rounded-full opacity-[0.06]" style={{ background: 'radial-gradient(closest-side, #0B0C0E, transparent 70%)' }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 py-24 text-center">
          <Reveal>
        <div className="space-y-2 md:space-y-3">
          <div className="text-3xl md:text-6xl font-semibold tracking-tight text-reveal" style={{ color: '#3A3B3F' }}>
            Stop scrolling,
          </div>
          <h1
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-reveal anim-2"
            style={{
              background: 'linear-gradient(to right, #0B0C0E, transparent 80%), #9C9DA1',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'unset'
            }}
          >
            Reelcher is here.
          </h1>
        </div>
          <p className="mt-4 text-[15px] leading-6" style={{ color: '#3A3B3F' }}>
          키워드만 입력하세요. 인기 릴스와 데이터, 다 찾아드릴게요.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            {!user ? (
              <>
                <Link href="/sign-in" prefetch={false}>
                  <Button className="h-10 px-5 rounded-full bg-black text-white hover:bg-black/90 btn-animate">무료로 시작하기</Button>
                </Link>
                <Link href="/sign-in" prefetch={false}>
                  <Button variant="outline" className="h-10 px-5 rounded-full btn-animate">로그인</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" prefetch={false}>
                  <Button variant="outline" className="h-10 px-5 rounded-full btn-animate">대시보드</Button>
                </Link>
                <Link href="/search" prefetch={false}>
                  <Button className="h-10 px-5 rounded-full bg-black text-white hover:bg-black/90 btn-animate">검색 바로가기</Button>
                </Link>
              </>
            )}
          </div>
          </Reveal>
        </div>
      </section>
      {/* Removed showcase images per request */}

      <section id="features" className="max-w-6xl mx-auto px-6 pb-24">
        <Reveal>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#3A3B3F' }}>RLS 보안</div>
              <p className="text-[15px] leading-6" style={{ color: '#0B0C0E' }}>Row Level Security와 엄격한 권한 정책으로 데이터 보호.</p>
            </div>
            <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#3A3B3F' }}>캡션/자막 추출</div>
              <p className="text-[15px] leading-6" style={{ color: '#0B0C0E' }}>자막 추출로 카피/스크립트 분석을 자동화합니다.</p>
            </div>
            <div className="rounded-xl border p-5" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: '#3A3B3F' }}>크레딧/결제</div>
              <p className="text-[15px] leading-6" style={{ color: '#0B0C0E' }}>공정 사용 정책과 토스 결제 연동으로 예측 가능한 비용.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section id="how" className="max-w-6xl mx-auto px-6 pb-24">
        <Reveal>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold" style={{ color: '#0B0C0E' }}>3단계로 끝나는 워크플로우</h2>
            <p className="mt-2 text-[15px]" style={{ color: '#3A3B3F' }}>검색 → 심층 분석 → 내보내기</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border p-6" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold" style={{ color: '#3A3B3F' }}>1. 검색</div>
              <p className="mt-2 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>해시태그를 입력하고 결과 개수를 선택합니다(30/60/90/120).</p>
            </div>
            <div className="rounded-xl border p-6" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold" style={{ color: '#3A3B3F' }}>2. 심층 분석</div>
              <p className="mt-2 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>세부/프로필을 자동 배치로 처리해 조회수·길이·다운로드 URL을 확보.</p>
            </div>
            <div className="rounded-xl border p-6" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold" style={{ color: '#3A3B3F' }}>3. 내보내기</div>
              <p className="mt-2 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>선택 항목을 MP4/ZIP 또는 .xlsx로 내보내고, 인사이트를 공유하세요.</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section id="pricing" className="max-w-6xl mx-auto px-6 pb-24">
        <Reveal>
        <div className="rounded-2xl border overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-4">
            <div className="p-6 md:border-r border-b md:border-b-0" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#3A3B3F' }}>FREE</div>
              <div className="text-2xl font-bold">0원</div>
              <ul className="mt-3 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>
                <li>250 크레딧/월</li>
              </ul>
            </div>
            <div className="p-6 md:border-r border-b md:border-b-0" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#3A3B3F' }}>STARTER</div>
              <div className="text-2xl font-bold">19,000원</div>
              <ul className="mt-3 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>
                <li>3,000 크레딧/월</li>
              </ul>
            </div>
            <div className="p-6 md:border-r border-b md:border-b-0" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#3A3B3F' }}>PRO</div>
              <div className="text-2xl font-bold">49,000원</div>
              <ul className="mt-3 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>
                <li>10,000 크레딧/월</li>
              </ul>
            </div>
            <div className="p-6" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#3A3B3F' }}>BUSINESS</div>
              <div className="text-2xl font-bold">109,000원</div>
              <ul className="mt-3 text-[15px] leading-6" style={{ color: '#0B0C0E' }}>
                <li>30,000 크레딧/월</li>
              </ul>
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      <section id="cta" className="max-w-6xl mx-auto px-6 pb-28">
        <Reveal>
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
            <h3 className="text-2xl font-bold" style={{ color: '#0B0C0E' }}>지금 바로 릴스 분석을 시작해보세요</h3>
            <p className="mt-2 text-[15px]" style={{ color: '#3A3B3F' }}>무료로 가입하고, 첫 분석을 1분 내에 완료하세요.</p>
            <div className="mt-6 flex justify-center gap-3">
              {!user ? (
                <Link href="/sign-in">
                  <Button className="h-10 px-6 rounded-full bg-black text-white hover:bg-black/90 btn-animate">무료로 시작하기</Button>
                </Link>
              ) : (
                <Link href="/search">
                  <Button className="h-10 px-6 rounded-full bg-black text-white hover:bg-black/90 btn-animate">검색 바로가기</Button>
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      </section>

      {/* animation keyframes moved to app/globals.css */}
    </main>
  )
}
