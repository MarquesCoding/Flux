CREATE TABLE "favourite" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"mediaItemId" text NOT NULL,
	"keptAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favourite_profileId_viewer_profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."viewer_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favourite_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "favourite_profile_idx" ON "favourite" USING btree ("profileId","mediaItemId");--> statement-breakpoint
CREATE INDEX "favourite_recent_idx" ON "favourite" USING btree ("profileId","keptAt");