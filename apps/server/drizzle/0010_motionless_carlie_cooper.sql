ALTER TABLE "watch_progress" DROP CONSTRAINT "watch_progress_userId_user_id_fk";
--> statement-breakpoint
DELETE FROM "watch_progress" WHERE "profileId" IS NULL;--> statement-breakpoint
ALTER TABLE "watch_progress" ALTER COLUMN "profileId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_progress" DROP COLUMN "userId";