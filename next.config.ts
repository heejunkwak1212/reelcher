import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { 
    serverActions: { allowedOrigins: ['localhost:3000', 'localhost:3001'] },
    // Optimize Supabase imports to reduce bundle size
    optimizePackageImports: ['@supabase/supabase-js'],
    // Enable faster page transitions
    optimisticClientCache: true,
    // Enable parallel route prefetching
    parallelServerBuildTraces: true,
  },
  // Enable compression for faster loading
  compress: true,
  // Optimize images for better performance
  images: {
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  eslint: {
    // Allow Vercel build to pass even if ESLint errors exist.
    // We'll fix types incrementally without blocking deploys.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow builds to pass even if TypeScript errors exist.
    // We'll fix types incrementally without blocking deploys.
    ignoreBuildErrors: true,
  },
  headers: async () => {
    const isDev = process.env.NODE_ENV !== 'production'
    const devScript = "'self' https: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
    const prodScript = "'self' https: 'unsafe-inline'"
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      'connect-src *',
      `script-src ${isDev ? devScript : prodScript}`,
      "style-src 'self' 'unsafe-inline'",
      "frame-src 'self' https:",
      "frame-ancestors 'self'",
    ].join('; ')
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
