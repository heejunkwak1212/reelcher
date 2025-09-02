import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// 검색 기록 생성 스키마
const createRecordSchema = z.object({
  platform: z.enum(['youtube', 'instagram', 'tiktok']),
  search_type: z.enum(['keyword', 'profile', 'url']),
  keyword: z.string().min(1),
  expected_credits: z.number().int().min(0),
  requested_count: z.number().int().min(0).optional(), // 요청한 검색 결과 수
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('pending')
})

// 검색 기록 업데이트 스키마
const updateRecordSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
  results_count: z.number().int().min(0).optional(),
  actual_credits: z.number().int().min(0).optional(),
  refund_amount: z.number().int().min(0).optional(),
  error_message: z.string().optional()
})

// 검색 기록 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const data = createRecordSchema.parse(body)

    console.log(`📝 검색 기록 생성 요청:`, data)

    // 🚀 1단계: 크레딧 즉시 차감 (실제 차감)
    if (data.expected_credits > 0) {
      console.log(`💰 크레딧 즉시 차감: ${data.expected_credits} 크레딧`)
      
      // 현재 크레딧 조회
      const { data: creditData, error: creditError } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      if (creditError || !creditData) {
        console.error('❌ 크레딧 조회 실패:', creditError)
        return NextResponse.json({ error: '크레딧 조회 실패' }, { status: 500 })
      }

      if (creditData.balance < data.expected_credits) {
        console.error(`❌ 크레딧 부족: 잔액 ${creditData.balance}, 필요 ${data.expected_credits}`)
        return NextResponse.json({ error: '크레딧이 부족합니다' }, { status: 402 })
      }

      // 크레딧 차감 실행
      const { error: deductError } = await supabase
        .from('credits')
        .update({
          balance: creditData.balance - data.expected_credits
        })
        .eq('user_id', user.id)

      if (deductError) {
        console.error('❌ 크레딧 차감 실패:', deductError)
        return NextResponse.json({ error: '크레딧 차감 실패' }, { status: 500 })
      }

      console.log(`✅ 크레딧 즉시 차감 완료: ${creditData.balance} → ${creditData.balance - data.expected_credits}`)
    }

    // 🚀 2단계: search_history 테이블에 기록 생성 (credits_used 즉시 반영)
    const { data: searchRecord, error } = await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        platform: data.platform,
        search_type: data.search_type,
        keyword: data.keyword,
        filters: JSON.stringify({}), // JSON 문자열로 저장
        results_count: 0, // 초기값
        credits_used: data.expected_credits, // 🔥 즉시 반영 (취소되어도 통계에 반영)
        requested_count: data.requested_count, // 요청한 검색 결과 수
        status: data.status,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ 검색 기록 생성 실패:', error)
      
      // 검색 기록 생성 실패 시 크레딧 롤백
      if (data.expected_credits > 0) {
        console.log(`🔄 크레딧 롤백 실행: ${data.expected_credits} 크레딧`)
        try {
          const { data: currentCredit } = await supabase
            .from('credits')
            .select('balance')
            .eq('user_id', user.id)
            .single()
          
          if (currentCredit) {
            await supabase
              .from('credits')
              .update({
                balance: currentCredit.balance + data.expected_credits
              })
              .eq('user_id', user.id)
            console.log(`✅ 크레딧 롤백 완료`)
          }
        } catch (rollbackError) {
          console.error('❌ 크레딧 롤백 실패:', rollbackError)
        }
      }
      
      return NextResponse.json({ error: '검색 기록 생성 실패' }, { status: 500 })
    }

    console.log(`✅ 검색 기록 생성 성공: ${searchRecord.id}`)

    // 🚀 3단계: 검색통계 즉시 반영 (search_counters 업데이트)
    try {
      const todayUtc = new Date()
      const yyyy = todayUtc.getUTCFullYear()
      const mm = String(todayUtc.getUTCMonth() + 1).padStart(2, '0')
      const firstOfMonth = `${yyyy}-${mm}-01`
      const todayStr = todayUtc.toISOString().slice(0,10)
      
      const { data: row } = await supabase.from('search_counters')
        .select('month_start,month_count,today_date,today_count')
        .eq('user_id', user.id)
        .single()
        
      let month_start = row?.month_start || firstOfMonth
      let month_count = Number(row?.month_count || 0)
      let today_date = row?.today_date || todayStr
      let today_count = Number(row?.today_count || 0)
      
      // reset if month crossed
      if (String(month_start) !== firstOfMonth) { 
        month_start = firstOfMonth 
        month_count = 0 
      }
      // reset if day crossed
      if (String(today_date) !== todayStr) { 
        today_date = todayStr
        today_count = 0 
      }
      
      month_count += 1
      today_count += 1
      
      await supabase.from('search_counters').upsert({ 
        user_id: user.id,
        month_start, 
        month_count, 
        today_date, 
        today_count, 
        updated_at: new Date().toISOString()
      })
      
      console.log(`✅ 검색통계 즉시 반영 완료: 오늘 ${today_count}회, 이번달 ${month_count}회`)
    } catch (statsError) {
      console.warn('⚠️ 검색통계 반영 실패:', statsError)
      // 검색통계 실패는 전체 요청을 실패시키지 않음
    }

    return NextResponse.json({
      success: true,
      id: searchRecord.id,
      message: '검색 기록이 생성되었습니다'
    })

  } catch (error) {
    console.error('검색 기록 생성 오류:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: '잘못된 요청 데이터',
        details: error.issues
      }, { status: 400 })
    }

    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// 검색 기록 업데이트 (PUT)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateRecordSchema.parse(body)

    console.log(`🔄 검색 기록 업데이트 요청:`, data)

    // 기존 기록 조회 (expected_credits도 포함)
    const { data: existingRecord, error: fetchError } = await supabase
      .from('search_history')
      .select('id, credits_used, platform, search_type, keyword, refund_amount')
      .eq('id', data.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingRecord) {
      console.error('❌ 검색 기록 조회 실패:', fetchError)
      return NextResponse.json({ error: '검색 기록을 찾을 수 없습니다' }, { status: 404 })
    }

    // 업데이트할 데이터 준비
    const updateData: any = {
      status: data.status,
      updated_at: new Date().toISOString()
    }

    // 결과가 있는 경우 업데이트
    if (data.results_count !== undefined) {
      updateData.results_count = data.results_count
    }

    // 실제 크레딧 사용량 업데이트
    if (data.actual_credits !== undefined) {
      updateData.credits_used = data.actual_credits
      console.log(`💰 크레딧 사용량 업데이트: ${existingRecord.credits_used} → ${data.actual_credits}`)
      
      // 차액 계산 및 환불 처리
      const originalCredits = existingRecord.credits_used // 초기 차감된 크레딧
      const refundAmount = Math.max(0, originalCredits - data.actual_credits)
      
      if (refundAmount > 0) {
        console.log(`💰 크레딧 차액 환불: ${originalCredits} - ${data.actual_credits} = ${refundAmount}`)
        updateData.refund_amount = refundAmount
      }
    }

    // 🔧 반환 크레딧 저장 (중요: refund_amount를 updateData에 포함)
    if (data.refund_amount !== undefined) {
      updateData.refund_amount = data.refund_amount
      console.log(`💰 반환 크레딧 기록 저장: ${data.refund_amount} 크레딧`)
    }

    // 오류 메시지 추가
    if (data.error_message) {
      updateData.error_message = data.error_message
    }

    // 검색 기록 업데이트
    const { error: updateError } = await supabase
      .from('search_history')
      .update(updateData)
      .eq('id', data.id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('❌ 검색 기록 업데이트 실패:', updateError)
      return NextResponse.json({ error: '검색 기록 업데이트 실패' }, { status: 500 })
    }

    // 크레딧 반환 처리 (updateData에서 계산된 refund_amount 또는 요청으로 받은 값 사용)
    const finalRefundAmount = updateData.refund_amount || data.refund_amount || 0
    
    if (finalRefundAmount > 0) {
      console.log(`💰 크레딧 반환 처리: ${finalRefundAmount} 크레딧`)
      
      try {
        // 현재 크레딧 조회
        const { data: creditData, error: creditError } = await supabase
          .from('credits')
          .select('balance')
          .eq('user_id', user.id)
          .single()

        if (!creditError && creditData) {
          // 크레딧 반환
          await supabase
            .from('credits')
            .update({
              balance: creditData.balance + finalRefundAmount
            })
            .eq('user_id', user.id)

          console.log(`✅ 크레딧 반환 완료: ${finalRefundAmount} 크레딧`)
        }
      } catch (refundError) {
        console.error('❌ 크레딧 반환 실패:', refundError)
      }
    } else {
      console.log(`📊 크레딧 반환 없음, credits_used만 업데이트`)
    }

    console.log(`✅ 검색 기록 업데이트 성공: ${data.id}`)

    return NextResponse.json({
      success: true,
      id: data.id,
      message: '검색 기록이 업데이트되었습니다',
      refund_amount: finalRefundAmount
    })

  } catch (error) {
    console.error('검색 기록 업데이트 오류:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: '잘못된 요청 데이터',
        details: error.issues
      }, { status: 400 })
    }

    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
