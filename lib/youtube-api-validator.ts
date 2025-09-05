// YouTube Data API v3 키 검증 유틸리티

export interface YouTubeApiValidationResult {
  isValid: boolean;
  error?: 'invalid' | 'quota_exceeded' | 'network_error' | 'unknown_error';
  errorMessage?: string;
}

// YouTube API 키 유효성 검증
export async function validateYouTubeApiKey(apiKey: string): Promise<YouTubeApiValidationResult> {
  try {
    // YouTube Data API v3의 간단한 엔드포인트를 사용하여 키 검증
    // search 엔드포인트에서 간단한 검색 (mine=true 대신 공개 검색 사용)
    const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&maxResults=1&key=${encodeURIComponent(apiKey)}`;
    
    console.log('🔍 YouTube API 키 검증 시작');
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const responseData = await response.json();
    
    // 응답 상태 코드별 처리
    if (response.ok) {
      // 200: 성공 (유효한 API 키)
      console.log('✅ YouTube API 키 검증 성공');
      return { isValid: true };
      
    } else if (response.status === 400) {
      // 400: 잘못된 요청 (API 키 형식 오류)
      const errorCode = responseData?.error?.code;
      const errorMessage = responseData?.error?.message || 'Invalid API key format';
      
      console.log('❌ YouTube API 키 형식 오류:', errorMessage);
      return {
        isValid: false,
        error: 'invalid',
        errorMessage: errorMessage
      };
      
    } else if (response.status === 401) {
      // 401: 인증 실패 (잘못된 API 키)
      console.log('❌ YouTube API 키 인증 실패');
      return {
        isValid: false,
        error: 'invalid',
        errorMessage: 'API key is invalid or has been revoked'
      };
      
    } else if (response.status === 403) {
      // 403: 권한 없음 (할당량 초과 또는 API 비활성화)
      const errorReason = responseData?.error?.errors?.[0]?.reason;
      const errorMessage = responseData?.error?.message || 'Access forbidden';
      
      console.log('❌ YouTube API 접근 거부:', errorReason, errorMessage);
      
      // 할당량 초과 관련 오류들
      if (errorReason === 'quotaExceeded' || 
          errorReason === 'dailyLimitExceeded' ||
          errorReason === 'rateLimitExceeded' ||
          errorMessage.toLowerCase().includes('quota') ||
          errorMessage.toLowerCase().includes('limit')) {
        return {
          isValid: false,
          error: 'quota_exceeded',
          errorMessage: 'API quota has been exceeded'
        };
      }
      
      // 기타 권한 관련 오류
      return {
        isValid: false,
        error: 'invalid',
        errorMessage: errorMessage
      };
      
    } else if (response.status === 429) {
      // 429: 너무 많은 요청 (할당량 초과)
      console.log('❌ YouTube API 할당량 초과 (429)');
      return {
        isValid: false,
        error: 'quota_exceeded',
        errorMessage: 'Too many requests - quota exceeded'
      };
      
    } else {
      // 기타 오류
      console.log('❌ YouTube API 검증 중 예상치 못한 오류:', response.status, responseData);
      return {
        isValid: false,
        error: 'unknown_error',
        errorMessage: `HTTP ${response.status}: ${responseData?.error?.message || 'Unknown error'}`
      };
    }
    
  } catch (error) {
    console.error('❌ YouTube API 키 검증 중 네트워크 오류:', error);
    return {
      isValid: false,
      error: 'network_error',
      errorMessage: 'Network error occurred while validating API key'
    };
  }
}

// 사용자 친화적인 오류 메시지 생성
export function getValidationErrorMessage(result: YouTubeApiValidationResult): string {
  if (result.isValid) {
    return '';
  }
  
  switch (result.error) {
    case 'invalid':
      return '입력하신 API 키가 올바르지 않아요.';
    case 'quota_exceeded':
      return '오늘 API 키 할당량을 모두 소진했어요. 다른 API 키를 사용해주세요.';
    case 'network_error':
      return '네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'unknown_error':
    default:
      return 'API 키 검증 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
  }
}
