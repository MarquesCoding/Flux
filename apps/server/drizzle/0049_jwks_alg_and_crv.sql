ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "alg" text;--> statement-breakpoint
ALTER TABLE "jwks" ADD COLUMN IF NOT EXISTS "crv" text;
