DROP INDEX IF EXISTS "download_holding_one_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "download_holding_one_idx" ON "download_holding" USING btree ("profileId","clientId","mediaItemId","quality");
