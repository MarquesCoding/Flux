CREATE TABLE "watch_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"mediaItemId" text NOT NULL,
	"positionSeconds" real NOT NULL,
	"durationSeconds" real NOT NULL,
	"isFinished" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watch_progress_viewer_idx" ON "watch_progress" USING btree ("userId","mediaItemId");--> statement-breakpoint
CREATE INDEX "watch_progress_recent_idx" ON "watch_progress" USING btree ("userId","updatedAt");