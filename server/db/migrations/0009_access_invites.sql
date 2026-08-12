CREATE TABLE "access_invite" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "role" text NOT NULL,
  "created_by" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_invite" ADD CONSTRAINT "access_invite_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "access_invite" ADD CONSTRAINT "access_invite_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "access_invite_org_idx" ON "access_invite" USING btree ("organization_id");
