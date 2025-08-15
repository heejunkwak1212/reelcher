import { db } from '@/db'
import { pages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { supabaseServer } from '@/lib/supabase/server'
import InlineEditor from '@/components/admin/InlineEditor'

export const runtime = 'nodejs'

export default async function PrivacyPage() {
  const defaultPrivacy = `개인정보처리방침

본 개인정보처리방침은 릴처(Reelcher)(이하 “회사”)가 제공하는 서비스와 관련하여, 정보주체의 개인정보를 어떤 목적으로 수집·이용·보관·파기하는지와 정보주체의 권리 행사 방법을 명확히 고지하기 위한 문서입니다. 회사는 개인정보 보호법, 정보통신망법 등 관련 법령을 준수합니다.

제1조(처리 목적)
회사는 다음 목적을 위하여 개인정보를 처리합니다. 처리 목적이 변경되는 경우, 관련 법령에 따라 사전 고지 및 별도 동의를 받습니다.
1. 회원가입 및 본인 식별, 계정 관리
2. 유료 결제·정산, 구매 이력 및 이용 내역 관리
3. 고객문의 응대, 공지·알림 전달, 불만 처리, 장애 대응
4. 서비스 고도화(사용 행태 분석, 품질·보안 개선), 부정 이용 방지 및 접속 보안

제2조(처리 및 보유 기간)
1. 회원정보: 회원 탈퇴 시까지 보유하되, 관계 법령에 따라 필요한 경우 일정 기간 보관
2. 거래·정산 관련 기록: 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령에 따른 보관(예: 결제 기록 5년, 소비자 불만·분쟁처리 3년 등)
3. 접속기록: 통신비밀보호법에 따라 3개월 보관

제3조(수집 항목 및 방법)
1. 수집 항목
  - 필수: 이메일(또는 소셜 로그인 식별자), 서비스 이용·결제 식별자, 접속 IP/기기 정보, 쿠키
  - 선택: 닉네임(표시명), 설문/피드백 내용, 기타 이용자가 입력한 정보
2. 수집 방법: 웹/모바일 페이지, 고객센터 문의, 결제 처리 과정에서 자동/수동 수집

제4조(처리의 위탁)
회사는 원활한 서비스 제공을 위해 일부 업무를 위탁할 수 있으며, 위탁 시 개인정보 보호법 제26조에 따른 계약을 체결하고 수탁자를 관리·감독합니다. 예) 클라우드 호스팅, 결제대행, 인증 등

제5조(제3자 제공)
회사는 정보주체의 동의가 있거나 법령에 특별한 규정이 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다.

제6조(정보주체의 권리 및 행사 방법)
정보주체는 언제든지 자신의 개인정보에 대해 열람·정정·삭제·처리정지 요구를 할 수 있으며, 회사는 법령에 정한 범위 내에서 지체 없이 조치합니다. 권리 행사 방법 및 절차는 고객센터를 통해 안내합니다.

제7조(파기 절차 및 방법)
보유 기간 경과, 처리 목적 달성, 동의 철회 등 개인정보가 불필요하게 된 경우에는 지체 없이 파기합니다. 전자 파일은 복구 불가능한 방법으로 삭제하고, 종이 문서는 분쇄 또는 소각합니다.

제8조(안전성 확보조치)
접근권한 관리, 암호화, 접근통제, 악성코드 방지, 침입 차단/탐지, 로그 모니터링, 내부관리계획 수립 및 임직원 교육 등 합리적 보호조치를 시행합니다.

제9조(쿠키의 사용)
맞춤형 서비스 제공, 트래픽 분석, 품질 개선을 위해 쿠키를 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 일부 기능이 제한될 수 있습니다.

제10조(국외 이전)
클라우드/호스팅 등 서비스 구조상 국외 서버를 이용하는 경우, 이전 국가·항목·이전 목적·보유 기간 등 관련 사항을 고지하고 법령에 따른 동의를 이행합니다.

제11조(개인정보 보호책임자)
개인정보 보호책임자: 운영팀
연락처: support@relcher.app

제12조(권익침해 구제)
개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118), 개인정보분쟁조정위원회(kopico.go.kr, 1833-6972) 등 관련 기관에 분쟁 해결이나 상담을 신청할 수 있습니다.

부칙
1. 본 방침은 2025년 8월 16일로부터 적용됩니다.
2. 내용 변경 시 적용일 7일 전부터 서비스 내 공지합니다.`
  const row = (await db.select().from(pages).where(eq(pages.slug, 'privacy')).limit(1))[0]
  const ssr = supabaseServer()
  const { data: { user } } = await ssr.auth.getUser().catch(()=>({ data:{ user:null }} as any))
  let isAdmin = false
  if (user) {
    const { data } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
    isAdmin = data?.role === 'admin'
  }
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-4" style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif' }}>
      <h1 className="text-2xl font-bold">개인정보처리방침</h1>
      <div className="text-sm text-neutral-500">게시일: 2025-08-16</div>
      <InlineEditor slug="privacy" initialContent={row?.content || defaultPrivacy} isAdmin={isAdmin} />
    </div>
  )
}


