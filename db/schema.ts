import { pgTable, text, integer, boolean, timestamp, serial, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  displayName: text('display_name'),
  howFound: text('how_found'),
  role: text('role'),
  plan: text('plan').default('free'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  phoneNumber: text('phone_number').unique(),
  isVerified: boolean('is_verified').notNull().default(false),
})

export const credits = pgTable('credits', {
  userId: uuid('user_id').primaryKey(),
  balance: integer('balance').default(0),
  reserved: integer('reserved').default(0),
  monthlyGrant: integer('monthly_grant').default(0),
  lastGrantAt: timestamp('last_grant_at'),
})

export const searches = pgTable('searches', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id'),
  keyword: text('keyword'),
  platform: text('platform'), // 추가: instagram, youtube, tiktok
  period: text('period'),
  minViews: integer('min_views'),
  maxFollowers: integer('max_followers'),
  requested: integer('requested'),
  returned: integer('returned'),
  cost: integer('cost'),
  createdAt: timestamp('created_at').defaultNow(),
})

// CMS pages for policies and contact
export const pages = pgTable('pages', {
  slug: text('slug').primaryKey(),
  content: text('content').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: uuid('updated_by'),
})

// Subscriptions (billing key + plan)
export const subscriptions = pgTable('subscriptions', {
  userId: uuid('user_id').primaryKey(),
  plan: text('plan').notNull().default('starter'),
  billingKey: text('billing_key'),
  status: text('status').notNull().default('active'),
  renewedAt: timestamp('renewed_at'),
  nextChargeAt: timestamp('next_charge_at'),
})

export const inquiries = pgTable('inquiries', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id'),
  type: text('type').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const certificationRequests = pgTable('certification_requests', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  txId: text('tx_id').notNull().unique(),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// 정확한 검색 통계를 위한 카운터 테이블
export const searchCounters = pgTable('search_counters', {
  userId: uuid('user_id').primaryKey(),
  todayCount: integer('today_count').default(0).notNull(),
  monthCount: integer('month_count').default(0).notNull(),
  todayDate: text('today_date').notNull(), // YYYY-MM-DD 형식
  monthStart: text('month_start').notNull(), // YYYY-MM-01 형식
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const platformSearches = pgTable('platform_searches', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  platform: text('platform').notNull(), // youtube, tiktok, instagram
  searchType: text('search_type'),
  keyword: text('keyword'),
  url: text('url'),
  filters: text('filters'), // JSON 필터 정보
  resultsCount: integer('results_count'),
  creditsUsed: integer('credits_used'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const monthlyCreditsUsage = pgTable('monthly_credit_usage', {
  userId: uuid('user_id').primaryKey(),
  monthStart: text('month_start').notNull(), // YYYY-MM-01 형식
  totalCreditsUsed: integer('total_credits_used').default(0),
  searchCount: integer('search_count').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
})


