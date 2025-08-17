CREATE TABLE "subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"billing_key" text,
	"status" text DEFAULT 'active' NOT NULL,
	"renewed_at" timestamp,
	"next_charge_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "platform" text;