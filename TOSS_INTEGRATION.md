# 토스 본인인증 통합 가이드

## 🔵 **토스 인증 활성화 방법**

현재 토스 인증은 비용 문제로 비활성화되어 있습니다. 필요시 아래 단계를 따라 활성화할 수 있습니다.

### 1. 환경 변수 설정

```bash
# .env.local
TOSS_CLIENT_ID=your_toss_client_id_here
TOSS_CLIENT_SECRET=your_toss_client_secret_here
```

### 2. UI 컴포넌트 활성화

**`components/auth/VerificationModal.tsx`**
```tsx
// 201-205행의 주석을 해제하세요
<Button onClick={() => setShowTossModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700">
  토스로 인증하기
</Button>
```

**`app/(app)/verify/page.tsx`**
```tsx
// 73-83행의 주석을 해제하세요
<Button
  onClick={handleTossVerification}
  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
>
  토스로 인증하기
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
