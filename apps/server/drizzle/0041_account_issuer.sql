-- better-auth 1.7 recognises an account by its issuer as well as its provider, and refuses to find
-- one without it. Every account here predates the column, so signing in with a password stopped
-- working the moment the library moved: the user is found, the credential is not, and the server
-- says "User not found" about somebody who plainly exists.
--
-- Added nullable, filled in, then made required — a table with rows in it cannot take a NOT NULL
-- column in one step.
--
-- The values are the ones the library builds for itself: `local:` and the provider for a password,
-- `local:oauth:` and the provider for anything a provider issued. It URI-encodes the provider on the
-- way in, which changes nothing for the ones Flux has.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account"
SET "issuer" = CASE
  WHEN "providerId" = 'credential' THEN 'local:credential'
  ELSE 'local:oauth:' || "providerId"
END
WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;
