import { RelcherPricing } from '@/components/ui/relcher-pricing'
import { FaqSection } from '@/components/faq'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata.pricing

// Pricing 페이지용 FAQ 데이터 - 언제든 변경 가능
const pricingFaqData = [
  {
    question: "Q1. 구독 중간에 플랜을 바꿀 수 있나요?",
    answer: "네, 언제든지 가능해요. 플랜 업그레이드를 원하는 경우, 원하는 플랜 선택 및 결제 시 자동으로 최근 결제는 환불되며, 결제일이 갱신돼요.\n\n단, 상위 유료플랜에서 하위 유료 플랜으로 변경하기 위해선, 먼저 구독취소를 해주셔야 해요"
  },
  {
    question: "Q2. 구독 취소와 환불은 어떻게 받을 수 있나요?",
    answer: "구독 관리 페이지에서 구독 취소를 하실 수 있어요. 만약 유료 플랜 결제 이후 크레딧을 사용하지 않고 결제 이후 48시간이 경과되지 않았다면 즉시 환불 처리돼요.\n\n단, 결제 이후 48시간 이상 경과되었거나 결제 이후 사용이력이 있는 경우라면 환불이 불가능해요."
  },
  {
    question: "Q3. 결제 카드를 변경하고 싶어요.",
    answer: "결제 카드 변경을 위해선 먼저 구독 취소 이후 재구독해주셔야 해요. 구독 관리 페이지에서 구독 취소 시, 더 이상 해당 카드로 결제가 청구되지 않아요."
  },
  {
    question: "Q4. 구독 전 먼저 무료로 사용해볼 수 있나요?",
    answer: "물론이에요. 릴처는 가입하시는 모든 분들께 매달 250 크레딧을 무료로 제공하는 FREE 플랜을 지원해요. 편하게 릴처의 핵심적인 기능들을 충분히 경험하고 서비스의 가치를 판단해 보실 수 있어요."
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      <RelcherPricing
        title="릴처 요금제"
      />

      {/* FAQ 섹션 - 가격 섹션 하단에 추가 */}
      <section className="bg-white -mt-8">
        <FaqSection
          title="FAQ 자주 묻는 질문"
          description="릴처 사용에 대해 궁금한 점들을 확인해보세요"
          items={pricingFaqData}
          className="py-20 shadow-lg"
        />
      </section>
    </main>
  )
}


