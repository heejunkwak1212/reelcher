CREATE TABLE "certification_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tx_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "certification_requests_tx_id_unique" UNIQUE("tx_id")
);
--> statement-breakpoint
CREATE TABLE "search_counters" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"today_count" integer DEFAULT 0 NOT NULL,
	"month_count" integer DEFAULT 0 NOT NULL,
	"today_date" text NOT NULL,
	"month_start" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
