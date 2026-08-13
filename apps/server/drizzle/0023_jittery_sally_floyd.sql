CREATE TABLE "watch_history" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"mediaItemId" text NOT NULL,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"lastWatchedAt" timestamp DEFAULT now() NOT NULL,
	"secondsWatched" real DEFAULT 0 NOT NULL,
	"isFinished" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_profileId_viewer_profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."viewer_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watch_history_recent_idx" ON "watch_history" USING btree ("profileId","lastWatchedAt");--> statement-breakpoint
CREATE INDEX "watch_history_item_idx" ON "watch_history" USING btree ("mediaItemId");