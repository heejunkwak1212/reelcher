-- 사용자별 구독 취소 내역 조회를 위한 RLS 정책 추가

-- 사용자별 구독 취소 내역 조회 RLS 정책 추가
CREATE POLICY "Users can view their own cancellation history"
ON cancellation_logs
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
);

-- 정책 적용 확인을 위한 쿼리
-- SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'cancellation_logs';
