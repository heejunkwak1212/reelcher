import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import SiteHeader from '@/components/layout/SiteHeader'
import RelcherHero from '@/components/layout/RelcherHero'
import { RelcherPricing } from '@/components/ui/relcher-pricing'
import DisplayCards from '@/components/ui/display-cards'
import Reveal from '@/components/ux/Reveal'
import { supabaseServer } from '@/lib/supabase/server'
import { FaqSection } from '@/components/faq'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

const recommendationCards = [
  {
    icon: null,
    title: "소규모 비즈니스",
    description: "릴처의 키워드 검색으로 고객이 반응하는 콘텐츠를 데이터로 확인하고, 리스크를 없애는 비즈니스를 시작하세요.",
    date: "",
    titleClassName: "text-gray-900 font-bold",
    className: "[grid-area:stack] hover:-translate-y-16 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0"
  },
  {
    icon: null,
    title: "실무 마케터",
    description: "원하는 모든 콘텐츠 데이터를 분석해 우리 채널에 바로 적용할 수 있는 성공 전략을 도출하세요.",
    date: "",
    titleClassName: "text-gray-900 font-bold",
    className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-8 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0"
  },
  {
    icon: null,
    title: "1인 크리에이터",
    description: "인기 콘텐츠의 제목과 조회수, 좋아요, 팔로워 데이터를 비교 분석하고, 채널을 성장시킬 다음 콘텐츠 아이디어를 얻어보세요.",
    date: "",
    titleClassName: "text-gray-900 font-bold",
    className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-2"
  }
]

const faqData = [
  {
    question: "1) 릴처는 어떤 플랫폼의 데이터를 분석할 수 있나요?",
    answer: "현재 Instagram 릴스와 YouTube 쇼츠를 지원하고 있으며, 향후 TikTok과 다른 숏폼 콘텐츠 플랫폼도 지원할 예정입니다."
  },
  {
    question: "2) 분석 결과는 얼마나 정확한가요?",
    answer: "AI 기반 분석 시스템으로 실시간 데이터를 수집하여 95% 이상의 정확도를 보장합니다. 조회수, 좋아요, 댓글 등 모든 지표를 정확하게 추적합니다."
  },
  {
    question: "3) 무료 플랜으로 어디까지 이용할 수 있나요?",
    answer: "무료 플랜에서는 월 100개의 크레딧을 제공하며, 기본적인 키워드 분석과 최대 30개의 릴스 데이터를 확인할 수 있습니다."
  },
  {
    question: "4) 분석 데이터를 내보내기 할 수 있나요?",
    answer: "네, Excel 파일로 분석 결과를 다운로드할 수 있으며, 선택한 릴스의 영상 파일도 일괄 다운로드 가능합니다."
  },
  {
    question: "5) 경쟁사 분석은 어떻게 활용하면 좋을까요?",
    answer: "경쟁사의 인기 콘텐츠 패턴을 분석해 성공 요소를 파악하고, 유사한 주제나 형식으로 차별화된 콘텐츠를 제작하는 전략을 세울 수 있습니다."
  }
]

export default async function Home() {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }))
  const user = data?.user
  return (
    <main className="min-h-screen bg-white">
      <SiteHeader />
      <RelcherHero user={user} />
      
      {/* Dashboard Screenshot Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-4 -mt-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl shadow-2xl">
            <Image
              src="/dashboard-screenshot.png"
              alt="Reelcher Dashboard"
              width={1400}
              height={800}
              className="w-full h-auto object-cover"
              priority
            />
            {/* Gradient fade effect at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/90 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
          </div>
        </Reveal>
      </section>

      {/* Service Description Section */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              기획과 벤치마킹을 위한,<br />
              가장 확실한 시작점<br />
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto px-4">
              성공한 콘텐츠의 데이터를 한 눈에 비교하고<br />
              여러분만의 성공 공식을 발견해보세요.<br />
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-gray-400">📊</div>
              </div>
              <h3 className="text-lg font-semibold mb-3">ㅌㅅㅌㅌ</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                ㅌㅅㅌ
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-gray-400">⚙️</div>
              </div>
              <h3 className="text-lg font-semibold mb-3">테스트</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                테스트1<br />
                테스트2
              </p>
            </div>
            
            <div className="text-center p-6 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
              <div className="w-full h-32 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-gray-400">💻</div>
              </div>
              <h3 className="text-lg font-semibold mb-3">테스트3</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                테스트트
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Recommendation Section */}
      <section className="max-w-6xl mx-auto px-6 py-24 mb-16">
        <Reveal>
          <div className="text-center mb-20 lg:mb-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 px-4">
              키워드만 입력해주세요. 이제는 릴처가 찾아줄게요.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto px-4">
              아래와 같은 분들께 추천드려요.
            </p>
          </div>
          <DisplayCards cards={recommendationCards} />
        </Reveal>
      </section>

      {/* 가격 섹션 */}
      <section id="pricing" className="bg-gray-50">
        <RelcherPricing />
      </section>

      {/* FAQ 섹션 */}
      <section id="faq" className="bg-white">
        <FaqSection
          title="자주 묻는 질문"
          description="릴처 사용에 대해 궁금한 점들을 확인해보세요"
          items={faqData}
          className="py-24 shadow-lg"
        />
      </section>

      {/* CTA Section */}
      <section id="cta" className="max-w-6xl mx-auto px-6 pb-28">
        <Reveal>
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'color-mix(in lab, #9C9DA1 16%, transparent)', background: 'color-mix(in lab, #9C9DA1 5%, transparent)' }}>
            <h3 className="text-2xl font-bold" style={{ color: '#0B0C0E' }}>벤치마킹 하세요. 베끼지만 마세요.</h3>
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
    </main>
  )
}
