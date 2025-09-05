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
import { FeaturesSectionWithHoverEffects } from '@/components/feature-section-with-hover-effects'
import MainPageWrapper from '@/components/layout/MainPageWrapper'
import { generateOrganizationJsonLd, generateWebsiteJsonLd } from '@/lib/metadata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic';

const recommendationCards = [
  {
    icon: (
      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: "소규모 비즈니스",
    description: "릴처의 키워드 검색으로 고객이 반응하는 콘텐츠를 데이터로 확인하고, 리스크를 최소화해보세요",
    date: "",
    titleClassName: "text-gray-900 font-bold",
    className: "[grid-area:stack] hover:-translate-y-16 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0"
  },
  {
    icon: (
      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "실무 마케터",
    description: "원하는 모든 콘텐츠 데이터를 분석해 우리 채널에 바로 적용할 수 있는 성공 전략을 도출하세요",
    date: "",
    titleClassName: "text-gray-900 font-bold",
    className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-8 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration:700 hover:grayscale-0 before:left-0 before:top-0"
  },
  {
    icon: (
      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    title: "1인 크리에이터",
    description: "인기 콘텐츠의 제목과 썸네일, 조회수, 좋아요 등 데이터를 비교 분석하고, 채널을 성장시킬 다음 콘텐츠 아이디어를 얻어보세요",
    date: "",
    titleClassName: "text-gray-900 font-bold",
    className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-2"
  }
]

const faqData = [
  {
    question: "Q1. 크레딧은 무엇이고, 어떻게 사용되나요?",
    answer: "크레딧은 릴처의 모든 활동에 사용되는 화폐 단위예요.\n\n키워드, 프로필과 같은 일반 검색 기능 사용 시 30개의 검색 결과 당 100 크레딧이 사용되며, 유튜브의 경우 절반의 크레딧이 사용돼요."
  },
  {
    question: "Q2. 검색을 요청한 개수보다 결과가 적게 나오면 크레딧은 어떻게 되나요?",
    answer: "걱정하지 않으셔도 괜찮아요. 릴처는 고객과의 신뢰를 위해, 실제 반환된 결과 수에 비례해서만 크레딧을 차감하는 공정 사용 정책을 운영하고 있어요.\n\n예를 들어 60개 결과(200 크레딧)를 요청했지만 실제 결과가 45개만 나왔다면, 실제 사용된 150 크레딧을 제외한 50 크레딧은 자동으로 반환해드리고 있어요.\n\n* 계산식: (실제 결과 수 / 30) x 100 크레딧"
  },
  {
    question: "Q3. 유료 결제 전에 무료로 사용해 볼 수 있나요?",
    answer: "물론이에요. 릴처는 가입하는 모든 분들께 매달 250 크레딧을 무료로 제공하는 FREE 플랜을 지원해요. 릴처의 핵심적인 기능들을 충분히 경험하고 서비스의 가치를 판단해 보실 수 있어요."
  },
  {
    question: "Q4. 분석한 데이터는 어떻게 활용할 수 있나요?",
    answer: "릴처는 검색에서 그치지 않고, 실제 활용을 돕는 편리한 기능들을 제공해요.\n\n1) 엑셀 데이터 추출: 분석 결과 테이블 전체를 클릭 한 번에 .xlsx 파일로 다운로드하여 보고서를 만들거나 데이터를 관리할 수 있어요.\n\n2) 영상 다운로드: 마음에 드는 영상만 골라 직접 다운로드하여 콘텐츠 제작에 참고할 수 있어요.\n\n3) 링크 바로가기: 결과 테이블에서 원본 게시물로 간편하게 바로 이동이 가능해요."
  },
  {
    question: "Q5. 플랫폼(인스타그램, 유튜브, 틱톡)마다 어떤 기능 차이가 있나요?",
    answer: "네, 각 플랫폼의 특성에 맞춰 최적화된 분석 기능을 제공하고 있어요.\n\n- 유튜브: 세부적인 검색 필터를 비롯한 키워드 검색은 물론, 특정 영상과 유사한 인기 영상을 찾아주는 URL 기반 검색도 가능해요.\n\n- 인스타그램: 키워드 검색과 특정 계정의 콘텐츠를 기간별로 모아보는 프로필 검색을 지원해요. 결과 속에서 협찬받은 콘텐츠만 따로 필터링할 수도 있어요.\n\n- 틱톡: 인스타그램 검색과 마찬가지로 키워드 검색과 프로필 검색을 지원하여 다각도로 벤치마킹할 콘텐츠를 분석할 수 있어요."
  }
]

export default async function Home() {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }))
  const user = data?.user
  return (
    <MainPageWrapper>
      <main className="min-h-screen bg-white">
      <SiteHeader />
      <RelcherHero user={user} />
      
      {/* Dashboard Screenshot Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-4 pb-16 -mt-16">
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
      <section id="features" className="max-w-6xl mx-auto px-6 pt-16 pb-16">
        <Reveal>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              키워드만 입력해주세요. 이제는 릴처가 할게요.
            </h2>
          </div>
          
          <FeaturesSectionWithHoverEffects />
        </Reveal>
      </section>

      {/* 구분선 */}
      <div className="max-w-4xl mx-auto px-6">
        <hr className="border-gray-200 border-t" />
      </div>

      {/* Recommendation Section */}
      <section className="max-w-6xl mx-auto px-6 py-24 mb-16">
        <Reveal>
          <div className="text-center mb-20 lg:mb-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 px-4">
            콘텐츠 벤치마킹을 위한,<br />
            가장 확실한 시작점<br />
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
          title="FAQ 자주 묻는 질문"
          description="릴처 사용에 대해 궁금한 점들을 확인해보세요"
          items={faqData}
          className="py-24 shadow-lg"
        />
      </section>

      {/* CTA Section */}
      <section id="cta" className="max-w-6xl mx-auto px-6 pb-28">
        <Reveal>
          <div className="w-full py-20">
            <div className="flex flex-col text-center bg-muted rounded-xl p-8 lg:p-14 gap-8 items-center shadow-lg">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 border border-gray-200">
                  <span 
                    className="text-sm font-medium"
                    style={{
                      fontSize: 'var(--text-small-size)',
                      lineHeight: 'var(--text-small-line-height)',
                      letterSpacing: 'var(--text-small-letter-spacing)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    Get started
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <h3 
                  className="text-3xl md:text-4xl tracking-tighter max-w-xl"
                  style={{
                    fontSize: 'var(--title-2-size)',
                    lineHeight: 'var(--title-2-line-height)',
                    letterSpacing: 'var(--title-2-letter-spacing)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  벤치마킹 하세요. 베끼지만 마세요.
                </h3>
                <p 
                  className="leading-relaxed tracking-tight max-w-xl"
                  style={{
                    fontSize: 'var(--text-large-size)',
                    lineHeight: 'var(--text-large-line-height)',
                    letterSpacing: 'var(--text-large-letter-spacing)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  무료 가입 후 첫 분석까지 단 1분. 지금 바로 경험해보세요.
                </p>
              </div>
              <div className="flex justify-center">
                {!user ? (
                  <Link href="/sign-in">
                    <Button className="gap-4 h-12 px-8 rounded-full btn-animate shadow-md">
                      <span 
                        style={{
                          fontSize: 'var(--text-regular-size)',
                          lineHeight: 'var(--text-regular-line-height)',
                          letterSpacing: 'var(--text-regular-letter-spacing)',
                          fontWeight: 'var(--font-weight-medium)'
                        }}
                      >
                        무료로 시작하기
                      </span>
                    </Button>
                  </Link>
                ) : (
                  <Link href="/search">
                    <Button className="gap-4 h-12 px-8 rounded-full btn-animate shadow-md">
                      <span 
                        style={{
                          fontSize: 'var(--text-regular-size)',
                          lineHeight: 'var(--text-regular-line-height)',
                          letterSpacing: 'var(--text-regular-letter-spacing)',
                          fontWeight: 'var(--font-weight-medium)'
                        }}
                      >
                        검색 바로가기
                      </span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>
      </main>
      
      {/* JSON-LD 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateOrganizationJsonLd())
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(generateWebsiteJsonLd())
        }}
      />
    </MainPageWrapper>
  )
}