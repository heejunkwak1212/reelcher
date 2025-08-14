"use client"

import { useEffect } from 'react'
import { applyThemeVariables } from '@/lib/theme'

export default function ThemeProvider() {
  useEffect(() => {
    applyThemeVariables()
    // Dev-only lightweight error listeners; avoid triggering Next.js overlay
    if (process.env.NODE_ENV !== 'production') {
      const onUR = (e: PromiseRejectionEvent) => {
        try { e.preventDefault() } catch {}
        const reason = (e && (e as any).reason) as unknown
        if (!reason) return
        const msg = typeof reason === 'string' ? reason : (reason as any)?.message
        if (!msg) return
        // eslint-disable-next-line no-console
        console.warn('[relcher] Unhandled rejection (suppressed):', msg)
      }
      const onErr = (e: ErrorEvent) => {
        try { e.preventDefault() } catch {}
        const err = (e?.error as any) || e?.message
        if (!err) return
        // eslint-disable-next-line no-console
        console.warn('[relcher] Global error (suppressed):', err)
      }
      window.addEventListener('unhandledrejection', onUR)
      window.addEventListener('error', onErr, true)
      return () => {
        window.removeEventListener('unhandledrejection', onUR)
        window.removeEventListener('error', onErr, true)
      }
    }
    return () => {
      // no-op in production
    }
  }, [])
  return null
}


