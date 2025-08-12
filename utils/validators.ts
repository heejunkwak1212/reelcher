import { z } from 'zod'

export const searchSchema = z.object({
  keyword: z.string().trim().min(1),
  // Restrict to 30-step options only
  limit: z.enum(['30', '60', '90', '120']),
  debug: z.boolean().optional(),
  turnstileToken: z.string().optional(),
})

export type SearchInput = z.infer<typeof searchSchema>

