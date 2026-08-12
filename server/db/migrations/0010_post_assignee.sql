ALTER TABLE "post" ADD COLUMN "assignee_id" text;
--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_post_assignee" ON "post" USING btree ("assignee_id");
