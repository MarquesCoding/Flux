CREATE TABLE "webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"subscriptionId" text NOT NULL,
	"eventId" text NOT NULL,
	"event" text NOT NULL,
	"body" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"firstAttemptAt" timestamp DEFAULT now() NOT NULL,
	"lastAttemptAt" timestamp DEFAULT now() NOT NULL,
	"ok" boolean DEFAULT false NOT NULL,
	"status" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_subscriptionId_webhook_subscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."webhook_subscription"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_delivery_occurrence_idx" ON "webhook_delivery" USING btree ("subscriptionId","eventId");--> statement-breakpoint
CREATE INDEX "webhook_delivery_recent_idx" ON "webhook_delivery" USING btree ("subscriptionId","lastAttemptAt");--> statement-breakpoint
CREATE INDEX "webhook_delivery_pruning_idx" ON "webhook_delivery" USING btree ("lastAttemptAt");