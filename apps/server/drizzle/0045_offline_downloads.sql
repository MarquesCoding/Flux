CREATE TABLE IF NOT EXISTS "prepared_download" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"mediaItemId" text NOT NULL,
	"quality" text NOT NULL,
	"audioLanguages" text[] DEFAULT '{}' NOT NULL,
	"renditionId" text NOT NULL,
	"state" text DEFAULT 'preparing' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"sizeBytes" bigint,
	"failure" text,
	"askedAt" timestamp DEFAULT now() NOT NULL,
	"readyAt" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "download_holding" (
	"id" text PRIMARY KEY NOT NULL,
	"profileId" text NOT NULL,
	"clientId" text NOT NULL,
	"mediaItemId" text NOT NULL,
	"quality" text NOT NULL,
	"heldAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prepared_download" ADD CONSTRAINT "prepared_download_profileId_viewer_profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."viewer_profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prepared_download" ADD CONSTRAINT "prepared_download_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "download_holding" ADD CONSTRAINT "download_holding_profileId_viewer_profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."viewer_profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "download_holding" ADD CONSTRAINT "download_holding_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prepared_download_asked_idx" ON "prepared_download" USING btree ("profileId","mediaItemId","quality");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prepared_download_rendition_idx" ON "prepared_download" USING btree ("renditionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prepared_download_recent_idx" ON "prepared_download" USING btree ("profileId","askedAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "download_holding_one_idx" ON "download_holding" USING btree ("clientId","mediaItemId","quality");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "download_holding_profile_idx" ON "download_holding" USING btree ("profileId","heldAt");
