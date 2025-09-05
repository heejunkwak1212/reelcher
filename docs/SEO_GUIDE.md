# 🎯 Reelcher SEO 가이드

## 📋 목차
1. [구현된 SEO 기능](#구현된-seo-기능)
2. [추가 작업 필요사항](#추가-작업-필요사항)
3. [SEO 성능 모니터링](#seo-성능-모니터링)
4. [최적화 팁](#최적화-팁)

## 🚀 구현된 SEO 기능

### ✅ 기본 메타태그
- `title`, `description`, `keywords`
- `robots`, `canonical URL`
- 모바일 최적화 (`viewport`, `format-detection`)

### ✅ Open Graph (소셜 미디어)
- Facebook, LinkedIn 등에서 링크 공유 시 미리보기
- 이미지, 제목, 설명 최적화

### ✅ Twitter Cards
- 트위터에서 링크 공유 시 미리보기
- `summary_large_image` 형태 적용

### ✅ 구조화 데이터 (JSON-LD)
- `Organization` 스키마
- `WebSite` 스키마 (검색 기능 포함)

### ✅ 검색엔진 최적화
- `sitemap.xml` 자동 생성
- `robots.txt` 최적화
- AI 크롤러 차단 설정

## 📝 추가 작업 필요사항

### 1. OG 이미지 생성
```bash
# public 폴더에 다음 이미지들 추가 필요:
public/og-image.png          # 1200x630px
public/logo.svg              # 로고 파일
public/favicon.ico           # 파비콘
public/site.webmanifest      # PWA 매니페스트
```

### 2. 페이지별 메타데이터 적용
현재 적용된 페이지:
- ✅ 홈페이지 (`/`)
- ✅ 가격 페이지 (`/pricing`)

추가 적용 필요한 페이지:
- 🔲 FAQ 페이지 (`/faq`)
- 🔲 개인정보처리방침 (`/privacy`)
- 🔲 이용약관 (`/terms`)
- 🔲 문의하기 (`/contact`)

**적용 방법:**
```tsx
// 각 페이지 파일 상단에 추가
import { pageMetadata } from '@/lib/metadata'
export const metadata = pageMetadata.faq // 해당 페이지명
```

### 3. 동적 메타데이터 적용
검색 결과 페이지에서 키워드 기반 메타데이터:
```tsx
// app/(app)/search-test/page.tsx
export async function generateMetadata({ searchParams }) {
  const keyword = searchParams.q
  if (keyword) {
    return createSearchResultMetadata(keyword, 0)
  }
  return pageMetadata.search
}
```

### 4. 블로그/콘텐츠 페이지 (향후)
- 블로그 포스트별 개별 메타데이터
- `Article` JSON-LD 스키마
- 태그별, 카테고리별 메타데이터

## 📊 SEO 성능 모니터링

### Google Search Console 설정
1. [Google Search Console](https://search.google.com/search-console) 접속
2. 도메인 추가: `reelcher.com`
3. 소유권 확인 (DNS 또는 HTML 파일)
4. `sitemap.xml` 제출

### 네이버 웹마스터도구 설정 🇰🇷
1. [네이버 웹마스터도구](https://searchadvisor.naver.com) 접속
2. 사이트 등록: `https://reelcher.com`
3. 소유권 확인:
   - HTML 파일 업로드 방식
   - 또는 메타태그 방식 (`NAVER_SITE_VERIFICATION` 환경변수 설정)
4. 사이트맵 등록: `/sitemap.xml`
5. RSS 피드 등록 (블로그가 있다면)

### 네이버 vs 구글 SEO 차이점
| 항목 | 구글 | 네이버 |
|------|------|--------|
| **크롤러명** | Googlebot | Yeti |
| **메타태그** | 표준 HTML 메타태그 | `NaverBot` 메타태그 추가 |
| **콘텐츠 우선순위** | 영문/다국어 친화적 | 한국어 콘텐츠 우선 |
| **백링크** | 매우 중요 | 상대적으로 덜 중요 |
| **브랜드 인지도** | 글로벌 신뢰도 | 한국 내 브랜드 신뢰도 |
| **업데이트 속도** | 빠름 (몇 시간~며칠) | 느림 (며칠~몇 주) |

### 주요 모니터링 지표
- **클릭률 (CTR)**: 검색 결과에서 클릭되는 비율
- **노출수**: 검색 결과에 나타나는 횟수
- **평균 순위**: 키워드별 평균 검색 순위
- **색인 상태**: 구글이 페이지를 인덱싱했는지 확인

### SEO 도구들
- **Google Search Console**: 무료, 기본적인 SEO 분석
- **Google Analytics 4**: 트래픽 분석
- **Ahrefs/SEMrush**: 고급 키워드 분석 (유료)

## 💡 최적화 팁

### 1. 키워드 최적화
현재 타겟 키워드:
- `릴스 검색`, `틱톡 분석`, `유튜브 쇼츠`
- `콘텐츠 분석`, `트렌드 분석`
- `소셜미디어 분석`, `바이럴 콘텐츠`

### 2. 콘텐츠 최적화
- **제목**: 25-60자 내외
- **설명**: 120-160자 내외
- **키워드 밀도**: 자연스럽게 2-3% 수준

### 3. 기술적 SEO
- **페이지 속도**: Core Web Vitals 최적화
- **모바일 친화성**: 반응형 디자인
- **HTTPS**: 보안 연결 필수

### 4. 구조화 데이터 확장
추가 가능한 스키마:
- `SoftwareApplication` (앱 정보)
- `Product` (서비스 정보)
- `FAQ` (자주 묻는 질문)
- `HowTo` (사용법 가이드)

## 🔧 구현 예시

### 페이지별 메타데이터 적용
```tsx
// app/(marketing)/faq/page.tsx
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata.faq

export default function FAQPage() {
  return <div>FAQ 내용</div>
}
```

### 동적 메타데이터 생성
```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const post = await getBlogPost(params.slug)
  return createBlogPostMetadata(
    post.title,
    post.description,
    params.slug
  )
}
```

### JSON-LD 추가 예시
```tsx
// FAQ 페이지에 FAQ 스키마 추가
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Reelcher는 무엇인가요?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "릴스, 틱톡, 유튜브 쇼츠를 한번에 검색하고 분석할 수 있는 플랫폼입니다."
      }
    }
  ]
}
```

---

**📞 추가 도움이 필요하시면 언제든 문의해 주세요!**
