ALTER TABLE "library" ADD COLUMN "lastScanAdded" integer;--> statement-breakpoint
ALTER TABLE "library" ADD COLUMN "lastScanUpdated" integer;--> statement-breakpoint
ALTER TABLE "library" ADD COLUMN "lastScanRemoved" integer;--> statement-breakpoint
ALTER TABLE "library" ADD COLUMN "lastScanFailed" integer;