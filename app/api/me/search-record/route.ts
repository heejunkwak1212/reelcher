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

    // search_history 테이블에 기록 생성
    const { data: searchRecord, error } = await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        platform: data.platform,
        search_type: data.search_type,
        keyword: data.keyword,
        filters: JSON.stringify({}), // JSON 문자열로 저장
        results_count: 0, // 초기값
        credits_used: data.expected_credits, // 예상 크레딧으로 초기 설정
        status: data.status,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (error) {
      console.error('❌ 검색 기록 생성 실패:', error)
      return NextResponse.json({ error: '검색 기록 생성 실패' }, { status: 500 })
    }

    console.log(`✅ 검색 기록 생성 성공: ${searchRecord.id}`)

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

    // 기존 기록 조회
    const { data: existingRecord, error: fetchError } = await supabase
      .from('search_history')
      .select('id, credits_used, platform, search_type, keyword')
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

    // 크레딧 반환 처리
    if (data.refund_amount && data.refund_amount > 0) {
      console.log(`💰 크레딧 반환 처리: ${data.refund_amount} 크레딧`)
      
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
              balance: creditData.balance + data.refund_amount
            })
            .eq('user_id', user.id)

          console.log(`✅ 크레딧 반환 완료: ${data.refund_amount} 크레딧`)
          
          // 통계 정확성을 위해 반환된 크레딧을 credits_used에서 제외
          console.log(`📊 통계 정확성을 위해 credits_used 업데이트: ${existingRecord.credits_used} → ${data.actual_credits}`)
        }
      } catch (refundError) {
        console.error('❌ 크레딧 반환 실패:', refundError)
      }
    } else {
      console.log(`📊 크레딧 반환 없음, credits_used만 업데이트: ${existingRecord.credits_used} → ${data.actual_credits || existingRecord.credits_used}`)
    }

    console.log(`✅ 검색 기록 업데이트 성공: ${data.id}`)

    return NextResponse.json({
      success: true,
      id: data.id,
      message: '검색 기록이 업데이트되었습니다',
      refund_amount: data.refund_amount || 0
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
