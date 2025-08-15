"use client"

import { useEffect } from 'react'
import { applyThemeVariables } from '@/lib/theme'

export default function ThemeProvider() {
  useEffect(() => {
    applyThemeVariables()
    // Dev-only lightweight error listeners; avoid triggering Next.js overlay
    if (process.env.NODE_ENV !== 'production') {
      const onUR = (e: PromiseRejectionEvent) => {
        try { 
          e.preventDefault() 
          const reason = e?.reason
          if (reason && typeof reason === 'object' && reason !== null) {
            const stack = (reason as any)?.stack
            const message = (reason as any)?.message
            if (stack || message) {
              // eslint-disable-next-line no-console
              console.warn('[relcher] Unhandled rejection (suppressed):', message || 'Unknown error')
            }
          }
        } catch (err) {
          // Silently handle any error in error handler
        }
      }
      const onErr = (e: ErrorEvent) => {
        try { 
          e.preventDefault()
          if (e?.message && e.message !== '') {
            // eslint-disable-next-line no-console
            console.warn('[relcher] Global error (suppressed):', e.message)
          }
        } catch (err) {
          // Silently handle any error in error handler
        }
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


