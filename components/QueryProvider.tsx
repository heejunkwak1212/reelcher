"use client"

import { PropsWithChildren, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './ErrorBoundary'

export default function QueryProvider({ children }: PropsWithChildren) {
  const [client] = useState(() => {
    try {
      return new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      })
    } catch (error) {
      console.error('Failed to create QueryClient:', error)
      // Fallback QueryClient
      return new QueryClient()
    }
  })
  
  if (!client) {
    return <div>Loading...</div>
  }
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ErrorBoundary>
  )
}



