import { db } from '@/db'
import { pages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { supabaseServer } from '@/lib/supabase/server'
import InlineEditor from '@/components/admin/InlineEditor'

export const runtime = 'nodejs'

export default async function TermsPage() {
  const defaultTerms = `이용약관

본 약관은 릴처(Reelcher)(이하 “회사”)가 제공하는 모든 서비스(이하 “서비스”)의 이용조건과 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제1조(정의)
1. “서비스”: 회사가 제공하는 인스타그램 릴스 관련 검색·분석 및 자료 제공 도구 일체
2. “이용자”: 본 약관에 동의하여 서비스를 이용하는 회원 및 비회원

제2조(약관의 효력 및 변경)
1. 본 약관은 서비스 초기 화면에 게시함으로써 효력이 발생합니다.
2. 회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자 7일 전부터 공지합니다. 이용자가 변경에 동의하지 않는 경우 서비스 이용을 중단할 수 있습니다.

제3조(서비스의 성격 및 책임의 한계)
1. 회사는 “영상 기획과 마케팅에 필요한 자료”를 수집·정리하여 제공하는 도구적 서비스를 제공합니다. 회사는 원저작물의 저작권자도 아니며, 콘텐츠의 소유권이나 이용 허락을 보증하지 않습니다.
2. 이용자는 서비스를 통해 제공된 데이터를 2차 저작물 제작, 재배포, 상업적 이용 등으로 활용하는 경우 각 플랫폼·권리자의 약관 및 저작권법 등 관련 법령을 준수하여야 하며, 필요한 경우 별도의 권리 처리를 직접 진행해야 합니다.
3. 이용자가 회사가 제공한 자료를 2차 재가공하거나 무단 도용하여 발생하는 일체의 분쟁·손해·제3자 권리침해 등에 대하여 회사는 책임을 지지 않습니다. 이용자는 본인의 비용과 책임으로 이를 해결하여야 하며, 회사에 손해가 발생한 경우 이를 배상합니다.
4. 서비스 결과는 수집 시점, 원본 게시물 변경/삭제, 플랫폼 정책 등에 따라 달라질 수 있으며, 회사는 정확성·완전성·적시성을 보증하지 않습니다.

제4조(이용 계약의 성립)
1. 이용 계약은 이용자가 소셜 로그인 등 회사가 정한 절차에 따라 가입을 신청하고 회사가 이를 승낙함으로써 성립합니다.

제5조(유료 서비스 및 크레딧)
1. 유료 서비스는 회사가 정한 요금·크레딧 정책에 따릅니다.
2. 결제·환불, 공정사용, 크레딧 정산은 서비스 내 고지된 정책(예: 결과 부족 시 비례 차감/환불 등)에 따릅니다.

제5-1조(구독, 자동결제 및 구독 취소)
1. 이용자가 유료 플랜을 구독할 경우, 결제일을 기준으로 매월 자동 결제가 이루어집니다.
2. 이용자는 대시보드의 "구독 관리"에서 구독 취소를 요청할 수 있으며, 취소 즉시 자동 결제가 중지됩니다.
3. 구독 취소 후에는 현재 결제 주기의 종료일(다음 결제 예정일)까지 기존 플랜 혜택이 유지되며, 종료일 경과 시 FREE 플랜으로 전환됩니다.
4. 결제 실패, 요금제 정책 변경 등 합리적인 사유가 있는 경우 회사는 구독 상태를 변경하거나 서비스를 제한할 수 있습니다.

제6조(금지행위)
다음 행위를 금지합니다.
1) 타인의 계정/정보 도용, 비정상적 접근 시도, 서비스 장애 유발
2) 로봇/스크래핑 등 비인가 자동화 수단으로의 접근
3) 제3자의 권리(저작권, 상표권 등) 침해, 명예훼손, 불법 정보 유통

제7조(지식재산권)
서비스 화면 및 제공되는 프로그램 등에 대한 저작권 등 권리는 회사에 귀속합니다. 단, 원저작물(게시물/썸네일/영상 등)의 권리는 각 권리자에게 있습니다.

제8조(서비스 제공의 중단)
시스템 점검, 정책 변경, 불가항력 등 사유로 서비스 제공을 일시 중단할 수 있습니다.

제9조(면책)
1. 회사는 천재지변, 통신장애, 플랫폼 정책 변경 등 불가항력 또는 회사의 귀책사유가 아닌 사유로 인한 손해를 책임지지 않습니다.
2. 이용자의 귀책 또는 약관/법령 위반으로 발생한 모든 손해와 분쟁은 이용자 본인의 책임입니다.

제10조(관할 및 준거법)
본 약관은 대한민국법을 준거법으로 하며, 회사와 이용자 간 분쟁은 민사소송법상 관할 법원을 전속 관할로 합니다.

부칙
본 약관은 2025년 8월 16일로부터 적용합니다.`
  const row = (await db.select().from(pages).where(eq(pages.slug, 'terms')).limit(1))[0]
  const ssr = await supabaseServer()
  const { data: { user } } = await ssr.auth.getUser().catch(()=>({ data:{ user:null }} as any))
  let isAdmin = false
  if (user) {
    const { data } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
    isAdmin = data?.role === 'admin'
  }
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-4" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif' }}>
      <h1 className="text-2xl font-bold">이용약관</h1>
      <div className="text-sm text-neutral-500">게시일: 2025-08-16</div>
      <InlineEditor slug="terms" initialContent={row?.content || defaultTerms} isAdmin={isAdmin} />
    </div>
  )
}


