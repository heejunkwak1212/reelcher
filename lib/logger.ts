/**
 * 프로덕션 환경에서 민감한 정보 로깅을 방지하는 안전한 로거
 */

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const logger = {
  /**
   * 개발 환경에서만 로깅
   */
  dev: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  /**
   * 민감한 정보를 마스킹하여 로깅
   */
  safe: (message: string, data?: any) => {
    if (isDevelopment) {
      console.log(message, data)
    } else {
      // 프로덕션에서는 민감한 정보를 마스킹
      const safeData = maskSensitiveData(data)
      console.log(message, safeData)
    }
  },

  /**
   * 에러는 항상 로깅 (단, 민감한 정보 마스킹)
   */
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args)
    } else {
      // 프로덕션에서는 민감한 정보 마스킹
      const safeArgs = args.map(arg => maskSensitiveData(arg))
      console.error(...safeArgs)
    }
  },

  /**
   * 프로덕션에서도 중요한 정보는 로깅 (마스킹 적용)
   */
  info: (message: string, data?: any) => {
    const safeData = maskSensitiveData(data)
    console.log(`[INFO] ${message}`, safeData)
  },

  /**
   * 경고는 항상 로깅
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args)
  }
}

/**
 * 민감한 정보를 마스킹하는 함수
 */
function maskSensitiveData(data: any): any {
  if (!data) return data
  
  if (typeof data === 'string') {
    // 토큰, 키, 패스워드 등 마스킹
    if (data.length > 10 && (
      data.includes('token') || 
      data.includes('key') || 
      data.includes('secret') ||
      data.includes('password')
    )) {
      return data.substring(0, 4) + '****' + data.substring(data.length - 4)
    }
    return data
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked = { ...data }
    
    // 민감한 필드명들
    const sensitiveFields = [
      'token', 'apikey', 'api_key', 'secret', 'password', 'turnstileToken',
      'APIFY_TOKEN', 'TURNSTILE_SECRET_KEY', 'CRON_SECRET', 'encryptedKey'
    ]
    
    for (const field of sensitiveFields) {
      if (masked[field]) {
        const value = masked[field]
        if (typeof value === 'string' && value.length > 8) {
          masked[field] = value.substring(0, 4) + '****' + value.substring(value.length - 4)
        } else {
          masked[field] = '****'
        }
      }
    }
    
    return masked
  }
  
  return data
}

/**
 * Apify 관련 로깅을 위한 특별한 로거
 */
export const apifyLogger = {
  taskStart: (taskId: string, userId: string) => {
    if (isDevelopment) {
      console.log(`🚀 Apify 태스크 시작: ${taskId} (사용자: ${userId})`)
    } else {
      console.log(`🚀 Apify 태스크 시작: ${taskId} (사용자: ${userId.substring(0, 8)}****)`)
    }
  },

  taskComplete: (taskId: string, runId: string, itemCount: number) => {
    if (isDevelopment) {
      console.log(`✅ Apify 태스크 완료: ${taskId} (RunID: ${runId}, 결과: ${itemCount}개)`)
    } else {
      console.log(`✅ Apify 태스크 완료: ${taskId} (RunID: ${runId.substring(0, 8)}****, 결과: ${itemCount}개)`)
    }
  },

  tokenExists: () => {
    console.log(`🔑 Apify 토큰: ${!!process.env.APIFY_TOKEN ? '존재함' : '없음'}`)
  }
}
