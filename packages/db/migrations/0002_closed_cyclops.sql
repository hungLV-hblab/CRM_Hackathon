CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'decided');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"source_tier" text DEFAULT 'company_website' NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_html" text,
	"raw_content" text NOT NULL,
	"extractor_version" text NOT NULL,
	"content_hash" text NOT NULL,
	"fetch_status" "fetch_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"signal_type" "signal_type" NOT NULL,
	"confidence" "confidence" NOT NULL,
	"quote_text" text NOT NULL,
	"quote_start" integer NOT NULL,
	"quote_end" integer NOT NULL,
	"trigger_context" "trigger_context" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_quote_text_not_blank" CHECK (length(btrim("claims"."quote_text")) > 0),
	CONSTRAINT "claims_quote_span_is_valid" CHECK ("claims"."quote_start" >= 0 AND "claims"."quote_end" > "claims"."quote_start")
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"proposal_type" "proposal_type" NOT NULL,
	"target_field" text,
	"current_value" text,
	"proposed_value" text NOT NULL,
	"impact_if_wrong" text,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_target_field_matches_type" CHECK (("proposals"."proposal_type" = 'field_update'
             AND "proposals"."target_field" IN ('industry', 'country', 'size', 'website'))
          OR ("proposals"."proposal_type" = 'timeline_entry' AND "proposals"."target_field" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "proposal_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"decision" "decision" NOT NULL,
	"decided_by" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reject_reason" "reject_reason",
	"final_value" text,
	"seconds_to_decide" integer
);
--> statement-breakpoint
CREATE TABLE "auto_next_step_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"previous_text" text,
	"previous_due_date" date,
	"previous_source" "next_step_source",
	"new_text" text NOT NULL,
	"new_due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undo_deadline" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	"undone_at" timestamp with time zone,
	"undone_by" uuid,
	"undone_to_text" text,
	"undone_to_due_date" date
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"auto_event_id" uuid,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_decisions" ADD CONSTRAINT "proposal_decisions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_decisions" ADD CONSTRAINT "proposal_decisions_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_next_step_events" ADD CONSTRAINT "auto_next_step_events_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_next_step_events" ADD CONSTRAINT "auto_next_step_events_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_next_step_events" ADD CONSTRAINT "auto_next_step_events_undone_by_users_id_fk" FOREIGN KEY ("undone_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_auto_event_id_auto_next_step_events_id_fk" FOREIGN KEY ("auto_event_id") REFERENCES "public"."auto_next_step_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_one_primary_per_company" ON "contacts" USING btree ("company_id") WHERE "contacts"."is_primary";--> statement-breakpoint
CREATE INDEX "observations_company_captured_at_idx" ON "observations" USING btree ("company_id","captured_at");--> statement-breakpoint
CREATE INDEX "proposals_status_created_at_idx" ON "proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_source_claim_id_claims_id_fk" FOREIGN KEY ("source_claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;