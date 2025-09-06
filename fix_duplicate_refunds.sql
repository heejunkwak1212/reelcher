-- 중복 환불 기록 확인 및 정리
-- 1. 중복 환불 기록 확인
SELECT 
  user_id,
  refund_amount,
  cancellation_date,
  COUNT(*) as duplicate_count
FROM cancellation_logs 
WHERE refund_processed = true
  AND cancellation_date >= '2025-09-05 02:50:00'
  AND cancellation_date <= '2025-09-05 03:00:00'
  AND refund_amount = 100
GROUP BY user_id, refund_amount, cancellation_date
HAVING COUNT(*) > 1;

-- 2. 중복 환불 기록 중 하나만 남기고 나머지 삭제
-- (가장 최근에 생성된 것을 제외하고 삭제)
WITH duplicate_refunds AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, refund_amount, DATE_TRUNC('minute', cancellation_date)
      ORDER BY created_at DESC
    ) as row_num
  FROM cancellation_logs 
  WHERE refund_processed = true
    AND cancellation_date >= '2025-09-05 02:50:00'
    AND cancellation_date <= '2025-09-05 03:00:00'
    AND refund_amount = 100
)
DELETE FROM cancellation_logs 
WHERE id IN (
  SELECT id FROM duplicate_refunds WHERE row_num > 1
);

-- 3. 정리 후 결과 확인
SELECT 
  '결제 총액' as type,
  SUM(amount) as total
FROM billing_webhook_logs 
WHERE event_type = 'PAYMENT' 
  AND created_at >= '2025-09-01' 
  AND created_at < '2025-10-01'
  AND status = 'DONE'
  AND processed = true

UNION ALL

SELECT 
  '환불 총액' as type,
  SUM(refund_amount) as total
FROM cancellation_logs 
WHERE cancellation_date >= '2025-09-01' 
  AND cancellation_date < '2025-10-01'
  AND refund_processed = true;
