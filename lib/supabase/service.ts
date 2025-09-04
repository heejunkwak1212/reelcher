import { createClient } from '@supabase/supabase-js'

export const supabaseService = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { 
      auth: { persistSession: false },
      global: {
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            // 타임아웃 설정 (15초)
            signal: AbortSignal.timeout(15000),
          });
        },
      },
    },
  )


