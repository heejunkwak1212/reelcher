import type { Config } from 'drizzle-kit'
import * as dotenv from 'dotenv'

// Load envs for CLI tools like drizzle-kit
dotenv.config({ path: '.env.local' })

export default {
  schema: './db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL || '' },
} satisfies Config

