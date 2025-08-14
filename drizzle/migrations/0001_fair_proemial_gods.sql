CREATE TABLE "inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "credits" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "searches" ALTER COLUMN "user_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "credits" ADD COLUMN "monthly_grant" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "credits" ADD COLUMN "last_grant_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "plan" text DEFAULT 'free';