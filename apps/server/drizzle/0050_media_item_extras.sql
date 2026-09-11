ALTER TABLE "media_item" ADD COLUMN "parentId" text;--> statement-breakpoint
ALTER TABLE "media_item" ADD COLUMN "extraKind" text;--> statement-breakpoint
ALTER TABLE "media_item" ADD CONSTRAINT "media_item_parentId_media_item_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_item_parent_idx" ON "media_item" USING btree ("parentId");