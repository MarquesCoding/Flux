CREATE TABLE "rating" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"mediaItemId" text,
	"seriesId" text,
	"stars" integer NOT NULL,
	"ratedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rating_one_subject" CHECK (("rating"."mediaItemId" is null) <> ("rating"."seriesId" is null)),
	CONSTRAINT "rating_stars_range" CHECK ("rating"."stars" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_profileId_viewer_profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."viewer_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_seriesId_series_id_fk" FOREIGN KEY ("seriesId") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rating_profile_item_idx" ON "rating" USING btree ("profileId","mediaItemId") WHERE "rating"."mediaItemId" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "rating_profile_series_idx" ON "rating" USING btree ("profileId","seriesId") WHERE "rating"."seriesId" is not null;--> statement-breakpoint
CREATE INDEX "rating_item_idx" ON "rating" USING btree ("mediaItemId");--> statement-breakpoint
CREATE INDEX "rating_series_idx" ON "rating" USING btree ("seriesId");