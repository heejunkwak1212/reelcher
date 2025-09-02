-- 🔥 토스 빌링 웹훅 기반 크레딧 재지급 시스템 SQL (수정버전)
-- 실행 순서: Supabase SQL Editor에서 차례대로 실행

-- 1. 웹훅 로그 테이블 생성
CREATE TABLE IF NOT EXISTS billing_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payment_key TEXT,
  order_id TEXT NOT NULL,
  billing_key TEXT,
  customer_key TEXT,
  status TEXT,
  amount INTEGER,
  payment_method TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 2. 구독 정보 테이블 생성 (기존 프로젝트에 없었음)
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'business')),
  billing_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled', 'payment_failed')),
  toss_customer_key TEXT,
  renewed_at TIMESTAMPTZ,
  next_charge_at TIMESTAMPTZ,
  last_webhook_at TIMESTAMPTZ,
  renewal_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 외래키 제약조건
  CONSTRAINT fk_subscriptions_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE
);

-- 3. RLS 정책 설정
ALTER TABLE billing_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 관리자만 웹훅 로그 조회 가능
CREATE POLICY "Admin can view webhook logs" ON billing_webhook_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- 사용자는 자신의 구독 정보만 조회 가능
CREATE POLICY "Users can view own subscription" ON subscriptions
FOR SELECT USING (auth.uid() = user_id);

-- 관리자는 모든 구독 정보 조회 가능
CREATE POLICY "Admin can view all subscriptions" ON subscriptions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- 4. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_order_id ON billing_webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON billing_webhook_logs(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing_key ON subscriptions(billing_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_charge ON subscriptions(next_charge_at) WHERE status = 'active';

-- 5. 크레딧 재지급 함수 생성
CREATE OR REPLACE FUNCTION renew_user_credits(
  p_user_id UUID,
  p_plan TEXT,
  p_order_id TEXT
) RETURNS JSON AS $$
DECLARE
  credit_amount INTEGER;
  current_balance INTEGER;
  result JSON;
BEGIN
  -- 플랜별 크레딧 결정
  CASE p_plan
    WHEN 'starter' THEN credit_amount := 2000;
    WHEN 'pro' THEN credit_amount := 7000;
    WHEN 'business' THEN credit_amount := 20000;
    ELSE credit_amount := 0;
  END CASE;
  
  IF credit_amount = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid plan');
  END IF;
  
  -- 현재 잔액 조회
  SELECT COALESCE(balance, 0) INTO current_balance 
  FROM credits WHERE user_id = p_user_id;
  
  -- 크레딧 초기화 및 재지급
  INSERT INTO credits (user_id, balance, reserved, last_grant_at, cycle_start_date, next_grant_date)
  VALUES (
    p_user_id, 
    credit_amount, 
    0, 
    NOW(), 
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = credit_amount,
    last_grant_at = NOW(),
    cycle_start_date = CURRENT_DATE,
    next_grant_date = CURRENT_DATE + INTERVAL '1 month';
  
  -- 구독 갱신 정보 업데이트
  INSERT INTO subscriptions (user_id, plan, renewed_at, next_charge_at, last_webhook_at, renewal_count)
  VALUES (
    p_user_id,
    p_plan,
    NOW(),
    NOW() + INTERVAL '1 month',
    NOW(),
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = p_plan,
    renewed_at = NOW(),
    next_charge_at = NOW() + INTERVAL '1 month',
    last_webhook_at = NOW(),
    renewal_count = COALESCE(subscriptions.renewal_count, 0) + 1;
  
  -- profiles 테이블의 plan도 업데이트
  UPDATE profiles SET 
    plan = p_plan,
    last_payment_date = NOW()
  WHERE user_id = p_user_id;
  
  -- 결과 반환
  result := json_build_object(
    'success', true,
    'user_id', p_user_id,
    'plan', p_plan,
    'credits_granted', credit_amount,
    'previous_balance', current_balance,
    'new_balance', credit_amount,
    'order_id', p_order_id,
    'renewed_at', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 웹훅 로그 트리거 함수
CREATE OR REPLACE FUNCTION update_webhook_processed()
RETURNS TRIGGER AS $$
BEGIN
  NEW.processed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 구독 테이블 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
DROP TRIGGER IF EXISTS trigger_webhook_processed ON billing_webhook_logs;
CREATE TRIGGER trigger_webhook_processed
  BEFORE UPDATE ON billing_webhook_logs
  FOR EACH ROW
  WHEN (OLD.processed = FALSE AND NEW.processed = TRUE)
  EXECUTE FUNCTION update_webhook_processed();

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- 9. 사용자 ID 추출 함수 (orderId에서 user_id 추출)
CREATE OR REPLACE FUNCTION extract_user_id_from_order_id(order_id TEXT)
RETURNS UUID AS $$
DECLARE
  user_id_text TEXT;
BEGIN
  -- subscription_USER_ID_TIMESTAMP 형식에서 USER_ID 추출
  IF order_id LIKE 'subscription_%' THEN
    user_id_text := split_part(order_id, '_', 2);
    -- UUID 형식 검증
    IF user_id_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN user_id_text::UUID;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
SELECT 'Toss Billing Webhook Credit Renewal System - SQL Migration Completed Successfully!' as status;
