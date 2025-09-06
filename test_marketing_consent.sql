-- 테스트용: 기존 사용자 1명을 마케팅 수신동의로 설정
-- (실제 동의 없이 설정하는 것이므로 테스트 후 되돌려야 함)

-- 1. 현재 admin 사용자를 마케팅 동의로 설정 (테스트용)
UPDATE profiles 
SET marketing_consent = true 
WHERE role = 'admin' 
LIMIT 1;

-- 2. 확인
SELECT display_name, email, marketing_consent, role
FROM profiles 
WHERE marketing_consent = true;
