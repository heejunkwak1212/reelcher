import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : undefined

export const searchLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 m') })
  : undefined

// 자막 추출 쿨다운: 30초 간격
export const subtitleCooldown = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(1, '30 s') })
  : undefined

// 이메일 중복 확인: 1분에 10회
export const emailCheckLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') })
  : undefined


