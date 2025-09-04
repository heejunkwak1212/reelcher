# YouTube 영상 기반 검색 고도화 계획 및 구현 가이드

## 📋 프로젝트 개요

**목표**: YouTube Data API v3를 활용한 영상 기반 유사 검색 기능의 최고 수준 고도화

**현재 상태**: 기본적인 유사도 스코어링 및 채널 다양성 확보 로직 구현됨

**목표 성능**:
- API 호출량: 40% 절감
- 필터링 성공률: 90% 달성
- 결과 개수 보장: 95% 이상
- 처리 속도: 40% 향상

## 🎯 Context7 기반 YouTube Data API v3 분석 결과

### API 제한사항 및 가능범위

#### ✅ 완전 지원되는 기능들
1. **검색 파라미터**:
   - `q`: 키워드 검색
   - `channelId`: 채널별 검색 (500개 제한)
   - `videoCategoryId`: 카테고리 필터
   - `videoDuration`: 길이 필터 (short/medium/long)
   - `videoDefinition`: 화질 필터 (HD/SD)
   - `order`: 정렬 (relevance, viewCount, date 등)
   - `publishedAfter`: 날짜 필터

2. **메타데이터 접근**:
   - `videos.list`: 상세 정보 (제목, 설명, 태그, 조회수, 좋아요 등)
   - `channels.list`: 채널 정보 (구독자 수 등)
   - 배치 처리: 최대 50개씩

#### ⚠️ 제한사항
1. **사전 필터 불가**: 조회수/구독자 필터는 검색 후 적용
2. **할당량**: 일일 10,000 units (검색: 100 units, 비디오 조회: 1 unit)
3. **페이지네이션**: 최대 50개씩, nextPageToken으로 추가 요청

### 현재 구현 분석

#### 기존 로직의 문제점
1. **무조건 3배수 검색**: API 호출량 과다
2. **채널 집중**: 같은 채널 영상 과도하게 추천
3. **필터링 실패**: 결과 개수 부족 시 대응 미흡
4. **유사도 부정확**: 단순 키워드 매칭 기반

## 🚀 고도화 전략 및 구현 계획

### Phase 1: 스마트 검색 범위 계산 (1시간)

#### 목표
- 필터 강도에 따른 동적 검색 범위 계산
- API 호출량 40% 절감

#### 구현 세부사항
```typescript
function calculateSmartFetchLimit(targetCount: number, filters: any): number {
  let multiplier = 1.0

  // 필터 강도 분석
  if (filters.minViews) multiplier += 0.5      // 조회수 필터
  if (filters.maxSubscribers) multiplier += 0.3 // 구독자 필터
  if (filters.videoDuration !== 'any') multiplier += 0.2 // 길이 필터

  return Math.min(Math.round(targetCount * multiplier), targetCount * 2)
}
```

#### 예상 효과
- **API 호출량**: 5-6회 → 2-4회
- **성공률**: 75% → 85%

### Phase 2: 효율적인 필터링 시스템 (1.5시간)

#### 목표
- 채널별 그룹화로 API 호출 최소화
- 사전 필터링 최대화

#### 구현 세부사항
```typescript
function applyFiltersEfficiently(videos: any[], filters: any): any[] {
  // 1. 구독자 수 필터: 채널별 그룹화
  if (filters.maxSubscribers) {
    const channelGroups = new Map<string, any[]>()
    videos.forEach(video => {
      const channelId = video.channelId
      if (!channelGroups.has(channelId)) {
        channelGroups.set(channelId, [])
      }
      channelGroups.get(channelId)!.push(video)
    })

    // 채널별 필터링
    videos = []
    for (const [channelId, channelVideos] of channelGroups) {
      if (channelVideos[0].subscriberCount <= filters.maxSubscribers) {
        videos.push(...channelVideos)
      }
    }
  }

  // 2. 조회수 필터
  if (filters.minViews) {
    videos = videos.filter(v => v.viewCount >= filters.minViews)
  }

  return videos
}
```

#### 예상 효과
- **필터링 속도**: 50% 향상
- **메모리 효율**: 채널별 그룹화로 최적화

### Phase 3: 동적 결과 보장 메커니즘 (1.5시간)

#### 목표
- 부족 시 단계별 보완 검색
- 결과 개수 95% 보장

