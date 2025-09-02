import { getDatabaseQueueManager } from '@/lib/db-queue-manager'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

/**
 * 대기열 처리 API (Vercel Cron Job용)
 * 1분마다 호출되어 pending 상태의 대기열 항목들을 처리합니다.
 */
export async function POST(request: NextRequest) {
  try {
    // Cron Job 보안 검증 (Vercel Cron Secret 또는 Authorization 헤더)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secure-random-string-here'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('❌ Cron Job 인증 실패:', authHeader)
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Cron Job: 대기열 처리 시작')
    
    const queueManager = getDatabaseQueueManager()
    
    // 대기열 처리 실행
    const result = await queueManager.processQueue()
    
    // 완료된 항목 정리 (24시간 후)
    const cleanedCount = await queueManager.cleanupCompletedItems()
    
    console.log(`✅ Cron Job 완료: ${result.processed}개 처리, ${result.errors.length}개 오류, ${cleanedCount}개 정리`)
    
    return Response.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      cleaned: cleanedCount,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Cron Job 오류:', error)
    
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * 수동 대기열 처리 API (관리자용)
 */
export async function GET(request: NextRequest) {
  try {
    // 개발/테스트 환경에서만 허용
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'Production에서는 GET 요청을 지원하지 않습니다.' }, { status: 403 })
    }

    console.log('🔧 수동 대기열 처리 시작 (개발용)')
    
    const queueManager = getDatabaseQueueManager()
    const result = await queueManager.processQueue()
    
    return Response.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
      note: '개발 환경에서의 수동 실행'
    })

  } catch (error) {
    console.error('❌ 수동 대기열 처리 오류:', error)
    
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
