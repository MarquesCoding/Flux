CREATE TABLE "webhook_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"preset" text DEFAULT 'generic' NOT NULL,
	"events" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastAttemptAt" timestamp,
	"lastStatus" integer,
	"lastError" text
);
--> statement-breakpoint
CREATE INDEX "webhook_subscription_enabled_idx" ON "webhook_subscription" USING btree ("enabled");