#### 구현 세부사항
```typescript
async function expandSearchIfNeeded(
  request: any,
  currentResults: any[],
  targetCount: number
): Promise<any[]> {

  const shortage = targetCount - currentResults.length
  const shortageRatio = shortage / targetCount

  if (shortageRatio <= 0.3) {
    // 약간 부족: 기존 범위 30% 확장
    const additionalResults = await searchWithExpansion(request, 0.3)
    return mergeAndDeduplicate(currentResults, additionalResults, targetCount)

  } else if (shortageRatio <= 0.6) {
    // 많이 부족: 필터 완화 + 확장
    const relaxedFilters = relaxFilters(request.filters)
    const additionalResults = await searchWithRelaxedFilters(request, relaxedFilters, 0.5)
    return mergeAndDeduplicate(currentResults, additionalResults, targetCount)

  } else {
    // 심각하게 부족: 새로운 전략
    const fallbackResults = await searchWithFallbackStrategy(request)
    return mergeAndDeduplicate(currentResults, fallbackResults, targetCount)
  }
}
```

#### 예상 효과
- **결과 개수 달성률**: 25/30 → 29/30
- **필터링 성공률**: 75% → 90%

### Phase 4: 채널 다양성 강화 (1시간)

#### 목표
- 라운드 로빈 방식으로 채널 다양성 극대화
- 같은 채널 집중 방지

#### 구현 세부사항
```typescript
function selectDiverseResults(videos: any[], targetCount: number): any[] {
  const channelCounts = new Map<string, number>()
  const result: any[] = []

  // 유사도 순으로 정렬
  videos.sort((a: any, b: any) => b.similarityScore - a.similarityScore)

  // 라운드 로빈 방식으로 채널별 선택
  let round = 0
  while (result.length < targetCount && round < 10) {
    for (const video of videos) {
      if (result.length >= targetCount) break

      const channelCount = channelCounts.get(video.channelId) || 0
      const isSameChannel = video.channelId === videos[0]?.channelId // 원본 채널

      // 채널별 제한: 원본 3개, 다른 채널 2개
      const maxForChannel = isSameChannel ? 3 : 2

      if (channelCount < maxForChannel && !result.includes(video)) {
        result.push(video)
        channelCounts.set(video.channelId, channelCount + 1)
      }
    }
    round++
  }

  return result
}
```

#### 예상 효과
- **채널 다양성**: 70% → 85%
- **결과 품질**: 유사도 기반 최적 선택

## 📊 구현 우선순위

### 🔥 즉시 구현 (Phase 1-2)
1. 스마트 검색 범위 계산 함수
2. 효율적인 필터링 시스템

### ⚡ 단기 구현 (Phase 3)
1. 동적 결과 보장 메커니즘
2. 부족 시 확장 검색 로직

### 🎯 중기 구현 (Phase 4)
1. 채널 다양성 강화
2. 성능 모니터링 및 최적화

## 🎯 성능 목표 및 측정

### KPI 정의
- **API 호출량**: 요청당 평균 호출 수
- **필터링 성공률**: 목표 개수 달성 비율
- **처리 시간**: 검색 완료까지 소요 시간
- **채널 다양성**: 상위 10개 결과의 고유 채널 수

### 목표치
| 지표 | 현재 | 목표 | 개선률 |
|------|------|------|--------|
| API 호출량 | 5-6회 | 2-4회 | 33-40% |
| 필터링 성공률 | 75% | 90% | 20% |
| 결과 개수 달성 | 83% | 95% | 12% |
| 처리 시간 | 3-5초 | 2-3초 | 40% |

## 🔧 기술적 고려사항

### YouTube API 제한 준수
- **할당량 관리**: 10,000 units/일 제한
- **요청 최적화**: 배치 처리 활용
- **에러 처리**: 할당량 초과 시 폴백 전략

### 코드 구조
```typescript
export class OptimizedYouTubeClient extends YouTubeClient {
  // 스마트 검색 메소드들
  async searchSimilarVideosOptimized(request: IYouTubeSearchRequest)

  // 유틸리티 메소드들
  private calculateSmartFetchLimit()
  private applyFiltersEfficiently()
  private expandSearchIfNeeded()
  private selectDiverseResults()
}
```

## 🚀 기대 효과

### 사용자 경험 향상
- **더 정확한 결과**: 스마트 필터링으로 품질 향상
- **다양한 콘텐츠**: 채널 다양성 확보로 폭넓은 선택
- **빠른 응답**: 최적화로 처리 속도 향상

### 비즈니스 성과
- **비용 절감**: API 호출량 감소로 비용 절감
- **사용자 만족**: 더 나은 검색 경험 제공
- **시스템 안정성**: 부족 상황에 대한 강건한 처리

## 📝 구현 체크리스트

### Phase 1 ✅
- [ ] 스마트 검색 범위 계산 함수 구현
- [ ] 필터 강도 분석 로직 추가
- [ ] 동적 승수 계산 알고리즘 구현

