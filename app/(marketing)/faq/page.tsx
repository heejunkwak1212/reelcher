import SiteHeader from '@/components/layout/SiteHeader'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata.faq

export default function FAQPage() {
  return (
    <>
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <h1 className="text-2xl font-bold">자주 묻는 질문(FAQ)</h1>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">릴처는 어떤 서비스인가요?</h2>
        <p className="prose">릴처는 인스타그램 릴스의 벤치마킹을 위해 조회수/썸네일/영상 길이/캡션/계정 정보 등을 수집·정리하여 보여주는 분석 도구입니다. 콘텐츠의 소유권을 제공하지 않으며, 자료 활용 시 각 플랫폼의 약관과 저작권법을 준수해야 합니다.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">검색 결과 수(30/60/90/120)는 무엇을 의미하나요?</h2>
        <p className="prose">분석 시 수집할 목표 결과 개수입니다. 실제 반환 수가 부족한 경우 비례 정산 정책에 따라 자동으로 크레딧이 조정됩니다.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">크레딧은 어떻게 차감되나요?</h2>
        <p className="prose">검색 시작 시 선택한 옵션 기준으로 선차감되며, 최종 반환 수에 따라 실제 사용 크레딧으로 정산되어 차액은 환불됩니다. 자막 추출 및 영상 다운로드 등 부가 기능은 별도 크레딧 정책을 따릅니다.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">자막이 비어있게 나오는 이유는?</h2>
        <p className="prose">음성이 없는 영상이거나, 원본에 자막 데이터가 존재하지 않는 경우입니다. 추출 전 안내 팝업을 통해 이를 고지합니다.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">다운로드한 영상은 자유롭게 사용 가능한가요?</h2>
        <p className="prose">아니요. 회사는 자료 제공 도구일 뿐이며, 2차 가공·재배포·상업적 이용은 각 권리자의 허락 및 관련 법령 준수가 필요합니다. 무단 사용으로 발생하는 책임은 이용자에게 있습니다.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">환불이 가능한가요?</h2>
        <p className="prose">결제/환불은 서비스 내 고지된 약관 및 정책을 따릅니다. 결과 부족 시 비례 정산이 자동 반영되며, 시스템 오류 등 예외 상황은 고객센터로 문의해 주세요.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">문의는 어디로 하면 되나요?</h2>
        <p className="prose">support@relcher.app 로 연락 주세요.</p>
      </section>
      </div>
    </>
  )
}


