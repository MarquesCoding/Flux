CREATE TABLE "share" (
	"id" text PRIMARY KEY NOT NULL,
	"tokenHash" text NOT NULL,
	"kind" text NOT NULL,
	"mediaItemId" text,
	"seriesId" text,
	"createdBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp,
	"viewCap" integer,
	"revokedAt" timestamp,
	CONSTRAINT "share_one_subject" CHECK (("share"."mediaItemId" is null) <> ("share"."seriesId" is null)),
	CONSTRAINT "share_kind" CHECK ("share"."kind" in ('item', 'series')),
	CONSTRAINT "share_view_cap" CHECK ("share"."viewCap" is null or "share"."viewCap" > 0)
);
--> statement-breakpoint
CREATE TABLE "share_visit" (
	"id" text PRIMARY KEY NOT NULL,
	"shareId" text NOT NULL,
	"joiner" text NOT NULL,
	"firstSeenAt" timestamp DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_seriesId_series_id_fk" FOREIGN KEY ("seriesId") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share" ADD CONSTRAINT "share_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_visit" ADD CONSTRAINT "share_visit_shareId_share_id_fk" FOREIGN KEY ("shareId") REFERENCES "public"."share"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_token_idx" ON "share" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "share_creator_idx" ON "share" USING btree ("createdBy");--> statement-breakpoint
CREATE UNIQUE INDEX "share_visit_joiner_idx" ON "share_visit" USING btree ("shareId","joiner");--> statement-breakpoint
CREATE INDEX "share_visit_share_idx" ON "share_visit" USING btree ("shareId");