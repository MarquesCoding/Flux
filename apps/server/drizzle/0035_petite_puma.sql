CREATE TABLE "log_record" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"level" text NOT NULL,
	"source" text NOT NULL,
	"message" text NOT NULL,
	"detail" text,
	"count" integer DEFAULT 1 NOT NULL,
	"sameEventKey" text NOT NULL,
	"jobId" text,
	"jobKind" text,
	"libraryId" text,
	"mediaId" text,
	"sessionId" text,
	"requestId" text,
	"forgetAfter" timestamp NOT NULL,
	CONSTRAINT "log_record_count_positive" CHECK ("log_record"."count" > 0)
);
--> statement-breakpoint
CREATE INDEX "log_record_at_idx" ON "log_record" USING btree ("at");--> statement-breakpoint
CREATE INDEX "log_record_level_idx" ON "log_record" USING btree ("level","at");--> statement-breakpoint
CREATE INDEX "log_record_source_idx" ON "log_record" USING btree ("source","at");--> statement-breakpoint
CREATE INDEX "log_record_job_idx" ON "log_record" USING btree ("jobId");--> statement-breakpoint
CREATE INDEX "log_record_forget_idx" ON "log_record" USING btree ("forgetAfter");--> statement-breakpoint
CREATE INDEX "log_record_same_event_idx" ON "log_record" USING btree ("sameEventKey","at");