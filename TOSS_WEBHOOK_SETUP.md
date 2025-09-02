# 🚀 토스페이먼츠 V2 웹훅 라이브 환경 설정 가이드

## 1. 토스 개발자센터 설정

### 접속 및 로그인
1. https://developers.tosspayments.com/ 접속
2. 라이브 환경용 계정으로 로그인
3. 왼쪽 메뉴에서 **"웹훅"** 클릭

### 웹훅 등록하기
1. **"웹훅 등록하기"** 버튼 클릭
2. 다음 정보 입력:

#### 기본 정보
- **웹훅 이름**: `릴처 구독 결제 웹훅`
- **웹훅 URL**: `https://your-domain.vercel.app/api/webhooks/toss`
  - ⚠️ 반드시 HTTPS 사용
  - 실제 배포된 Vercel 도메인으로 변경

#### 구독할 이벤트 (체크박스 선택)
✅ **PAYMENT_STATUS_CHANGED** (필수 - 결제 상태 변경)
✅ **CANCEL_STATUS_CHANGED** (선택 - 결제 취소)
❌ DEPOSIT_CALLBACK (가상계좌용 - 불필요)
❌ CUSTOMER_STATUS_CHANGED (브랜드페이용 - 불필요)
❌ METHOD_UPDATED (브랜드페이용 - 불필요)
❌ PAYOUT_STATUS_CHANGED (지급대행용 - 불필요)

3. **"등록하기"** 클릭

## 2. 환경변수 설정

### Vercel 환경변수 (기존 것만 사용)
```bash
# 기존 토스 환경변수 (이미 설정됨)
TOSS_CLIENT_KEY=live_ck_xxx
TOSS_SECRET_KEY=live_sk_xxx

# 웹훅 전용 시크릿은 V2에서 불필요
# TOSS_WEBHOOK_SECRET=whsk_xxx (삭제됨)
```

### 토스 V2 웹훅 특징
- ✅ **별도 시크릿키 불필요** (서명 검증 없음)
- ✅ **단순한 JSON 페이로드** 처리
- ✅ **10초 내 200 응답** 필수
- ✅ **멱등성 보장** (orderId 기반)

## 3. 보안 검증

### 서명 검증 로직 (이미 구현됨)
```typescript
function verifySignature(req: Request, body: string) {
  const secret = process.env.TOSS_WEBHOOK_SECRET || ''
  const sig = req.headers.get('x-toss-signature') || ''
  if (!secret || !sig) return false
  const h = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig))
}
```

## 4. 테스트 방법

### 로컬 테스트 (ngrok 사용)
1. `npm install -g ngrok`
2. `ngrok http 3000`
3. ngrok URL을 토스 웹훅에 임시 등록
4. 테스트 결제 진행

### 라이브 테스트
1. 실제 소액 결제 (100원) 진행
2. 웹훅 로그 확인: Supabase → billing_webhook_logs 테이블
3. 크레딧 지급 확인: credits 테이블

## 5. 모니터링

### 토스 개발자센터에서 확인
- 웹훅 전송 기록
- 성공/실패 상태
- 재전송 이력

### 우리 서버에서 확인
- billing_webhook_logs 테이블
- Vercel 함수 로그
- Sentry 에러 로그

## 6. 주의사항

⚠️ **중요한 보안 규칙:**
1. 반드시 서명 검증 통과 후 처리
2. 멱등성 보장 (같은 orderId 중복 처리 방지)
3. 10초 내 200 응답 필수
4. HTTPS 통신만 허용

✅ **성공 기준:**
- 웹훅 상태: "성공" 
- 로그 테이블에 processed=true 기록
- 사용자 크레딧 정상 지급
