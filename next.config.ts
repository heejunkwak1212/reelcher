import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000', 'localhost:3001'] } },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Minimal CSP; will be tightened before prod
          { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https: http://localhost:3000 http://localhost:3001; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

export default nextConfig
