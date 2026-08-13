CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"libraryId" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"externalId" text,
	"addedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "seriesId" text;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_libraryId_library_id_fk" FOREIGN KEY ("libraryId") REFERENCES "public"."library"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "series_key_idx" ON "series" USING btree ("libraryId","key");--> statement-breakpoint
CREATE INDEX "series_library_idx" ON "series" USING btree ("libraryId");--> statement-breakpoint
ALTER TABLE "media_item" ADD CONSTRAINT "media_item_seriesId_series_id_fk" FOREIGN KEY ("seriesId") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_item_series_id_idx" ON "media_item" USING btree ("seriesId","seasonNumber");--> statement-breakpoint
INSERT INTO "series" ("id", "libraryId", "key", "title", "externalId")
SELECT
  gen_random_uuid()::text,
  "libraryId",
  "key",
  MIN("seriesTitle"),
  MIN("externalId")
FROM (
  SELECT
    "libraryId",
    "seriesTitle",
    "externalId",
    CASE
      WHEN "externalId" IS NOT NULL AND "externalId" <> ''
        THEN 'catalogue:' || "externalId"
      WHEN "folder" <> ''
        THEN 'folder:' || "folder"
      ELSE 'title:' || lower("seriesTitle")
    END AS "key"
  FROM (
    SELECT
      "libraryId",
      "seriesTitle",
      "externalId",
      CASE
        WHEN "parent" ~* '(^|/)((season|series|s)[ ._-]*[0-9]{1,2}|specials?|extras?)$'
          THEN coalesce(substring("parent" from '^(.*)/[^/]*$'), '')
        ELSE "parent"
      END AS "folder"
    FROM (
      SELECT
        "libraryId",
        "seriesTitle",
        "externalId",
        coalesce(substring("path" from '^(.*)/[^/]*$'), '') AS "parent"
      FROM "media_item"
      WHERE "seriesTitle" IS NOT NULL AND "seriesTitle" <> ''
    ) AS "withParent"
  ) AS "withFolder"
) AS "keyed"
GROUP BY "libraryId", "key";
--> statement-breakpoint
UPDATE "media_item" SET "seriesId" = "series"."id"
FROM "series"
WHERE "series"."libraryId" = "media_item"."libraryId"
  AND "series"."key" = CASE
    WHEN "media_item"."externalId" IS NOT NULL AND "media_item"."externalId" <> ''
      THEN 'catalogue:' || "media_item"."externalId"
    WHEN CASE
        WHEN coalesce(substring("media_item"."path" from '^(.*)/[^/]*$'), '') ~* '(^|/)((season|series|s)[ ._-]*[0-9]{1,2}|specials?|extras?)$'
          THEN coalesce(substring(coalesce(substring("media_item"."path" from '^(.*)/[^/]*$'), '') from '^(.*)/[^/]*$'), '')
        ELSE coalesce(substring("media_item"."path" from '^(.*)/[^/]*$'), '')
      END <> ''
      THEN 'folder:' || CASE
        WHEN coalesce(substring("media_item"."path" from '^(.*)/[^/]*$'), '') ~* '(^|/)((season|series|s)[ ._-]*[0-9]{1,2}|specials?|extras?)$'
          THEN coalesce(substring(coalesce(substring("media_item"."path" from '^(.*)/[^/]*$'), '') from '^(.*)/[^/]*$'), '')
        ELSE coalesce(substring("media_item"."path" from '^(.*)/[^/]*$'), '')
      END
    ELSE 'title:' || lower("media_item"."seriesTitle")
  END
  AND "media_item"."seriesTitle" IS NOT NULL
  AND "media_item"."seriesTitle" <> '';
