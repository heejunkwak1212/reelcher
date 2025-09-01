import { getMemoryQueueManager } from '@/lib/memory-queue-manager'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queueId = searchParams.get('queueId')

    if (!queueId) {
      return Response.json({ error: 'queueId가 필요합니다.' }, { status: 400 })
    }

    const queueManager = getMemoryQueueManager()
    const status = queueManager.getQueueStatus(queueId)

    if (!status) {
      return Response.json({ error: '대기열에서 해당 요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    return Response.json({
      success: true,
      status: {
        position: status.position,
        totalQueue: status.totalQueue,
        estimatedWaitTime: Math.ceil(status.estimatedWaitTime / 60), // 분 단위
        retryCount: status.retryCount,
        createdAt: status.createdAt
      }
    })

  } catch (error) {
    console.error('대기열 상태 조회 오류:', error)
    return Response.json({ 
      error: '대기열 상태를 조회할 수 없습니다.' 
    }, { status: 500 })
  }
}
