CREATE TABLE "media_override" (
	"id" text PRIMARY KEY NOT NULL,
	"libraryId" text NOT NULL,
	"path" text NOT NULL,
	"externalId" text NOT NULL,
	"externalKind" text NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedBy" text
);
--> statement-breakpoint
ALTER TABLE "media_override" ADD CONSTRAINT "media_override_libraryId_library_id_fk" FOREIGN KEY ("libraryId") REFERENCES "public"."library"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_override_path_idx" ON "media_override" USING btree ("libraryId","path");--> statement-breakpoint
CREATE INDEX "media_override_library_idx" ON "media_override" USING btree ("libraryId");