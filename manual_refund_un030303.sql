-- 수동 환불 처리: un030303@naver.com (100원)
-- 사유: 토스 웹훅 누락으로 인한 환불 미처리

-- 1. cancellation_logs에 환불 기록 추가
INSERT INTO cancellation_logs (
  user_id,
  action_type,
  reason,
  plan_at_cancellation,
  credits_at_cancellation,
  refund_eligible,
  refund_amount,
  refund_processed,
  signup_date,
  user_display_name,
  user_phone_number,
  user_email,
  cancellation_date
) VALUES (
  'b7cf5491-7fcc-4562-a42f-4a1b1db8009b',
  'subscription_cancel',
  '수동 환불 처리 (토스 웹훅 누락으로 인한 환불 미처리)',
  'starter',
  0,
  true,
  100,
  true,
  '2025-09-02 14:13:29.200073+00',
  'un030303',
  NULL,
  'un030303@naver.com',
  NOW()
);

-- 2. billing_webhook_logs에 환불 웹훅 기록 추가 (추적용)
INSERT INTO billing_webhook_logs (
  event_type,
  payment_key,
  order_id,
  billing_key,
  customer_key,
  status,
  amount,
  payment_method,
  raw_payload,
  processed,
  processing_error,
  created_at
) VALUES (
  'PAYMENT_CANCELED',
  'bill_20250903235418QVzz3',
  'subscription_user_b7cf5491-7fcc-4562-a42f-4a1b1db8009b_1756911258891',
  NULL,
  'user_b7cf5491-7fcc-4562-a42f-4a1b1db8009b',
  'CANCELED',
  -100,
  'REFUND',
  jsonb_build_object(
    'status', 'CANCELED',
    'refundAmount', 100,
    'reason', 'Manual refund due to webhook failure',
    'processedAt', NOW()
  ),
  true,
  NULL,
  NOW()
);

-- 3. 확인 쿼리
SELECT 'cancellation_logs 확인' as table_name, count(*) as count 
FROM cancellation_logs 
WHERE user_id = 'b7cf5491-7fcc-4562-a42f-4a1b1db8009b' 
AND refund_amount = 100

UNION ALL

SELECT 'billing_webhook_logs 확인' as table_name, count(*) as count 
FROM billing_webhook_logs 
WHERE customer_key = 'user_b7cf5491-7fcc-4562-a42f-4a1b1db8009b' 
AND amount = -100;
