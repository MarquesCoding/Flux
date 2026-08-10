DROP INDEX "watch_progress_viewer_idx";--> statement-breakpoint
DROP INDEX "watch_progress_recent_idx";--> statement-breakpoint
ALTER TABLE "watch_progress" ADD COLUMN "profileId" text;--> statement-breakpoint
ALTER TABLE "watch_progress" ADD CONSTRAINT "watch_progress_profileId_viewer_profile_id_fk" FOREIGN KEY ("profileId") REFERENCES "public"."viewer_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "watch_progress_profile_idx" ON "watch_progress" USING btree ("profileId","mediaItemId");--> statement-breakpoint
CREATE INDEX "watch_progress_recent_idx" ON "watch_progress" USING btree ("profileId","updatedAt");--> statement-breakpoint
INSERT INTO "viewer_profile" ("id", "userId", "name", "colour")
SELECT gen_random_uuid(), u."id", COALESCE(NULLIF(u."name", ''), 'Me'), '#e8503a'
FROM "user" u
WHERE EXISTS (SELECT 1 FROM "watch_progress" w WHERE w."userId" = u."id");--> statement-breakpoint
UPDATE "watch_progress" w
SET "profileId" = p."id"
FROM "viewer_profile" p
WHERE p."userId" = w."userId" AND w."profileId" IS NULL;
