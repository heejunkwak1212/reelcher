import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export function supabaseServer() {
  const c = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return c.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try { c.set(name, value, options) } catch {}
        },
        remove(name: string, options: any) {
          try { c.set(name, '', { ...options, maxAge: 0 }) } catch {}
        },
      },
    },
  )
}

