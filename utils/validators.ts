import { z } from 'zod'

export const searchSchema = z.object({
  keyword: z.string().trim().min(1).optional(),
  // Fixed options in production: 30/60/90/120. In development, allow '5' for quick testing.
  limit: z
    .union([z.enum(['30', '60', '90', '120']), z.literal('5')])
    .refine((val) => {
      console.log('Validating limit:', val, 'NODE_ENV:', process.env.NODE_ENV)
      return val !== '5' || process.env.NODE_ENV !== 'production'
    }, {
      message: 'Dev limit 5 is not allowed in production',
    }),
  debug: z.boolean().optional(),
  turnstileToken: z.string().optional(),
  // Optional multi-keyword support (server will cap to 3)
  keywords: z.array(z.string().trim().min(1)).max(3).optional(),
  // 검색 타입 추가
  searchType: z.enum(['keyword', 'profile']).optional().default('keyword'),
  // 프로필 검색용 필드
  profileUrl: z.string().trim().min(1).optional(),
  // 기간 필터 (ISO 날짜 문자열)
  onlyPostsNewerThan: z.string().optional(),
})
.refine((data) => {
  // 키워드 검색인 경우 keyword나 keywords가 필요
  if (data.searchType === 'keyword') {
    return !!(data.keyword || (data.keywords && data.keywords.length > 0))
  }
  // 프로필 검색인 경우 profileUrl이 필요
  if (data.searchType === 'profile') {
    return !!data.profileUrl
  }
  return true
}, {
  message: 'Missing required fields for search type',
})

export type SearchInput = z.infer<typeof searchSchema>

