-- profiles 테이블에 마케팅 수신동의 컬럼 추가
ALTER TABLE profiles 
ADD COLUMN marketing_consent BOOLEAN DEFAULT false NOT NULL;

-- 기존 데이터에 대해서는 false로 설정 (이미 DEFAULT로 설정됨)
COMMENT ON COLUMN profiles.marketing_consent IS '마케팅 정보 수신 동의 여부 (온보딩시 선택)';
