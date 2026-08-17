ALTER TABLE "media_item" ADD COLUMN "videoLevel" integer;--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "videoFrameRate" real;--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "videoIsInterlaced" boolean;--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "videoRefFrames" integer;--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "videoPixelAspect" text;--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "videoRotationDegrees" integer;