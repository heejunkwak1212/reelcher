-- Fix user_api_keys table structure for new encryption system
-- Add missing columns for AES-256-CBC encryption

ALTER TABLE public.user_api_keys 
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS auth_tag TEXT;

-- Update validation status enum to include network_error
ALTER TABLE public.user_api_keys 
DROP CONSTRAINT IF EXISTS user_api_keys_validation_status_check;

ALTER TABLE public.user_api_keys 
ADD CONSTRAINT user_api_keys_validation_status_check 
CHECK (validation_status = ANY (ARRAY['pending'::text, 'valid'::text, 'invalid'::text, 'quota_exceeded'::text, 'expired'::text, 'network_error'::text]));

-- Update timestamp columns to use timestamptz for consistency
ALTER TABLE public.user_api_keys 
ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC',
ALTER COLUMN last_validated_at TYPE timestamptz USING last_validated_at AT TIME ZONE 'UTC';

-- Add comment for deprecated column
COMMENT ON COLUMN public.user_api_keys.api_key IS 'DEPRECATED: Use encrypted_api_key instead. Will be removed in future version.';
