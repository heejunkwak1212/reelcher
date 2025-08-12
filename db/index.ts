import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

let cachedClient: ReturnType<typeof postgres> | undefined

export function getPostgresClient() {
  if (cachedClient) return cachedClient
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  cachedClient = postgres(url, { max: 1, prepare: false })
  return cachedClient
}

export const db = drizzle(getPostgresClient())


