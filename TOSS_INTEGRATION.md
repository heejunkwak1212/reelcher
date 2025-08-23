# 본인인증 통합 가이드 (현재 비활성화)

## 🔴 **현재 상태: 모든 본인인증 비활성화**

카카오와 토스 본인인증 모두 고정비/변동비 부담으로 현재 비활성화되어 있습니다.

### 💰 **비용 현황**
- **카카오 인증**: 월 10만원 고정비 + 150-200원/건
- **토스 인증**: 월 고정비 없음 + 300-500원/건  

### 📋 **비활성화된 컴포넌트들**
- ✅ `components/auth/VerificationModal.tsx` - 토스 버튼 숨김
- ✅ `app/(app)/verify/page.tsx` - 토스 버튼 숨김
- ✅ 카카오 인증 관련 API 라우트 비활성화
- ✅ 토스 인증 관련 API 라우트 비활성화

---

## 🔵 **토스 인증 활성화 방법** (추후 필요시)

### 1. 환경 변수 설정

```bash
# .env.local
TOSS_CLIENT_ID=your_toss_client_id_here
TOSS_CLIENT_SECRET=your_toss_client_secret_here
```

### 2. UI 컴포넌트 활성화

**`components/auth/VerificationModal.tsx`**
```tsx
// 토스 버튼 활성화 (현재 주석 처리됨)
<Button onClick={() => setShowTossModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700">
  토스로 인증하기
</Button>
```

**`app/(app)/verify/page.tsx`**
```tsx
// 토스 버튼 활성화 (현재 주석 처리됨)
<Button
  onClick={handleTossVerification}
  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
>
  토스로 인증하기
</Button>
```

## 🟡 **카카오 인증 활성화 방법** (추후 필요시)

### 1. 카카오 개발자센터 설정
- 월 10만원 고정비 결제
- 간편인증 API 신청 및 승인
- Client ID/Secret 발급

### 2. 환경 변수 설정
```bash
# .env.local
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
```

### 3. API 라우트 활성화
- `app/api/auth/kakao-cert/` 폴더 내 파일들 활성화
- 각 파일 상단의 비활성화 주석 제거

### 4. UI 컴포넌트 활성화
**`components/auth/VerificationModal.tsx`**
```tsx
// 카카오 버튼 활성화 (현재 숨김 처리됨)
<Button onClick={() => setShowKakaoModal(true)} className="flex-1 bg-yellow-500 hover:bg-yellow-600">
  카카오로 인증하기  
</Button>
```

### 3. 토스페이먼츠 본인인증 API 신청

1. **토스페이먼츠 개발자센터** 접속
   - https://developers.tosspayments.com/

2. **본인인증 API 신청**
   - 사업자등록증
   - 서비스 소개서  
   - 개인정보처리방침
   - 본인인증 사용 목적 명시

3. **심사 완료 후 Client ID/Secret 발급**

## 💰 **비용 정보**

- **카카오 인증**: 약 150-200원/건
- **토스 인증**: 약 300-500원/건

## 🎯 **권장사항**

1. **초기 단계**: 카카오 인증만 사용
2. **성장 단계**: 사용자 선택권 확대를 위해 토스 추가
3. **대규모 서비스**: 두 가지 모두 제공하여 사용자 편의성 극대화

## 🔧 **기술적 구현**

모든 토스 관련 코드는 이미 구현되어 있습니다:
- ✅ OAuth2 토큰 발급
- ✅ 간편인증 요청/상태조회/결과조회
- ✅ CI 기반 중복 계정 방지
- ✅ 폴링 방식 상태 확인
- ✅ 토스 표준창 연동
- ✅ 개발 환경 시뮬레이션

**활성화만 하면 바로 사용 가능합니다!** 🚀
