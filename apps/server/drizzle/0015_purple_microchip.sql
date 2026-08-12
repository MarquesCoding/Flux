CREATE TABLE "job_trigger" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"trigger" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_item_job" (
	"mediaItemId" text NOT NULL,
	"kind" text NOT NULL,
	"completedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_item_job_mediaItemId_kind_pk" PRIMARY KEY("mediaItemId","kind")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"roleId" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permission_roleId_permission_pk" PRIMARY KEY("roleId","permission")
);
--> statement-breakpoint
CREATE TABLE "user_permission_override" (
	"userId" text NOT NULL,
	"permission" text NOT NULL,
	"effect" text NOT NULL,
	"grantedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_permission_override_userId_permission_pk" PRIMARY KEY("userId","permission")
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"userId" text NOT NULL,
	"roleId" text NOT NULL,
	"grantedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_userId_roleId_pk" PRIMARY KEY("userId","roleId")
);
--> statement-breakpoint
ALTER TABLE "media_item_job" ADD CONSTRAINT "media_item_job_mediaItemId_media_item_id_fk" FOREIGN KEY ("mediaItemId") REFERENCES "public"."media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_role_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_override" ADD CONSTRAINT "user_permission_override_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_role_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_trigger_kind_idx" ON "job_trigger" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "media_item_job_kind_idx" ON "media_item_job" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_idx" ON "role" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_role" USING btree ("roleId");