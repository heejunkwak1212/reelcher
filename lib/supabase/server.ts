import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function supabaseServer() {
  // In some Next.js versions the type of cookies() is Promise<ReadonlyRequestCookies>.
  // For compatibility across environments, coerce the store to an untyped handle.
  const c: any = await cookies()
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