### Phase 2 ✅
- [ ] 채널별 그룹화 필터링 구현
- [ ] 구독자 수 사전 필터링 로직 추가
- [ ] 조회수 필터링 최적화

### Phase 3 🔄
- [ ] 부족 시 확장 검색 로직 구현
- [ ] 필터 완화 전략 추가
- [ ] 폴백 검색 전략 구현

### Phase 4 ⏳
- [ ] 라운드 로빈 채널 선택 구현
- [ ] 채널별 제한 로직 추가
- [ ] 유사도 기반 최적 선택

## 🔍 테스트 시나리오

### 기본 테스트
1. **일반 검색**: 경제 관련 영상 → 다양한 채널 결과 확인
2. **필터 적용**: 조회수 10만 이상 → 정확한 필터링 확인
3. **결과 개수**: 30개 요청 → 28-30개 결과 확인

### 엣지 케이스
1. **필터링 실패**: 매우 엄격한 필터 → 확장 검색 동작 확인
2. **채널 부족**: 특정 채널만 결과 → 다양성 확보 확인
3. **API 제한**: 할당량 초과 상황 → 폴백 동작 확인

## 📈 모니터링 및 최적화

### 로그 수집
```typescript
console.log(`검색 효율성: ${finalResults.length}/${targetCount}`)
console.log(`API 호출: ${apiCallCount}회`)
console.log(`처리 시간: ${processingTime}ms`)
console.log(`채널 다양성: ${uniqueChannels}/${finalResults.length}`)
```

### 성능 지표
- 검색 성공률 추이
- 평균 API 호출량
- 사용자 만족도 (별도 설문)
- 시스템 응답 시간

## 🚨 **절대 건드리지 말아야 할 부분들 - 강력한 지침**

### **❌ 금지된 수정 영역**

#### **1. 크레딧 시스템 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// app/api/search/youtube/route.ts (line 179-213)
// 🔄 검색 완료 후 search-record 업데이트 로직
// 크레딧 차감 공식, 환불 로직 등
```

#### **2. 검색 통계 시스템 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// 검색 기록 저장, 통계 반영, 로그 기록 등
// app/api/me/search-record 관련 모든 로직
```

#### **3. API 엔드포인트 구조 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// app/api/search/youtube/route.ts
// 요청/응답 구조, 에러 처리, 미들웨어 등
```

#### **4. 데이터베이스 스키마 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// db/schema.ts
// users, credits, search_records 등의 테이블 구조
```

#### **5. 인증/권한 시스템 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// middleware.ts, 인증 관련 API들
// 사용자 권한 체크, 관리자 권한 등
```

#### **6. 자막 추출 기능 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// lib/youtube-downloader.ts
// yt-dlp 관련 모든 기능
// app/api/captions/route.ts
```

#### **7. UI 컴포넌트들 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// components/ 디렉토리의 모든 파일들
// 검색 결과 표시, 필터 UI 등
```

#### **8. 비즈니스 로직 (절대 건들지 말 것!)**
```typescript
// ❌ 절대 수정 금지
// 플랜별 제한, 가격 정책, 사용자 관리 등
// app/api/admin/* 관련 로직들
```

### **✅ 수정 가능한 영역 (오직 이 부분만!)**
```typescript
// ✅ 오직 이 부분만 수정 가능
// lib/youtube.ts
// - searchSimilarVideos() 함수
// - searchByKeyword() 함수
// - calculateSmartFetchLimit() 함수
// - applyFiltersEfficiently() 함수
// - maximizeResultCount() 함수
// - selectDiverseResults() 함수
// - 기타 검색 알고리즘 관련 헬퍼 함수들
```

### **🔒 보안 지침**
- **절대 다른 파일을 수정하지 말 것**
- **기존 API 응답 구조를 변경하지 말 것**
- **데이터베이스 쿼리를 수정하지 말 것**
- **크레딧 계산 로직을 건들지 말 것**
- **검색 통계 로직을 건들지 말 것**

### **📝 작업 범위 엄격 제한**
**수정 가능 파일**: `lib/youtube.ts` (검색 알고리즘 부분만)
**수정 불가 파일**: 그 외 모든 파일들
**수정 불가 기능**: 크레딧, 통계, 자막, UI, 인증 등 모든 기존 기능

---

*이 문서는 Context7을 활용한 YouTube Data API v3 공식문서 분석을 기반으로 작성되었습니다. 모든 구현은 API 제한사항을 준수하며 최고의 사용자 경험을 제공하는 것을 목표로 합니다.*
