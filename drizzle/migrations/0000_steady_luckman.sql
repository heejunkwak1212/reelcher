CREATE TABLE "credits" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0,
	"reserved" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"how_found" text,
	"role" text,
	"onboarding_completed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"keyword" text,
	"period" text,
	"min_views" integer,
	"max_followers" integer,
	"requested" integer,
	"returned" integer,
	"cost" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now()
);
