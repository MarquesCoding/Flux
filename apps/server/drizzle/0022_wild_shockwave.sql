CREATE TABLE "account_activity" (
	"userId" text PRIMARY KEY NOT NULL,
	"lastSignInAt" timestamp DEFAULT now() NOT NULL,
	"signInCount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_activity" ADD CONSTRAINT "account_activity_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;