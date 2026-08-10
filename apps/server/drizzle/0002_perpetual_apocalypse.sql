CREATE TABLE "library" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"path" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastScannedAt" timestamp,
	CONSTRAINT "library_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "media_item" (
	"id" text PRIMARY KEY NOT NULL,
	"libraryId" text NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"sizeBytes" bigint NOT NULL,
	"modifiedAtMs" bigint NOT NULL,
	"container" text NOT NULL,
	"durationSeconds" real NOT NULL,
	"bitrateKbps" integer,
	"videoCodec" text NOT NULL,
	"videoRange" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"audioStreams" jsonb NOT NULL,
	"subtitleStreams" jsonb NOT NULL,
	"addedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_item" ADD CONSTRAINT "media_item_libraryId_library_id_fk" FOREIGN KEY ("libraryId") REFERENCES "public"."library"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_item_path_idx" ON "media_item" USING btree ("libraryId","path");--> statement-breakpoint
CREATE INDEX "media_item_library_idx" ON "media_item" USING btree ("libraryId");--> statement-breakpoint
CREATE INDEX "media_item_title_idx" ON "media_item" USING btree ("title");