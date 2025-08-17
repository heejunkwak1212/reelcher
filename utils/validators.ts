import { z } from 'zod'

export const searchSchema = z.object({
  keyword: z.string().trim().min(1),
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
})

export type SearchInput = z.infer<typeof searchSchema>

