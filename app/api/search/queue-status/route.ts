import { getDatabaseQueueManager } from '@/lib/db-queue-manager'
import { supabaseServer } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 사용자 인증 확인
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const queueId = searchParams.get('queueId')

    if (!queueId) {
      return Response.json({ error: 'queueId가 필요합니다.' }, { status: 400 })
    }

    const queueManager = getDatabaseQueueManager()
    const queueData = await queueManager.getQueueStatus(queueId, user.id)

    console.log(`🔍 [DEBUG] DB 대기열 상태 조회 상세:`)
    console.log(`  - 대기열ID: ${queueId}`)
    // 사용자 정보 (프로덕션 보안을 위해 상세 로깅 제거)
    if (process.env.NODE_ENV === 'development') {
      console.log('사용자 인증 확인됨')
    }
    console.log(`  - 조회 결과:`, queueData)

    if (!queueData) {
      console.log(`❌ [DEBUG] 대기열 항목 없음: ${queueId}`)
      return Response.json({ 
        success: false,
        error: '대기열에서 해당 요청을 찾을 수 없습니다.' 
      }, { status: 404 })
    }

    // 🚀 핵심: pending 상태면 즉시 처리 시도 (폴링 기반 처리)
    if (queueData.status === 'pending') {
      console.log(`⚡ [DEBUG] Pending 상태 감지 - 즉시 처리 시도:`)
      console.log(`  - 대기열ID: ${queueId}`)
      console.log(`  - 상태: ${queueData.status}`)
      console.log(`  - 대기 위치: ${queueData.position || 'N/A'}`)
      console.log(`  - 생성 시간: ${queueData.createdAt}`)
      console.log(`  - 재시도 횟수: ${queueData.retryCount || 0}`)
      
      try {
        console.log(`🔧 [DEBUG] processSpecificQueueItem 호출 시작`)
        const processed = await queueManager.processSpecificQueueItem(queueId, user.id)
        console.log(`📊 [DEBUG] processSpecificQueueItem 결과: ${processed}`)
        
        if (processed) {
          console.log(`✅ [DEBUG] 즉시 처리 성공 - 업데이트된 상태 조회 중`)
          
          // 처리 후 업데이트된 상태 다시 조회
          const updatedData = await queueManager.getQueueStatus(queueId, user.id)
          console.log(`📋 [DEBUG] 업데이트된 상태:`, updatedData)
          
          if (updatedData?.status === 'completed' && updatedData.result) {
            console.log(`🎉 [DEBUG] 결과 반환:`)
            console.log(`  - 상태: ${updatedData.status}`)
            console.log(`  - 결과 있음: ${!!updatedData.result}`)
            // 외부 서비스 실행 ID (프로덕션 보안을 위해 상세 로깅 제거)
            if (process.env.NODE_ENV === 'development') {
              console.log('실행 확인됨')
            }
            
            return Response.json({
              success: true,
              completed: true,
              result: updatedData.result,
              processedInstantly: true,
              debug: {
                queueId,
                apifyRunId: updatedData.apifyRunId,
                completedAt: updatedData.completedAt
              }
            })
          } else {
            console.log(`⚠️ [DEBUG] 처리됐지만 결과 없음:`, updatedData)
          }
        } else {
          console.log(`⏳ [DEBUG] 즉시 처리 불가 (리소스 부족), 대기 계속`)
          console.log(`  - RAM 상태: 여전히 부족`)
          console.log(`  - 다음 폴링에서 재시도 예정`)
        }
      } catch (processError) {
        console.error(`❌ [DEBUG] 즉시 처리 실패:`, processError)
        console.log(`  - 에러 타입: ${processError instanceof Error ? processError.name : 'Unknown'}`)
        console.log(`  - 에러 메시지: ${processError instanceof Error ? processError.message : processError}`)
        console.log(`  - 원래 대기열 상태 반환 (fallback)`)
      }
    }

    // 🔄 세션 연속성: 해당 세션의 다른 pending 항목들도 처리 시도
    if (queueData.sessionId) {
      console.log(`🔗 [DEBUG] 세션 연속성 처리 시도: ${queueData.sessionId}`)
      
      try {
        // 해당 세션의 모든 pending 항목들을 우선순위로 처리
        const supabase = await supabaseServer()
        const { data: sessionPendingItems } = await supabase
          .from('search_queue')
          .select('id, session_step, status, task_id')
          .eq('user_id', user.id)
          .eq('session_id', queueData.sessionId)
          .eq('status', 'pending')
          .gt('session_step', 1) // 2단계, 3단계만
          .order('session_step', { ascending: true })
          
        if (sessionPendingItems && sessionPendingItems.length > 0) {
          console.log(`🎯 [DEBUG] 세션 연속성 항목 발견: ${sessionPendingItems.length}개`)
          sessionPendingItems.forEach((item, index) => {
            console.log(`  ${index + 1}. 단계 ${item.session_step}: ${item.task_id} (${item.id})`)
          })
          
          // 각 항목을 순차적으로 처리
          for (const item of sessionPendingItems) {
            console.log(`🚀 [DEBUG] 세션 단계 ${item.session_step} 처리 시작: ${item.id}`)
            
            try {
              const stepProcessed = await queueManager.processSpecificQueueItem(item.id, user.id)
              console.log(`📊 [DEBUG] 세션 단계 ${item.session_step} 처리 결과: ${stepProcessed}`)
              
              if (stepProcessed) {
                console.log(`✅ [DEBUG] 세션 단계 ${item.session_step} 처리 성공`)
              } else {
                console.log(`⚠️ [DEBUG] 세션 단계 ${item.session_step} 처리 실패 - RAM 부족`)
                break // 리소스 부족이면 더 이상 처리하지 않음
              }
            } catch (stepError) {
              console.error(`❌ [DEBUG] 세션 단계 ${item.session_step} 처리 에러:`, stepError)
              break // 에러 발생 시 중단
            }
          }
          
          console.log(`🏁 [DEBUG] 세션 연속성 처리 완료`)
        } else {
          console.log(`📝 [DEBUG] 처리할 세션 연속성 항목 없음`)
        }
      } catch (sessionError) {
        console.error(`❌ [DEBUG] 세션 연속성 처리 에러:`, sessionError)
      }
    }

    // 완료된 경우
    if (queueData.status === 'completed') {
      // 세션이 있는 경우 전체 세션 완료 확인
      if (queueData.sessionId) {
        console.log(`🔍 [DEBUG] 세션 완료 확인: ${queueData.sessionId}`)
        
        try {
          const sessionResult = await queueManager.getCompleteSessionResult(queueData.sessionId, user.id)
          if (sessionResult) {
            console.log(`🎉 [DEBUG] 세션 전체 완료, 통합 결과 반환`)
            return Response.json({
              success: true,
              completed: true,
              result: sessionResult,
              debug: {
                sessionId: queueData.sessionId,
                completedAt: new Date().toISOString()
              }
            })
          } else {
            console.log(`⏳ [DEBUG] 세션 일부 단계 아직 진행 중`)
            return Response.json({
              success: true,
              completed: false,
              status: 'processing',
              message: '세션의 다른 단계들이 처리 중입니다.',
              debug: {
                sessionId: queueData.sessionId,
                currentStep: queueData.sessionStep
              }
            })
          }
        } catch (sessionError) {
          console.error(`❌ [DEBUG] 세션 완료 확인 에러:`, sessionError)
        }
      }
      
      // 이미 결과 데이터가 있으면 바로 반환 (DB 우선)
      if (queueData.result) {
        console.log(`📋 DB에 저장된 결과 반환: ${queueId}`)
        return Response.json({
          success: true,
          completed: true,
          result: queueData.result
        })
      }

      // runId가 있으면 실제 Apify 결과를 가져오기 (fallback)
      if (queueData.apifyRunId) {
        try {
          // 외부 서비스 결과 가져오기 (프로덕션 보안을 위해 상세 로깅 제거)
          const { waitForRunItems } = await import('@/lib/apify')
          const result = await waitForRunItems({ 
            token: process.env.APIFY_TOKEN!, 
            runId: queueData.apifyRunId 
          })
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ 결과 가져오기 성공: ${result.items?.length || 0}개`)
          }
          
          return Response.json({
            success: true,
            completed: true,
            result: {
              success: true,
              runId: queueData.apifyRunId,
              items: result.items || [],
              completedAt: queueData.completedAt
            }
          })
        } catch (error) {
          console.error(`❌ 결과 가져오기 실패`, error)
          
          return Response.json({
            success: true,
            completed: true,
            result: {
              success: false,
              error: '결과를 가져올 수 없습니다.',
              runId: queueData.apifyRunId
            }
          })
        }
      }

      // 이미 결과가 저장되어 있는 경우
      return Response.json({
        success: true,
        completed: true,
        result: queueData.result || {
          success: true,
          runId: queueData.apifyRunId,
          completedAt: queueData.completedAt
        }
      })
    }

    // 실패한 경우
    if (queueData.status === 'failed') {
      return Response.json({
        success: true,
        completed: true,
        result: {
          success: false,
          error: queueData.errorMessage || '작업이 실패했습니다.',
          errorType: queueData.errorType,
          retryCount: queueData.retryCount
        }
      })
    }

    // 처리 중이거나 대기 중인 경우
    return Response.json({
      success: true,
      completed: false,
      status: {
        position: queueData.position || 0,
        estimatedWaitTime: queueData.estimatedWaitTime || 5, // 분 단위
        retryCount: queueData.retryCount || 0,
        createdAt: queueData.createdAt,
        queueStatus: queueData.status // 'pending' or 'processing'
      }
    })

  } catch (error) {
    console.error('DB 대기열 상태 조회 오류:', error)
    return Response.json({ 
      error: '대기열 상태를 조회할 수 없습니다.' 
    }, { status: 500 })
  }
}
