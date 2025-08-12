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
  onboardingCompleted: boolean('onboarding_completed').default(false),
})

export const credits = pgTable('credits', {
  userId: uuid('user_id').primaryKey(),
  balance: integer('balance').default(0),
  reserved: integer('reserved').default(0),
})

export const searches = pgTable('searches', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id'),
  keyword: text('keyword'),
  period: text('period'),
  minViews: integer('min_views'),
  maxFollowers: integer('max_followers'),
  requested: integer('requested'),
  returned: integer('returned'),
  cost: integer('cost'),
  createdAt: timestamp('created_at').defaultNow(),
})


