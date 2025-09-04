-- Apify 비용 추적을 위한 테이블 및 함수 생성

-- 1. Apify 비용 추적 테이블 생성
CREATE TABLE IF NOT EXISTS public.apify_cost_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  search_history_id UUID REFERENCES public.search_history(id),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok')),
  search_type TEXT NOT NULL,
  results_count INTEGER NOT NULL DEFAULT 0,
  cost_per_result DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS 정책 설정
ALTER TABLE public.apify_cost_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 모든 데이터 조회 가능
CREATE POLICY "Admin can view all apify costs" ON public.apify_cost_logs
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 사용자는 자신의 데이터만 조회 가능
CREATE POLICY "Users can view their own apify costs" ON public.apify_cost_logs
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- 시스템에서만 INSERT/UPDATE 가능 (서비스 키 사용)
CREATE POLICY "Service can manage apify costs" ON public.apify_cost_logs
  FOR ALL 
  TO service_role 
  USING (true);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_apify_cost_logs_user_id ON public.apify_cost_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_apify_cost_logs_created_at ON public.apify_cost_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_apify_cost_logs_platform ON public.apify_cost_logs(platform);
CREATE INDEX IF NOT EXISTS idx_apify_cost_logs_search_history_id ON public.apify_cost_logs(search_history_id);

-- 4. 실시간 Apify 비용 계산 함수 (2024년 실제 비용 기준)
CREATE OR REPLACE FUNCTION public.calculate_apify_cost(
  p_platform TEXT,
  p_search_type TEXT,
  p_results_count INTEGER
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  cost_per_result DECIMAL(10,2) := 0.00;
BEGIN
  -- 실제 Apify 액터별 비용 (환율: 1,350원/$)
  CASE p_platform
    WHEN 'instagram' THEN
      CASE p_search_type
        WHEN 'keyword' THEN 
          -- 3개 액터 실행: hashtag($0.002) + scraper($0.0023) + profile($0.0023) = $0.0066
          cost_per_result := 8.91;  -- $0.0066 × 1350원
        WHEN 'profile' THEN 
          -- 1개 액터만 실행: scraper task ($0.0023)
          cost_per_result := 3.105; -- $0.0023 × 1350원
        ELSE cost_per_result := 8.91; -- 기본값은 키워드 검색
      END CASE;
    WHEN 'youtube' THEN
      -- YouTube는 Apify 액터를 사용하지 않으므로 0원
      cost_per_result := 0.00;
    WHEN 'tiktok' THEN
      CASE p_search_type
        WHEN 'keyword' THEN cost_per_result := 4.05; -- $0.003 × 1350원
        WHEN 'profile' THEN cost_per_result := 4.05; -- $0.003 × 1350원
        ELSE cost_per_result := 4.05;
      END CASE;
    ELSE
      cost_per_result := 0.00; -- 알 수 없는 플랫폼은 0원
  END CASE;

  RETURN ROUND(cost_per_result * p_results_count, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. search_history 완료 시 자동으로 Apify 비용 로그 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION public.log_apify_cost_on_search_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- 검색이 완료되고 results_count가 있을 때만 비용 로그 생성
  IF NEW.status = 'completed' AND NEW.results_count > 0 THEN
    INSERT INTO public.apify_cost_logs (
      user_id,
      search_history_id,
      platform,
      search_type,
      results_count,
      cost_per_result,
      total_cost
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.platform,
      COALESCE(NEW.search_type, 'keyword'),
      NEW.results_count,
      public.calculate_apify_cost(NEW.platform, COALESCE(NEW.search_type, 'keyword'), 1),
      public.calculate_apify_cost(NEW.platform, COALESCE(NEW.search_type, 'keyword'), NEW.results_count)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. 트리거 생성
DROP TRIGGER IF EXISTS trigger_log_apify_cost ON public.search_history;
CREATE TRIGGER trigger_log_apify_cost
  AFTER UPDATE OF status ON public.search_history
  FOR EACH ROW
  EXECUTE FUNCTION public.log_apify_cost_on_search_completion();

-- 7. 월별 Apify 비용 집계 뷰 생성
CREATE OR REPLACE VIEW public.monthly_apify_costs AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  platform,
  search_type,
  COUNT(*) as search_count,
  SUM(results_count) as total_results,
  SUM(total_cost) as total_cost,
  AVG(total_cost) as avg_cost_per_search
FROM public.apify_cost_logs
GROUP BY DATE_TRUNC('month', created_at), platform, search_type
ORDER BY month DESC, platform, search_type;

-- 8. 실시간 총 Apify 비용 조회 함수 (관리자용)
CREATE OR REPLACE FUNCTION public.get_total_apify_costs(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (
  total_cost DECIMAL(10,2),
  total_searches BIGINT,
  total_results BIGINT,
  cost_by_platform JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH cost_summary AS (
    SELECT 
      SUM(acl.total_cost) as total_cost,
      COUNT(*) as total_searches,
      SUM(acl.results_count) as total_results,
      jsonb_object_agg(
        acl.platform, 
        jsonb_build_object(
          'cost', SUM(acl.total_cost),
          'searches', COUNT(*),
          'results', SUM(acl.results_count)
        )
      ) as cost_by_platform
    FROM public.apify_cost_logs acl
    WHERE 
      (start_date IS NULL OR acl.created_at >= start_date)
      AND (end_date IS NULL OR acl.created_at <= end_date)
  )
  SELECT 
    cs.total_cost,
    cs.total_searches,
    cs.total_results,
    cs.cost_by_platform
  FROM cost_summary cs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 사용 예시 (실행하지 않음, 주석으로만)
-- SELECT * FROM public.get_total_apify_costs();
-- SELECT * FROM public.get_total_apify_costs('2024-01-01'::timestamptz, '2024-12-31'::timestamptz);
-- SELECT * FROM public.monthly_apify_costs WHERE month >= '2024-01-01';

-- 9. 자막 추출 비용 계산 함수 (별도)
CREATE OR REPLACE FUNCTION public.calculate_caption_cost(
  p_video_count INTEGER
) RETURNS DECIMAL(10,2) AS $$
BEGIN
  -- 자막 추출 액터: $0.038 × 1350원 = 51.3원/영상
  RETURN ROUND(51.3 * p_video_count, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.apify_cost_logs IS 'Apify API 사용 비용 추적 테이블 - 검색별 실제 원가 기록 (환율: 1,350원/$)';
COMMENT ON FUNCTION public.calculate_apify_cost IS 'platform, search_type, results_count 기반 정확한 Apify 비용 계산 (실제 액터 비용 반영)';
COMMENT ON FUNCTION public.calculate_caption_cost IS '자막 추출 액터 비용 계산 ($0.038/영상 × 1350원 = 51.3원/영상)';
COMMENT ON FUNCTION public.get_total_apify_costs IS '기간별 총 Apify 비용 및 플랫폼별 통계 조회 (관리자용)';
COMMENT ON VIEW public.monthly_apify_costs IS '월별 Apify 비용 집계 뷰';
