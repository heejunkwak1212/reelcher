ALTER TABLE "profiles" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_phone_number_unique" UNIQUE("phone_number");