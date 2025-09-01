/**
 * 메모리 부족 시 자동 대기열 관리 시스템
 * Apify의 'actor-memory-limit-exceeded' 에러를 처리하여
 * 자동으로 재시도 대기열에 추가하는 시스템
 */

import ApifyMonitor from './apify-monitor'

interface QueuedRequest {
  id: string
  taskId: string
  input: Record<string, unknown>
  retryCount: number
  maxRetries: number
  createdAt: Date
  priority: 'high' | 'normal' | 'low'
  sessionId?: string // 검색 세션 ID (연속성 보장용)
  sessionStep?: number // 검색 단계 (1: hashtag, 2: details, 3: profile)
  onSuccess?: (runId: string) => void
  onError?: (error: Error) => void
  onQueued?: (queuePosition: number) => void
}

interface MemoryUsageCheck {
  isAvailable: boolean
  usagePercentage: number
  estimatedWaitTime: number
  message: string
}

export class MemoryQueueManager {
  private queue: QueuedRequest[] = []
  private processing = false
  private monitor: ApifyMonitor
  private readonly MEMORY_THRESHOLD = 85 // 85% 이상이면 대기
  private readonly RETRY_INTERVAL = 10000 // 10초마다 체크
  private readonly MAX_QUEUE_SIZE = 50
  private activeSessions = new Set<string>() // 진행 중인 검색 세션

  constructor(apifyToken: string) {
    this.monitor = new ApifyMonitor(apifyToken)
    this.startQueueProcessor()
  }

  /**
   * 메모리 사용량 체크 (현재 Try-First 방식으로 사용하지 않음)
   * 필요 시 향후 사용 가능하도록 보존
   */
  async checkMemoryAvailability(requiredMemory: number = 1024): Promise<MemoryUsageCheck> {
    console.log(`🔍 [미사용] 메모리 체크: ${requiredMemory}MB (Try-First 방식 사용 중)`)
    
    // Try-First 방식에서는 항상 즉시 실행 허용
    return {
      isAvailable: true,
      usagePercentage: 0,
      estimatedWaitTime: 0,
      message: 'Try-First 방식: 즉시 실행 시도'
    }
  }

  /**
   * 요청을 대기열에 추가
   */
  async queueRequest(request: Omit<QueuedRequest, 'id' | 'retryCount' | 'createdAt'>): Promise<string> {
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error('대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.')
    }

    const queuedRequest: QueuedRequest = {
      ...request,
      id: this.generateRequestId(),
      retryCount: 0,
      createdAt: new Date()
    }

    // 우선순위에 따라 정렬하여 삽입
    this.insertByPriority(queuedRequest)
    
    console.log(`🔄 요청이 대기열에 추가됨: ${queuedRequest.id}, 현재 대기열 크기: ${this.queue.length}`)
    
    // 대기열 위치 알림
    const position = this.queue.findIndex(req => req.id === queuedRequest.id) + 1
    queuedRequest.onQueued?.(position)

