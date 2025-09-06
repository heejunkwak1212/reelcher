/**
 * 데이터베이스 기반 대기열 관리 시스템
 * Supabase를 사용하여 서버리스 환경에서 상태를 공유하는 대기열 시스템
 */

import { supabaseService } from '@/lib/supabase/service'

interface QueuedRequest {
  id: string
  user_id: string
  task_id: string
  task_input: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: 'high' | 'normal' | 'low'
  retry_count: number
  max_retries: number
  error_type?: string
  error_message?: string
  apify_run_id?: string
  result_data?: any
  original_api_endpoint?: string
  original_payload?: Record<string, unknown>
  session_id?: string
  session_step?: number
  created_at: string
  updated_at: string
  processed_at?: string
  completed_at?: string
}

export class DatabaseQueueManager {
  private supabase = supabaseService()

  /**
   * Try-First 실행: 즉시 실행 시도 → 실패 시 DB 대기열에 추가
   */
  async executeWithTryFirst(
    taskId: string,
    input: Record<string, unknown>,
    options: {
      userId: string
      priority?: 'high' | 'normal' | 'low'
      maxRetries?: number
      sessionId?: string
      sessionStep?: number
      originalApiEndpoint?: string
      originalPayload?: Record<string, unknown>
    }
  ): Promise<{ success: boolean; runId?: string; queueId?: string; message: string }> {
    
    console.log(`🎯 DB Try-First 실행 시작: taskId=${taskId}, userId=${options.userId}`)

    try {
      // 즉시 실행 시도
      console.log(`🚀 즉시 실행 시도 (DB Try-First 방식)`)
      const { startTaskRun } = await import('./apify')
      const result = await startTaskRun({
        taskId,
        input,
        token: process.env.APIFY_TOKEN!
      })

      console.log(`✅ 즉시 실행 성공: runId=${result.runId}`)
      return {
        success: true,
        runId: result.runId,
        message: '검색이 시작되었습니다.'
      }
    } catch (error: any) {
      const errorType = error?.type || 'unknown'
      const errorMessage = error?.message || 'Unknown error'

      console.log(`❌ 즉시 실행 실패: type=${errorType}, message=${errorMessage}`)

      // 리소스 부족 에러 확인
      if (this.isResourceLimitError(error)) {
        console.log(`💾 리소스 부족 감지 (${errorType}), DB 대기열로 이동`)

        const queueId = await this.addToQueue({
          userId: options.userId,
          taskId,
          input,
          priority: options.priority || 'normal',
          maxRetries: options.maxRetries || 3,
          sessionId: options.sessionId,
          sessionStep: options.sessionStep,
          originalApiEndpoint: options.originalApiEndpoint,
          originalPayload: options.originalPayload
        })

        return {
          success: false,
          queueId,
          message: `시스템 리소스 부족으로 대기열에 추가되었습니다. 잠시 후 자동으로 처리됩니다.`
        }
      }

      // 다른 에러는 즉시 반환
      console.log(`🔄 다른 에러이므로 즉시 반환: ${errorType} - ${errorMessage}`)
      throw error
    }
  }

