import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: Request) {
  try {
    // 관리자 권한 확인
    const ssr = await supabaseServer()
    const { data: { user }, error: authError } = await ssr.auth.getUser()
    
    if (authError || !user) {
      return Response.json({ error: '인증 실패' }, { status: 401 })
    }

    const { data: profile } = await ssr.from('profiles').select('role').eq('user_id', user.id).single()
    if (profile?.role !== 'admin') {
      return Response.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    // 서비스 역할로 모든 데이터 조회 (RLS 우회)
    const supabase = supabaseService()
    
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50')
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // 결제 기록 조회 (최신순)
    const { data: payments, count, error: paymentsError } = await supabase
      .from('billing_webhook_logs')
      .select('*', { count: 'exact' })
      .eq('event_type', 'PAYMENT')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (paymentsError) {
      console.error('결제 기록 조회 오류:', paymentsError)
      return Response.json({ error: '결제 기록 조회 실패' }, { status: 500 })
    }

    // 환불 기록 조회 (최신순)
    const { data: refunds, error: refundsError } = await supabase
      .from('cancellation_logs')
      .select('*')
      .eq('refund_processed', true)
      .order('created_at', { ascending: false })

    if (refundsError) {
      console.error('환불 기록 조회 오류:', refundsError)
      return Response.json({ error: '환불 기록 조회 실패' }, { status: 500 })
    }

    // 사용자 정보 조회
    const userIds = [...new Set(payments?.map(p => p.customer_key?.replace('user_', '')) || [])]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, plan')
      .in('user_id', userIds)

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])

    // 결제 데이터 가공
    const processedPayments = payments?.map(payment => {
      const userId = payment.customer_key?.replace('user_', '')
      const profile = profileMap.get(userId || '')
      
      return {
        id: payment.id,
        type: 'payment' as const,
        created_at: payment.created_at,
        amount: payment.amount,
        status: payment.status,
        payment_key: payment.payment_key,
        order_id: payment.order_id,
        payment_method: payment.payment_method,
        customer_key: payment.customer_key,
        user_email: profile?.email || 'Unknown',
        user_name: profile?.display_name || 'Unknown',
        user_plan: profile?.plan || 'Unknown',
        raw_payload: payment.raw_payload,
        processed: payment.processed,
        processing_error: payment.processing_error
      }
    }) || []

    // 환불 데이터 가공
    const processedRefunds = refunds?.map(refund => ({
      id: refund.id,
      type: 'refund' as const,
      created_at: refund.created_at,
      amount: -refund.refund_amount, // 음수로 표시
      status: 'REFUNDED',
      refund_amount: refund.refund_amount,
      reason: refund.reason,
      user_email: refund.user_email || 'Unknown',
      user_name: refund.user_display_name || 'Unknown',
      plan_at_cancellation: refund.plan_at_cancellation,
      cancellation_date: refund.cancellation_date
    })) || []

    // 통계 계산
    const totalPayments = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0
    const totalRefunds = refunds?.reduce((sum, r) => sum + (r.refund_amount || 0), 0) || 0
    const netRevenue = totalPayments - totalRefunds

    const stats = {
      totalPayments,
      totalRefunds,
      netRevenue,
      paymentCount: payments?.length || 0,
      refundCount: refunds?.length || 0,
      successRate: payments?.length ? ((payments.filter(p => p.status === 'DONE').length / payments.length) * 100).toFixed(1) : '0'
    }

    return Response.json({
      payments: processedPayments,
      refunds: processedRefunds,
      stats,
      pagination: {
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })

  } catch (error) {
    console.error('Admin payments API 오류:', error)
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
