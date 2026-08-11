CREATE TABLE "job_trigger" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"trigger" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_item_job" (
	"mediaItemId" text NOT NULL,
	"kind" text NOT NULL,
	"completedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_item_job_mediaItemId_kind_pk" PRIMARY KEY("mediaItemId","kind")
);
--> statement-breakpoint
ALTER TABLE "media_item_job" ADD CONSTRAINT "media_item_job_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_trigger_kind_idx" ON "job_trigger" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "media_item_job_kind_idx" ON "media_item_job" USING btree ("kind");