  /**
   * DB에 대기열 항목 추가
   */
  async addToQueue(params: {
    userId: string
    taskId: string
    input: Record<string, unknown>
    priority: 'high' | 'normal' | 'low'
    maxRetries: number
    sessionId?: string
    sessionStep?: number
    originalApiEndpoint?: string
    originalPayload?: Record<string, unknown>
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('search_queue')
      .insert({
        user_id: params.userId,
        task_id: params.taskId,
        task_input: params.input,
        priority: params.priority,
        max_retries: params.maxRetries,
        session_id: params.sessionId,
        session_step: params.sessionStep,
        original_api_endpoint: params.originalApiEndpoint,
        original_payload: params.originalPayload,
        status: 'pending'
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ DB 대기열 추가 실패:', error)
      throw new Error('대기열에 추가할 수 없습니다.')
    }

    console.log(`✅ DB 대기열 추가 성공: ${data.id}`)
    return data.id
  }

  /**
   * 대기열 상태 조회 (사용자별)
   */
  async getQueueStatus(queueId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('search_queue')
      .select('*')
      .eq('id', queueId)
      .eq('user_id', userId)
      .single()

    if (error) {
      console.log(`❌ DB 대기열 상태 조회 실패: ${queueId}, error:`, error)
      return null
    }

    // 대기열에서의 위치 계산 (pending 상태 중에서)
    if (data.status === 'pending') {
      const { count } = await this.supabase
        .from('search_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', data.created_at)

      const position = (count || 0) + 1

      return {
        id: data.id,
        status: data.status,
        position,
        retryCount: data.retry_count,
        createdAt: data.created_at,
        estimatedWaitTime: this.calculateWaitTime(position)
      }
    }

    // 완료된 경우 결과 데이터와 함께 반환
    if (data.status === 'completed' && data.result_data) {
      // 세션의 경우 모든 단계 완료 확인 (1단계만 체크)
      if (data.session_id && data.session_step === 1) {
        console.log(`🔍 [DEBUG] 세션 1단계 완료, 전체 세션 상태 확인: ${data.session_id}`)
        
        const sessionResult = await this.getCompleteSessionResult(data.session_id, userId)
        if (sessionResult) {
          console.log(`🎉 [DEBUG] 세션 전체 완료, 통합 결과 반환`)
          return sessionResult
        } else {
          console.log(`⏳ [DEBUG] 세션 일부 단계 아직 진행 중`)
          return {
            id: data.id,
            status: 'processing',
            sessionId: data.session_id,
            sessionStep: data.session_step,
            message: '세션의 다른 단계들이 처리 중입니다.'
          }
        }
      }

      return {
        id: data.id,
        status: data.status,
        result: data.result_data,
        apifyRunId: data.apify_run_id,
        completedAt: data.completed_at
      }
    }

    // 실패한 경우 에러 정보와 함께 반환
    if (data.status === 'failed') {
      return {
        id: data.id,
        status: data.status,
        errorType: data.error_type,
        errorMessage: data.error_message,
        retryCount: data.retry_count
      }
    }

    // 처리 중인 경우
    return {
      id: data.id,
      status: data.status,
      processedAt: data.processed_at
    }
  }

  /**
   * 대기열 처리 (Cron Job에서 호출)
   */
  async processQueue(): Promise<{ processed: number; errors: string[] }> {
    console.log(`🔄 DB 대기열 처리 시작`)

    // pending 상태인 항목들을 올바른 세션 우선순위로 가져오기
    // 세션 우선순위: 이미 시작된 세션의 연속 단계(2단계, 3단계)만 최우선
    // 1. 세션 연속성: session_step > 1인 항목들 (이미 시작된 세션) - 최우선
    // 2. 일반 대기열: session_step = 1 또는 null인 항목들 (생성시간 순)

    console.log(`🔍 [DEBUG] 올바른 세션 우선순위로 대기열 조회`)
    console.log(`  - 우선순위 1: 연속 세션 단계 (step > 1) - 이미 시작된 세션의 다음 단계`)
    console.log(`  - 우선순위 2: 일반 대기열 (step = 1 또는 null) - 생성 시간 순`)

    // 먼저 세션 연속성 항목들 (step > 1) 조회 - 대폭 확장
    const { data: sessionItems, error: sessionError } = await this.supabase
      .from('search_queue')
      .select('*')
      .eq('status', 'pending')
      .gt('session_step', 1)
      .order('session_step', { ascending: true }) // 2단계 → 3단계
      .order('created_at', { ascending: true })
      .limit(20) // 3 → 20으로 확장

    if (sessionError) {
      console.error('❌ 세션 연속성 항목 조회 실패:', sessionError)
      return { processed: 0, errors: [sessionError.message] }
    }

    // 일반 대기열 항목들 (step = 1 또는 null) 조회 - 대폭 확장
    const sessionCount = sessionItems?.length || 0
    const regularLimit = Math.max(0, 30 - sessionCount) // 5 → 30으로 확장
    
    let regularItems: any[] = []
    if (regularLimit > 0) {
      const { data: items, error: regularError } = await this.supabase
        .from('search_queue')
        .select('*')
        .eq('status', 'pending')
        .or('session_step.is.null,session_step.eq.1')
        .order('priority', { ascending: false }) // high > normal > low
        .order('created_at', { ascending: true }) // 오래된 것부터
        .limit(regularLimit)

      if (regularError) {
        console.error('❌ 일반 대기열 항목 조회 실패:', regularError)
        return { processed: 0, errors: [regularError.message] }
      }
      
      regularItems = items || []
    }

    // 세션 연속성 + 일반 대기열 병합
    const pendingItems = [...(sessionItems || []), ...regularItems]

    console.log(`📊 [DEBUG] 대기열 조회 결과:`)
    console.log(`  - 세션 연속성 항목: ${sessionCount}개`)
    console.log(`  - 일반 대기열 항목: ${regularItems.length}개`)
    console.log(`  - 총 처리 예정: ${pendingItems.length}개`)

    if (pendingItems.length === 0) {
      console.log(`ℹ️ 처리할 대기열 항목이 없습니다`)
      return { processed: 0, errors: [] }
    }

    console.log(`📋 처리할 대기열 항목: ${pendingItems.length}개`)

    let processed = 0
    const errors: string[] = []

    for (const item of pendingItems) {
      try {
        await this.processQueueItem(item)
        processed++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${item.id}: ${errorMsg}`)
        console.error(`❌ 대기열 항목 처리 실패: ${item.id}`, error)
      }
    }

    console.log(`✅ DB 대기열 처리 완료: ${processed}개 성공, ${errors.length}개 실패`)
    return { processed, errors }
  }

  /**
   * 개별 대기열 항목 처리
   */
  private async processQueueItem(item: QueuedRequest) {
    console.log(`🚀 [QUEUE STEP 1] 대기열 항목 처리 시작: ${item.id}`)
    console.log(`📋 [QUEUE STEP 2] 처리 상세:`)
    console.log(`  - 태스크ID: ${item.task_id}`)
    console.log(`  - 사용자ID: ${item.user_id}`)
    console.log(`  - 세션ID: ${item.session_id || 'N/A'}`)
    console.log(`  - 세션 단계: ${item.session_step || 'N/A'}`)
    console.log(`  - 재시도: ${item.retry_count}/${item.max_retries}`)
    console.log(`  - 우선순위: ${item.priority}`)
    console.log(`  - 생성시간: ${item.created_at}`)

    // 상태를 processing으로 변경
    console.log(`🔄 [QUEUE STEP 3] 상태를 processing으로 업데이트 중...`)
    await this.supabase
      .from('search_queue')
      .update({
        status: 'processing',
        processed_at: new Date().toISOString()
      })
      .eq('id', item.id)
    
    console.log(`✅ [QUEUE STEP 4] 상태 업데이트 완료`)

    try {
      // Apify 태스크 실행
      // 외부 서비스 실행 (프로덕션 보안을 위해 상세 로깅 제거)
      const { startTaskRun } = await import('./apify')
      const result = await startTaskRun({
        taskId: item.task_id,
        input: item.task_input,
        token: process.env.APIFY_TOKEN!
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`🎉 [QUEUE STEP 6] 실행 성공:`)
        console.log(`  - 대기열ID: ${item.id}`)
        console.log(`  - 세션 단계: ${item.session_step || 'N/A'}`)
      }

      // 외부 서비스 결과 처리 (프로덕션 보안을 위해 상세 로깅 제거)
      try {
        const { waitForRunItems } = await import('./apify')
        const apifyResult = await waitForRunItems({ 
          token: process.env.APIFY_TOKEN!, 
          runId: result.runId 
        })
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ 결과 가져오기 성공: ${apifyResult.items?.length || 0}개`)
        }

        const resultData = {
          success: true,
          runId: result.runId,
          items: apifyResult.items || [],
          completedAt: new Date().toISOString(),
          fromQueue: true
        }

        // 완료 상태와 함께 실제 결과 데이터 저장
        await this.supabase
          .from('search_queue')
          .update({
            status: 'completed',
            apify_run_id: result.runId,
            result_data: resultData,
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        console.log(`🎉 [DEBUG] 대기열 결과 저장 완료:`)
        console.log(`  - 대기열ID: ${item.id}`)
        console.log(`  - 상태: completed`)
        console.log(`  - 결과 저장: ✅`)

        // 세션 연속성: 다음 단계 자동 추가 (인스타그램 키워드 검색)
        try {
          console.log(`🔗 [DEBUG] 세션 연속성 확인: ${item.id}`)
          await this.handleSessionContinuation(item, apifyResult.items || [])
          console.log(`✅ [DEBUG] 세션 연속성 처리 완료: ${item.id}`)
        } catch (sessionError) {
          console.error(`❌ [DEBUG] 세션 연속성 처리 실패: ${item.id}`, sessionError)
        }

        // 검색 기록 저장 및 크레딧 차감 (search_history 테이블)
        try {
          console.log(`📝 [DEBUG] 대기열 완료 검색 기록 및 크레딧 처리 시작: ${item.id}`)
          await this.saveQueueSearchHistoryAndCredits(item, apifyResult.items || [])
          console.log(`✅ [DEBUG] 대기열 완료 검색 기록 및 크레딧 처리 성공: ${item.id}`)
        } catch (historyError) {
          console.error(`❌ [DEBUG] 대기열 완료 검색 기록 및 크레딧 처리 실패: ${item.id}`, historyError)
        }

      } catch (resultError) {
        console.error(`❌ [DEBUG] Apify 결과 가져오기 실패:`, resultError)
        console.log(`  - RunID: ${result.runId}`)
        console.log(`  - 에러 타입: ${resultError instanceof Error ? resultError.name : typeof resultError}`)
        console.log(`  - 에러 메시지: ${resultError instanceof Error ? resultError.message : String(resultError)}`)
        
        const errorData = {
          success: false,
          runId: result.runId,
          error: 'Apify 결과를 가져올 수 없습니다.',
          errorDetail: resultError instanceof Error ? resultError.message : String(resultError),
          completedAt: new Date().toISOString()
        }

        console.log(`💾 [DEBUG] 에러 상태로 저장 중...`)
        
        // 실패한 경우에도 runId는 저장 (클라이언트에서 재시도 가능)
        await this.supabase
          .from('search_queue')
          .update({
            status: 'completed',
            apify_run_id: result.runId,
            result_data: errorData,
            completed_at: new Date().toISOString()
          })
          .eq('id', item.id)

        console.log(`⚠️ [DEBUG] 에러 상태 저장 완료 - 클라이언트에서 fallback 가능`)
      }

    } catch (error: any) {
      const errorType = error?.type || 'unknown'
      const errorMessage = error?.message || 'Unknown error'

      // 리소스 부족 에러면 다시 pending으로 되돌리기
      if (this.isResourceLimitError(error)) {
        console.log(`💾 여전히 리소스 부족, pending으로 되돌림: ${item.id}`)
        
        await this.supabase
          .from('search_queue')
          .update({
            status: 'pending',
            processed_at: null
          })
          .eq('id', item.id)

        return // 재시도를 위해 pending으로 유지
      }

      // 다른 에러는 재시도 또는 실패 처리
      const newRetryCount = item.retry_count + 1

      if (newRetryCount >= item.max_retries) {
        // 최대 재시도 초과 시 실패 처리
        await this.supabase
          .from('search_queue')
          .update({
            status: 'failed',
            retry_count: newRetryCount,
            error_type: errorType,
            error_message: errorMessage
          })
          .eq('id', item.id)

        console.log(`❌ 대기열 항목 최대 재시도 초과: ${item.id} (${newRetryCount}/${item.max_retries})`)
      } else {
        // 재시도를 위해 pending으로 되돌리기
        await this.supabase
          .from('search_queue')
          .update({
            status: 'pending',
            retry_count: newRetryCount,
            processed_at: null
          })
          .eq('id', item.id)

        console.log(`🔄 대기열 항목 재시도: ${item.id} (${newRetryCount}/${item.max_retries})`)
      }

      throw error
    }
  }

  /**
   * 리소스 부족 에러 감지
   */
  private isResourceLimitError(error: any): boolean {
    const errorType = error?.type || ''
    const errorMessage = error?.message || ''
    const statusCode = error?.statusCode || 0

    // Apify 리소스 부족 에러 타입들
    const resourceErrors = [
      'actor-memory-limit-exceeded',
      'not-enough-usage-to-run-paid-actor',
      'usage-limit-exceeded',
      'concurrent-runs-limit-exceeded',
      'account-usage-limit-exceeded'
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

    return false
  }

  /**
   * 대기 시간 계산
   */
  private calculateWaitTime(position: number): number {
    // 위치별 예상 대기 시간 (분)
    if (position <= 1) return 1
    if (position <= 3) return 3
    if (position <= 5) return 5
    return position * 2 // 위치당 2분씩
  }

  /**
   * 특정 대기열 항목만 처리 (폴링 기반)
   */
  async processSpecificQueueItem(queueId: string, userId: string): Promise<boolean> {
    console.log(`🎯 [DEBUG] 특정 대기열 항목 처리 시작:`)
    console.log(`  - 대기열ID: ${queueId}`)
    console.log(`  - 사용자ID: ${userId}`)

    // 해당 항목 조회 및 pending 상태 확인
    console.log(`🔍 [DEBUG] DB에서 pending 항목 조회 중...`)
    const { data: item, error } = await this.supabase
      .from('search_queue')
      .select('*')
      .eq('id', queueId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single()

    if (error || !item) {
      console.log(`❌ [DEBUG] 처리할 항목 없음:`)
      console.log(`  - 에러: ${error?.message || 'No error'}`)
      console.log(`  - 항목: ${item ? 'Found' : 'Not found'}`)
      console.log(`  - 가능한 원인: 이미 처리됨, 다른 사용자, 또는 존재하지 않음`)
      return false
    }

    console.log(`✅ [DEBUG] 처리할 항목 발견:`)
    console.log(`  - 태스크ID: ${item.task_id}`)
    console.log(`  - 우선순위: ${item.priority}`)
    console.log(`  - 재시도 횟수: ${item.retry_count}/${item.max_retries}`)
    console.log(`  - 생성 시간: ${item.created_at}`)

    try {
      // processing 상태로 변경 (동시 처리 방지)
      console.log(`🔒 [DEBUG] 상태를 processing으로 변경 중...`)
      const { error: updateError } = await this.supabase
        .from('search_queue')
        .update({
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', queueId)
        .eq('status', 'pending') // 여전히 pending인 경우만

      if (updateError) {
        console.log(`⚠️ [DEBUG] 상태 업데이트 실패 (동시성 문제):`)
        console.log(`  - 에러: ${updateError.message}`)
        console.log(`  - 다른 프로세스에서 이미 처리 중인 것으로 추정`)
        return false
      }

      console.log(`✅ [DEBUG] 상태 업데이트 성공 - Apify 실행 시작`)

      // 실제 Apify 실행
      console.log(`🚀 [DEBUG] processQueueItem 호출 시작`)
      await this.processQueueItem(item as any)
      console.log(`🎉 [DEBUG] processQueueItem 완료`)
      
      return true

    } catch (error) {
      console.error(`❌ [DEBUG] 특정 항목 처리 실패:`, error)
      console.log(`  - 에러 타입: ${error instanceof Error ? error.name : typeof error}`)
      console.log(`  - 에러 메시지: ${error instanceof Error ? error.message : String(error)}`)
      
      // 실패 시 다시 pending으로 되돌리기 (재시도 가능)
      console.log(`🔄 [DEBUG] 실패로 인한 상태 롤백 중...`)
      await this.supabase
        .from('search_queue')
        .update({
          status: 'pending',
          processed_at: null
        })
        .eq('id', queueId)

      console.log(`↩️ [DEBUG] 상태 롤백 완료 - 다음 폴링에서 재시도 가능`)
      return false
    }
  }

  /**
   * 세션 연속성을 보장하는 executeWithTryFirst
   */
  async executeWithSessionContinuity(
    taskId: string,
    input: Record<string, unknown>,
    options: {
      userId: string
      priority?: 'high' | 'normal' | 'low'
      maxRetries?: number
      sessionId?: string
      sessionStep?: number
      originalApiEndpoint?: string
      originalPayload?: Record<string, unknown>
      onQueued?: (position: number) => void
    }
  ): Promise<{ success: boolean; runId?: string; queueId?: string; message: string }> {
    
    console.log(`🎯 [DEBUG] DB 세션 연속성 실행:`)
    console.log(`  - taskId: ${taskId}`)
    console.log(`  - sessionId: ${options.sessionId}`)
    console.log(`  - sessionStep: ${options.sessionStep}`)
    console.log(`  - priority: ${options.priority}`)

    try {
      // 즉시 실행 시도 (Try-First 방식)
      console.log(`🚀 [DEBUG] 세션 연속성 즉시 실행 시도`)
      const { startTaskRun } = await import('./apify')
      const result = await startTaskRun({
        taskId,
        input,
        token: process.env.APIFY_TOKEN!
      })

      console.log(`✅ [DEBUG] 세션 연속성 즉시 실행 성공: runId=${result.runId}`)
      return {
        success: true,
        runId: result.runId,
        message: '검색이 시작되었습니다.'
      }
    } catch (error: any) {
      const errorType = error?.type || 'unknown'
      const errorMessage = error?.message || 'Unknown error'

      console.log(`❌ [DEBUG] 세션 연속성 즉시 실행 실패: type=${errorType}`)

      // 리소스 부족 에러 확인
      if (this.isResourceLimitError(error)) {
        console.log(`💾 [DEBUG] 리소스 부족 감지, 세션 연속성 DB 대기열로 이동`)

        const queueId = await this.addToQueue({
          userId: options.userId,
          taskId,
          input,
          priority: options.priority || 'high', // 세션은 기본적으로 높은 우선순위
          maxRetries: options.maxRetries || 3,
          sessionId: options.sessionId,
          sessionStep: options.sessionStep,
          originalApiEndpoint: options.originalApiEndpoint,
          originalPayload: options.originalPayload
        })

        // onQueued 콜백 호출
        if (options.onQueued) {
          // 대기열에서의 위치 계산 (추가 전 대기 중인 항목 수)
          const { count } = await this.supabase
            .from('search_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .lt('created_at', new Date().toISOString()) // 방금 추가된 항목 제외

          options.onQueued((count || 0) + 1)
        }

        return {
          success: false,
          queueId,
          message: `시스템 리소스 부족으로 대기열에 추가되었습니다. ${options.sessionId ? '진행 중인 검색의 연속성이 보장됩니다.' : '잠시 후 자동으로 처리됩니다.'}`
        }
      }

      // 다른 에러는 즉시 반환
      console.log(`🔄 [DEBUG] 세션 연속성 다른 에러이므로 즉시 반환: ${errorType}`)
      throw error
    }
  }

  /**
   * 검색 세션 시작 (활성 세션 추적용 - 현재는 로그용)
   */
  startSearchSession(sessionId: string): void {
    console.log(`🎯 [DEBUG] DB 검색 세션 시작: ${sessionId}`)
  }

  /**
   * 검색 세션 완료 (활성 세션 정리용 - 현재는 로그용)
   */
  completeSearchSession(sessionId: string): void {
    console.log(`✅ [DEBUG] DB 검색 세션 완료: ${sessionId}`)
  }

  /**
   * 대기열 완료 시 검색 기록 저장 및 크레딧 차감
   */
  private async saveQueueSearchHistoryAndCredits(item: QueuedRequest, items: any[]): Promise<void> {
    const { task_id, task_input, user_id, original_payload } = item
    
    console.log(`📝 [DEBUG] 검색 기록 저장:`)
    console.log(`  - taskId: ${task_id}`)
    console.log(`  - userId: ${user_id}`)
    console.log(`  - 결과 개수: ${items.length}`)

    // 플랫폼과 검색 타입 결정
    let platform: string
    let searchType: string  
    let keyword: string
    let filters: any = {}
    let creditsUsed = 0

    // 원래 요청된 limit 확인 (proration 계산용)
    const originalLimit = parseInt((original_payload as any)?.limit || '30')
    const baseCredits = Math.floor((originalLimit / 30) * 100)
    
    if (task_id.includes('tiktok-scraper-task')) {
      platform = 'tiktok'
      
      if (task_id.includes('tiktok-scraper-task-2')) {
        // 키워드 검색
        searchType = 'hashtag'
        keyword = (task_input as any)?.hashtags?.[0] || 'unknown'
        // Proration 적용: (실제 결과 / 요청 결과) * 기본 크레딧
        creditsUsed = Math.floor((items.length / originalLimit) * baseCredits) || baseCredits
      } else {
        // 프로필 검색
        searchType = 'profile'
        keyword = (task_input as any)?.profiles?.[0] || 'unknown'
        creditsUsed = Math.floor((items.length / originalLimit) * baseCredits) || baseCredits
      }
    } else if (task_id.includes('instagram-hashtag-scraper-task')) {
      platform = 'instagram'
      searchType = 'hashtag'
      keyword = (task_input as any)?.hashtags?.[0] || 'unknown'
      // Proration 적용: (실제 결과 / 요청 결과) * 기본 크레딧
      creditsUsed = Math.floor((items.length / originalLimit) * baseCredits) || baseCredits
    } else if (task_id.includes('instagram-profile-scraper-task')) {
      platform = 'instagram'
      searchType = 'profile'  
      keyword = (task_input as any)?.usernames?.[0] || 'unknown'
      creditsUsed = 0 // 프로필 정보는 크레딧 차감 없음
    } else if (task_id.includes('transcriber-task')) {
      platform = 'tiktok' // 기본값, URL에서 재판단 필요
      searchType = 'subtitle_extraction'
      keyword = '자막 추출'
      creditsUsed = 20 // 기본값: Instagram/TikTok
      
      const url = (task_input as any)?.start_urls || ''
      if (typeof url === 'string') {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          platform = 'youtube'
          creditsUsed = 10
        } else if (url.includes('tiktok.com')) {
          platform = 'tiktok'
        } else if (url.includes('instagram.com')) {
          platform = 'instagram'
        }
      }
    } else {
      // 알 수 없는 태스크
      platform = 'unknown'
      searchType = 'unknown'
      keyword = 'unknown'
    }

    // 원본 요청에서 필터 정보 추출
    if (original_payload) {
      const payload = original_payload as any
      if (payload.filters) {
        filters = payload.filters
      }
    }

    console.log(`📊 [DEBUG] 검색 기록 세부사항:`)
    console.log(`  - platform: ${platform}`)
    console.log(`  - searchType: ${searchType}`)
    console.log(`  - keyword: ${keyword}`)
    console.log(`  - resultsCount: ${items.length}`)
    console.log(`  - originalLimit: ${originalLimit}`)
    console.log(`  - baseCredits: ${baseCredits}`)
    console.log(`  - creditsUsed: ${creditsUsed} (proration applied)`)
    console.log(`  - proration: ${items.length}/${originalLimit} = ${((items.length / originalLimit) * 100).toFixed(1)}%`)

    // search_history 테이블에 삽입
    const { error } = await this.supabase
      .from('search_history')
      .insert({
        user_id,
        platform,
        search_type: searchType,
        keyword,
        filters,
        results_count: items.length,
        credits_used: creditsUsed,
        status: 'completed'
      })

    if (error) {
      throw new Error(`검색 기록 저장 실패: ${error.message}`)
    }

    console.log(`✅ [DEBUG] 검색 기록 저장 완료: ${platform} ${searchType} "${keyword}"`)

    // 크레딧 차감 (관리자가 아니고 크레딧이 필요한 경우)
    if (creditsUsed > 0) {
      try {
        console.log(`💰 [DEBUG] 크레딧 차감 시작: ${creditsUsed}`)
        
        // 사용자 현재 크레딧 조회
        const { data: currentCredits, error: creditError } = await this.supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user_id)
          .single()

        if (creditError || !currentCredits) {
          console.warn(`⚠️ [DEBUG] 크레딧 정보 조회 실패, 차감 건너뜀: ${creditError?.message}`)
          return
        }

        // 크레딧 차감
        const newBalance = Math.max(0, currentCredits.balance - creditsUsed)
        
        console.log(`💰 [DEBUG] 크레딧 차감 세부사항:`)
        console.log(`  - 현재잔액: ${currentCredits.balance}`)
        console.log(`  - 실제사용: ${creditsUsed}`)
        console.log(`  - 새잔액: ${newBalance}`)

        const { error: updateError } = await this.supabase
          .from('credits')
          .update({ balance: newBalance })
          .eq('user_id', user_id)

        if (updateError) {
          console.error(`❌ [DEBUG] 크레딧 차감 실패:`, updateError)
        } else {
          console.log(`✅ [DEBUG] 크레딧 차감 성공: ${creditsUsed}`)
        }
      } catch (creditError) {
        console.error(`❌ [DEBUG] 크레딧 차감 처리 중 오류:`, creditError)
      }
    } else {
      console.log(`💰 [DEBUG] 크레딧 차감 없음 (무료 작업 또는 관리자)`)
    }
  }

  /**
   * 세션 연속성 처리: 다음 단계 자동 추가
   */
  private async handleSessionContinuation(item: QueuedRequest, results: any[]): Promise<void> {
    const { task_id, session_id, session_step, user_id, original_api_endpoint, original_payload } = item

    console.log(`🔗 [DEBUG] 세션 연속성 분석:`)
    console.log(`  - 태스크: ${task_id}`)
    console.log(`  - 세션ID: ${session_id}`)
    console.log(`  - 현재 단계: ${session_step}`)
    console.log(`  - 결과 개수: ${results.length}`)

    // 인스타그램 키워드 검색 세션만 처리
    if (!session_id || !task_id.includes('instagram-hashtag-scraper-task') || session_step !== 1) {
      console.log(`⚠️ [DEBUG] 세션 연속성 대상 아님 - 건너뜀`)
      return
    }

    console.log(`🎯 [DEBUG] 인스타그램 키워드 검색 세션 연속성 처리 시작`)

    // 1단계 결과에서 URL 추출 (Details용)
    const reelUrls = results
      .map((item: any) => item.webVideoUrl || item.url)
      .filter((url: string) => url && typeof url === 'string')
      .slice(0, 30) // 최대 30개

    console.log(`📊 [DEBUG] 2단계용 URL 추출: ${reelUrls.length}개`)

    if (reelUrls.length === 0) {
      console.log(`⚠️ [DEBUG] 2단계용 URL이 없어서 세션 종료`)
      return
    }

    // 2단계: Details 수집 (30개씩 배치 처리)
    const batchSize = 30
    const batches: string[][] = []
    for (let i = 0; i < reelUrls.length; i += batchSize) {
      batches.push(reelUrls.slice(i, i + batchSize))
    }

    console.log(`🔄 [DEBUG] 2단계 Details 배치 생성: ${batches.length}개 배치`)

    // 각 배치를 2단계 대기열에 추가
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      
      const queueId = await this.addToQueue({
        userId: user_id,
        taskId: 'bold_argument/instagram-scraper-task',
        input: { 
          directUrls: batch, 
          resultsType: 'posts', 
          addParentData: false, 
          resultsLimit: batch.length 
        },
        priority: 'high', // 세션 연속성은 높은 우선순위
        maxRetries: 3,
        sessionId: session_id,
        sessionStep: 2, // 2단계
        originalApiEndpoint: original_api_endpoint,
        originalPayload: original_payload
      })

      console.log(`✅ [DEBUG] 2단계 배치 ${batchIndex + 1} 대기열 추가: ${queueId}`)
    }

    // 3단계용 사용자명 추출
    const usernames = results
      .map((item: any) => item.username || item.ownerUsername)
      .filter((username: string) => username && typeof username === 'string')
      .slice(0, 60) // 최대 60개

    console.log(`👥 [DEBUG] 3단계용 사용자명 추출: ${usernames.length}개`)

    if (usernames.length > 0) {
      // 3단계: Profile 수집 (30개씩 배치 처리)
      const profileBatches: string[][] = []
      for (let i = 0; i < usernames.length; i += 30) {
        profileBatches.push(usernames.slice(i, i + 30))
      }

      console.log(`👤 [DEBUG] 3단계 Profile 배치 생성: ${profileBatches.length}개 배치`)

      // 각 배치를 3단계 대기열에 추가
      for (let batchIndex = 0; batchIndex < profileBatches.length; batchIndex++) {
        const batch = profileBatches[batchIndex]
        
        const queueId = await this.addToQueue({
          userId: user_id,
          taskId: 'bold_argument/instagram-profile-scraper-task',
          input: { 
            usernames: batch,
            proxyCountryCode: "None",
            maxProfilesPerQuery: 30
          },
          priority: 'normal', // 프로필은 보통 우선순위
          maxRetries: 3,
          sessionId: session_id,
          sessionStep: 3, // 3단계
          originalApiEndpoint: original_api_endpoint,
          originalPayload: original_payload
        })

        console.log(`✅ [DEBUG] 3단계 배치 ${batchIndex + 1} 대기열 추가: ${queueId}`)
      }
    }

    console.log(`🎉 [DEBUG] 세션 연속성 처리 완료 - 2단계: ${batches.length}개, 3단계: ${Math.ceil(usernames.length / 30)}개 배치 추가`)
  }

  /**
   * 세션의 모든 단계 완료 확인 및 통합 결과 반환
   */
  async getCompleteSessionResult(sessionId: string, userId: string): Promise<any | null> {
    console.log(`🔍 [DEBUG] 세션 전체 완료 확인: ${sessionId}`)

    // 해당 세션의 모든 단계 조회
    const { data: sessionItems, error } = await this.supabase
      .from('search_queue')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('session_step', { ascending: true })

    if (error || !sessionItems) {
      console.error(`❌ [DEBUG] 세션 항목 조회 실패:`, error)
      return null
    }

    console.log(`📊 [DEBUG] 세션 단계별 상태:`)
    sessionItems.forEach(item => {
      console.log(`  - 단계 ${item.session_step}: ${item.status} (${item.task_id})`)
    })

    // 모든 단계가 완료되었는지 확인
    const allCompleted = sessionItems.every(item => item.status === 'completed')
    if (!allCompleted) {
      console.log(`⏳ [DEBUG] 세션 미완료 - 일부 단계 진행 중`)
      return null
    }

    console.log(`✅ [DEBUG] 세션 모든 단계 완료 - 결과 통합 시작`)

    // 1단계 (해시태그) 결과
    const stage1 = sessionItems.find(item => item.session_step === 1)
    const hashtagResults = stage1?.result_data?.items || []

    // 2단계 (디테일) 결과들 통합
    const stage2Items = sessionItems.filter(item => item.session_step === 2)
    const detailResults = stage2Items.reduce((acc, item) => {
      const results = item.result_data?.items || []
      return acc.concat(results)
    }, [])

    // 3단계 (프로필) 결과들 통합
    const stage3Items = sessionItems.filter(item => item.session_step === 3)
    const profileResults = stage3Items.reduce((acc, item) => {
      const results = item.result_data?.items || []
      return acc.concat(results)
    }, [])

    console.log(`📊 [DEBUG] 세션 통합 결과:`)
    console.log(`  - 1단계 (해시태그): ${hashtagResults.length}개`)
    console.log(`  - 2단계 (디테일): ${detailResults.length}개`)
    console.log(`  - 3단계 (프로필): ${profileResults.length}개`)

    // 결과 통합: 해시태그 결과 + 디테일 정보 + 프로필 정보
    const integratedResults = hashtagResults.map((hashtagItem: any) => {
      const url = hashtagItem.webVideoUrl || hashtagItem.url
      
      // 해당 URL의 디테일 정보 찾기
      const detailInfo = detailResults.find((detail: any) => 
        detail.url === url || detail.webVideoUrl === url
      )

      // 해당 사용자의 프로필 정보 찾기
      const username = hashtagItem.username || hashtagItem.ownerUsername
      const profileInfo = profileResults.find((profile: any) => 
        profile.username === username
      )

      // 통합된 결과 반환
      return {
        ...hashtagItem,
        // 디테일 정보 병합
        ...(detailInfo && {
          likes: detailInfo.likes || hashtagItem.likes,
          comments: detailInfo.comments || hashtagItem.comments,
          caption: detailInfo.caption || hashtagItem.caption,
          duration: detailInfo.duration || hashtagItem.duration
        }),
        // 프로필 정보 병합
        ...(profileInfo && {
          followers: profileInfo.followers,
          following: profileInfo.following,
          profilePicUrl: profileInfo.profilePicUrl
        })
      }
    })

    console.log(`🎉 [DEBUG] 세션 통합 완료: ${integratedResults.length}개 최종 결과`)

    return {
      id: stage1?.id,
      status: 'completed',
      result: {
        success: true,
        items: integratedResults,
        runId: stage1?.apify_run_id,
        completedAt: new Date().toISOString(),
        fromQueue: true,
        sessionComplete: true,
        sessionId,
        totalStages: sessionItems.length
      },
      apifyRunId: stage1?.apify_run_id,
      completedAt: stage1?.completed_at,
      sessionId,
      sessionComplete: true
    }
  }

  /**
   * 완료된 대기열 항목 정리 (24시간 후)
   */
  async cleanupCompletedItems(): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await this.supabase
      .from('search_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('completed_at', oneDayAgo)
      .select('id')

    if (error) {
      console.error('❌ 완료된 대기열 정리 실패:', error)
      return 0
    }

    const cleanedCount = data?.length || 0
    console.log(`🧹 완료된 대기열 정리: ${cleanedCount}개 삭제`)
    return cleanedCount
  }
}

// 싱글톤 인스턴스
let dbQueueManager: DatabaseQueueManager | null = null

export function getDatabaseQueueManager(): DatabaseQueueManager {
  if (!dbQueueManager) {
    dbQueueManager = new DatabaseQueueManager()
  }
  return dbQueueManager
}
