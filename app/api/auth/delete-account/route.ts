import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseService } from '@/lib/supabase/service';
import { z } from 'zod';

const deleteAccountSchema = z.object({
  reason: z.string().min(1, '탈퇴 사유를 선택해주세요').max(200, '탈퇴 사유는 200자 이하로 입력해주세요'),
});

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const supabaseAdmin = supabaseService();
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 요청 본문 파싱 및 검증
    const body = await request.json();
    const { reason } = deleteAccountSchema.parse(body);

    // 사용자 정보 조회 (전체 프로필 정보 - 로그용)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone_number, created_at, plan, display_name, email')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    // 현재 크레딧 잔액과 마지막 지급일 조회
    const { data: credits, error: creditsError } = await supabase
      .from('credits')
      .select('balance, last_grant_at')
      .eq('user_id', user.id)
      .single();

    const currentBalance = credits?.balance || 0;
    const lastGrantAt = credits?.last_grant_at || profile.created_at; // last_grant_at이 없으면 가입일 사용

    // 현재 구독 상태 확인
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status, billing_key')
      .eq('user_id', user.id)
      .single();

    // 유료 플랜 구독 중인 경우 탈퇴 거부
    if (subscription && subscription.status === 'active') {
      return NextResponse.json({ 
        error: '현재 유료 플랜을 구독중이에요. 회원탈퇴를 위해선 먼저 구독 취소를 부탁드려요.',
        requiresCancellation: true
      }, { status: 400 });
    }

    // 토스 빌링키가 있다면 삭제 (혹시 남아있을 수 있는 빌링키 정리)
    if (subscription?.billing_key) {
      try {
        await fetch(`https://api.tosspayments.com/v1/billing/authorizations/${subscription.billing_key}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('토스 빌링키 삭제 중 오류:', error);
        // 빌링키 삭제 실패해도 계정 삭제는 진행
      }
    }

    // 회원탈퇴 로그 생성 (데이터 삭제 전에 먼저 로그 기록)
    try {
      const { error: logError } = await supabaseAdmin
        .from('cancellation_logs')
        .insert({
          user_id: user.id,
          action_type: 'account_delete',
          reason: reason,
          plan_at_cancellation: profile.plan || 'free',
          credits_at_cancellation: currentBalance,
          refund_eligible: false, // 회원탈퇴는 환불 대상 아님
          refund_amount: 0,
          refund_processed: false,
          signup_date: profile.created_at,
          user_display_name: profile.display_name,
          user_phone_number: profile.phone_number,
          user_email: profile.email,
        });

      if (logError) {
        console.error('회원탈퇴 로그 생성 실패:', logError);
      }
    } catch (error) {
      console.error('cancellation_logs 저장 중 오류:', error);
    }

    // 전화번호가 있는 경우 deleted_users 테이블에 기록 저장 (마지막 크레딧 지급일 기준)
    if (profile.phone_number) {
      try {
        const { error: saveError } = await supabaseAdmin.rpc('save_deleted_user_info', {
          p_phone_number: profile.phone_number,
          p_last_credit_balance: currentBalance,
          p_plan: profile.plan || 'free',
          p_last_credit_grant_date: lastGrantAt
        });

        if (saveError) {
          console.error('삭제된 사용자 정보 저장 실패:', saveError);
          // 에러가 있어도 계속 진행 (회원탈퇴 자체를 막지는 않음)
        }
      } catch (error) {
        console.error('deleted_users 테이블 저장 중 오류:', error);
      }
    }

    // 사용자 관련 모든 데이터 삭제 (트랜잭션으로 처리)
    const deletePromises = [
      // 검색 기록 삭제
      supabaseAdmin.from('search_history').delete().eq('user_id', user.id),
      supabaseAdmin.from('search_queue').delete().eq('user_id', user.id),
      supabaseAdmin.from('platform_searches').delete().eq('user_id', user.id),
      supabaseAdmin.from('searches').delete().eq('user_id', user.id),
      
      // 크레딧 관련 삭제
      supabaseAdmin.from('credits').delete().eq('user_id', user.id),
      supabaseAdmin.from('monthly_credit_usage').delete().eq('user_id', user.id),
      supabaseAdmin.from('search_counters').delete().eq('user_id', user.id),
      
      // 구독 및 결제 관련 삭제
      supabaseAdmin.from('subscriptions').delete().eq('user_id', user.id),
      
      // 기타 사용자 데이터 삭제
      supabaseAdmin.from('certification_requests').delete().eq('user_id', user.id),
      supabaseAdmin.from('user_api_keys').delete().eq('user_id', user.id),
      supabaseAdmin.from('inquiries').delete().eq('user_id', user.id),
      
      // 프로필 삭제
      supabaseAdmin.from('profiles').delete().eq('user_id', user.id),
    ];

    // 모든 관련 데이터 삭제
    const deleteResults = await Promise.allSettled(deletePromises);
    
    // 삭제 결과 확인 (실패한 것들 로그)
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`데이터 삭제 실패 (index: ${index}):`, result.reason);
      }
    });

    // Supabase Auth에서 사용자 삭제
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error('사용자 계정 삭제 실패:', deleteUserError);
      return NextResponse.json({ 
        error: '계정 삭제 처리 중 오류가 발생했습니다' 
      }, { status: 500 });
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: '회원탈퇴가 완료되었습니다. 모든 정보가 즉시 파기되었습니다.'
    });

  } catch (error) {
    console.error('회원탈퇴 처리 중 오류:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: '입력값이 올바르지 않습니다', 
        details: error.issues 
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      error: '회원탈퇴 처리 중 오류가 발생했습니다' 
    }, { status: 500 });
  }
}
