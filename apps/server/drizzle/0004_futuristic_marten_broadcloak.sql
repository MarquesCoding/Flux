CREATE TABLE "media_segment" (
	"id" text PRIMARY KEY NOT NULL,
	"mediaItemId" text NOT NULL,
	"kind" text NOT NULL,
	"startSeconds" real NOT NULL,
	"endSeconds" real NOT NULL,
	"source" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_segment" ADD CONSTRAINT "media_segment_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_segment_kind_idx" ON "media_segment" USING btree ("mediaItemId","kind");--> statement-breakpoint
CREATE INDEX "media_segment_item_idx" ON "media_segment" USING btree ("mediaItemId");