    return queuedRequest.id
  }

  /**
   * Actor 실행 시도 (Try-First 방식: 일단 실행하고 실패하면 대기열)
   */
  async executeWithTryFirst(
    taskId: string, 
    input: Record<string, unknown>, 
    options: {
      priority?: 'high' | 'normal' | 'low'
      maxRetries?: number
      onSuccess?: (runId: string) => void
      onError?: (error: Error) => void
      onQueued?: (queuePosition: number) => void
    } = {}
  ): Promise<{ success: boolean; runId?: string; queueId?: string; message: string }> {
    
    console.log(`🎯 Try-First 실행 시작: taskId=${taskId}`)
    
    try {
      // 즉시 실행 시도 (메모리 체크 없이)
      console.log(`🚀 즉시 실행 시도 (Try-First 방식)`)
      const { startTaskRun } = await import('./apify')
      const result = await startTaskRun({ 
        taskId, 
        input, 
        token: process.env.APIFY_TOKEN! 
      })
      
      console.log(`✅ 즉시 실행 성공: runId=${result.runId}`)
      options.onSuccess?.(result.runId)
      return {
        success: true,
        runId: result.runId,
        message: '검색이 시작되었습니다.'
      }
    } catch (error: any) {
      const errorType = error?.type || 'unknown'
      const errorMessage = error?.message || 'Unknown error'
      
      console.log(`❌ 즉시 실행 실패: type=${errorType}, message=${errorMessage}`)
      
      // 리소스 부족 에러들 확인
      if (this.isResourceLimitError(error)) {
        console.log(`💾 리소스 부족 감지 (${errorType}), 대기열로 이동`)
        
        const queueId = await this.queueRequest({
          taskId,
          input,
          priority: options.priority || 'normal',
          maxRetries: options.maxRetries || 3,
          onSuccess: options.onSuccess,
          onError: options.onError,
          onQueued: options.onQueued
        })
        
        return {
          success: false,
          queueId,
          message: `시스템 리소스 부족으로 대기열에 추가되었습니다. 잠시 후 자동으로 처리됩니다.`
        }
      }
      
      // 다른 에러는 즉시 반환 (대기열 사용 안함)
      console.log(`🔄 다른 에러이므로 즉시 반환: ${errorType} - ${errorMessage}`)
      options.onError?.(error)
      throw error
    }
  }

  /**
   * 대기열 상태 조회
   */
  getQueueStatus(requestId: string) {
    const index = this.queue.findIndex(req => req.id === requestId)
    if (index === -1) return null

    const request = this.queue[index]
    return {
      position: index + 1,
      totalQueue: this.queue.length,
      estimatedWaitTime: this.calculateWaitTime(),
      retryCount: request.retryCount,
      createdAt: request.createdAt
    }
  }

  /**
   * 대기열 처리기 시작
   */
  private startQueueProcessor() {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return
      
      this.processing = true
      try {
        await this.processQueue()
      } catch (error) {
        console.error('대기열 처리 중 오류:', error)
      } finally {
        this.processing = false
      }
    }, this.RETRY_INTERVAL)
  }

  /**
   * 대기열 처리 로직 (Try-First 방식)
   */
  private async processQueue() {
    if (this.queue.length === 0) return

    const request = this.queue[0] // 우선순위가 가장 높은 요청
    console.log(`🚀 대기열에서 요청 처리 시작: ${request.id}`)

    try {
      // 바로 실행 시도 (메모리 체크 없이)
      const { startTaskRun } = await import('./apify')
      const result = await startTaskRun({
        taskId: request.taskId,
        input: request.input,
        token: process.env.APIFY_TOKEN!
      })

      // 성공 시 대기열에서 제거
      this.queue.shift()
      request.onSuccess?.(result.runId)
      console.log(`✅ 대기열 요청 성공: ${request.id} -> ${result.runId}`)

    } catch (error: any) {
      const errorType = error?.type || 'unknown'
      
      // 리소스 부족 에러면 계속 대기
      if (this.isResourceLimitError(error)) {
        console.log(`💾 여전히 리소스 부족 (${errorType}), 계속 대기: ${request.id}`)
        return
      }

      // 다른 에러는 재시도 또는 실패 처리
      request.retryCount++
      if (request.retryCount >= request.maxRetries) {
        this.queue.shift()
        request.onError?.(error)
        console.log(`❌ 대기열 요청 최대 재시도 초과: ${request.id} (${errorType})`)
      } else {
        console.log(`🔄 대기열 요청 재시도: ${request.id} (${request.retryCount}/${request.maxRetries}) - ${errorType}`)
      }
    }
  }

  /**
   * 리소스 부족 에러 감지 (메모리, 사용량, 크레딧 등)
   */
  private isResourceLimitError(error: any): boolean {
    const errorType = error?.type || ''
    const errorMessage = error?.message || ''
    const statusCode = error?.statusCode || 0
    
    // Apify 리소스 부족 에러 타입들
    const resourceErrors = [
      'actor-memory-limit-exceeded',          // 메모리 부족
      'not-enough-usage-to-run-paid-actor',   // 사용량 부족 (터미널에서 확인)
      'usage-limit-exceeded',                 // 사용량 한계 초과
      'concurrent-runs-limit-exceeded',       // 동시 실행 한계
      'account-usage-limit-exceeded'          // 계정 사용량 한계
    ]
    
    // 타입 기반 체크
    if (resourceErrors.includes(errorType)) {
      console.log(`🔍 리소스 부족 에러 타입 감지: ${errorType}`)
      return true
    }
    
    // 메시지 기반 체크
    const limitMessages = [
      'memory limit',
      'usage limit', 
      'exceed your remaining usage',
      'concurrent runs limit',
      'account limit'
    ]
    
    for (const msg of limitMessages) {
      if (errorMessage.toLowerCase().includes(msg)) {
        console.log(`🔍 리소스 부족 메시지 감지: "${msg}" in "${errorMessage}"`)
        return true
      }
    }
    
    // 상태 코드 기반 체크 (402: Payment Required)
    if (statusCode === 402) {
      console.log(`🔍 리소스 부족 상태 코드 감지: ${statusCode}`)
      return true
    }
    
    console.log(`ℹ️ 리소스 부족 아님: type=${errorType}, status=${statusCode}`)
    return false
  }

  /**
   * 대기 시간 계산
   */
  private calculateWaitTime(usagePercentage: number = 90): number {
    // 사용률에 따른 예상 대기 시간 (초)
    if (usagePercentage > 95) return 300 // 5분
    if (usagePercentage > 90) return 180 // 3분
    if (usagePercentage > 85) return 120 // 2분
    return 60 // 1분
  }

  /**
   * 우선순위에 따른 삽입 (세션 연속성 우선)
   */
  private insertByPriority(request: QueuedRequest) {
    const priorities = { high: 3, normal: 2, low: 1 }
    const requestPriority = priorities[request.priority]
    
    // 진행 중인 세션의 후속 단계는 최우선 처리
    const isActiveSession = request.sessionId && this.activeSessions.has(request.sessionId)
    
    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      const currentItem = this.queue[i]
      const currentIsActiveSession = currentItem.sessionId && this.activeSessions.has(currentItem.sessionId)
      
      // 활성 세션끼리 비교
      if (isActiveSession && currentIsActiveSession) {
        // 세션 단계가 낮을수록 우선 (1단계 > 2단계 > 3단계)
        if ((request.sessionStep || 999) < (currentItem.sessionStep || 999)) {
          insertIndex = i
          break
        }
      }
      // 활성 세션이 일반 요청보다 우선
      else if (isActiveSession && !currentIsActiveSession) {
        insertIndex = i
        break
      }
      // 일반 우선순위 비교
      else if (!isActiveSession && !currentIsActiveSession) {
        if (priorities[currentItem.priority] < requestPriority) {
          insertIndex = i
          break
        }
      }
    }
    
    this.queue.splice(insertIndex, 0, request)
    console.log(`📋 대기열 우선순위 삽입: ${request.sessionId ? `세션 ${request.sessionId}-${request.sessionStep}` : '일반'} → 위치 ${insertIndex}`)
  }

  /**
   * 메모리 요구량 추정
   */
  private estimateMemoryRequirement(taskId: string): number {
    // 태스크별 예상 메모리 사용량 (MB)
    if (taskId.includes('instagram')) return 1024
    if (taskId.includes('tiktok')) return 512
    if (taskId.includes('youtube')) return 256
    return 512 // 기본값
  }

  /**
   * 요청 ID 생성
   */
  private generateRequestId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 검색 세션 시작 (1단계 성공 시 호출)
   */
  startSearchSession(sessionId: string): void {
    this.activeSessions.add(sessionId)
    console.log(`🎯 검색 세션 시작: ${sessionId} (활성 세션: ${this.activeSessions.size}개)`)
  }

  /**
   * 검색 세션 완료 (전체 검색 완료 시 호출)
   */
  completeSearchSession(sessionId: string): void {
    this.activeSessions.delete(sessionId)
    console.log(`✅ 검색 세션 완료: ${sessionId} (활성 세션: ${this.activeSessions.size}개)`)
  }

  /**
   * 세션 연속성을 보장하는 executeWithTryFirst
   */
  async executeWithSessionContinuity(
    taskId: string, 
    input: Record<string, unknown>, 
    options: {
      priority?: 'high' | 'normal' | 'low'
      maxRetries?: number
      sessionId?: string
      sessionStep?: number
      onSuccess?: (runId: string) => void
      onError?: (error: Error) => void
      onQueued?: (queuePosition: number) => void
    } = {}
  ): Promise<{ success: boolean; runId?: string; queueId?: string; message: string }> {
    
    console.log(`🎯 세션 연속성 실행: taskId=${taskId}, 세션=${options.sessionId}-${options.sessionStep}`)
    
    try {
      // 즉시 실행 시도 (Try-First 방식)
      console.log(`🚀 즉시 실행 시도 (세션 연속성 모드)`)
      const { startTaskRun } = await import('./apify')
      const result = await startTaskRun({ 
        taskId, 
        input, 
        token: process.env.APIFY_TOKEN! 
      })
      
      console.log(`✅ 즉시 실행 성공: runId=${result.runId}`)
      options.onSuccess?.(result.runId)
      return {
        success: true,
        runId: result.runId,
        message: '검색이 시작되었습니다.'
      }
    } catch (error: any) {
      const errorType = error?.type || 'unknown'
      const errorMessage = error?.message || 'Unknown error'
      
      console.log(`❌ 즉시 실행 실패: type=${errorType}, message=${errorMessage}`)
      
      // 리소스 부족 에러들 확인
      if (this.isResourceLimitError(error)) {
        console.log(`💾 리소스 부족 감지 (${errorType}), 세션 연속성 대기열로 이동`)
        
        const queueId = await this.queueRequest({
          taskId,
          input,
          priority: options.priority || 'normal',
          maxRetries: options.maxRetries || 3,
          sessionId: options.sessionId,
          sessionStep: options.sessionStep,
          onSuccess: options.onSuccess,
          onError: options.onError,
          onQueued: options.onQueued
        })
        
        return {
          success: false,
          queueId,
          message: `시스템 리소스 부족으로 대기열에 추가되었습니다. ${options.sessionId ? '진행 중인 검색의 연속성이 보장됩니다.' : '잠시 후 자동으로 처리됩니다.'}`
        }
      }
      
      // 다른 에러는 즉시 반환 (대기열 사용 안함)
      console.log(`🔄 다른 에러이므로 즉시 반환: ${errorType} - ${errorMessage}`)
      options.onError?.(error)
      throw error
    }
  }
}

// 싱글톤 인스턴스
let memoryQueueManager: MemoryQueueManager | null = null

export function getMemoryQueueManager(): MemoryQueueManager {
  if (!memoryQueueManager) {
    memoryQueueManager = new MemoryQueueManager(process.env.APIFY_TOKEN!)
  }
  return memoryQueueManager
}
