CREATE TYPE "public"."company_type" AS ENUM('traditional', 'it_solution', 'it_product', 'tech_startup', 'other_ito');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('certain', 'likely', 'speculative');--> statement-breakpoint
CREATE TYPE "public"."created_by" AS ENUM('human', 'system');--> statement-breakpoint
CREATE TYPE "public"."decision" AS ENUM('accept', 'edit', 'reject');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('activity', 'stage_change', 'note', 'system_entry');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."next_step_source" AS ENUM('human', 'system');--> statement-breakpoint
CREATE TYPE "public"."proposal_type" AS ENUM('field_update', 'timeline_entry');--> statement-breakpoint
CREATE TYPE "public"."reject_reason" AS ENUM('wrong_info', 'irrelevant', 'outdated', 'misread_context', 'other');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('funding', 'leadership_hire', 'expansion', 'mass_hiring', 'new_business_line', 'other');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('prospecting', 'qualified', 'drafting', 'negotiation', 'won', 'lost', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."trigger_context" AS ENUM('manual_ingest', 'watch_cycle');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('sales', 'admin');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"industry" text NOT NULL,
	"company_type" "company_type" NOT NULL,
	"country" text,
	"size" text,
	"website" text,
	"is_watched" boolean DEFAULT false NOT NULL,
	"owner_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"expected_value" numeric(14, 2),
	"expected_close_month" text,
	"stage" "stage" DEFAULT 'prospecting' NOT NULL,
	"next_step_text" text,
	"next_step_due_date" date,
	"next_step_source" "next_step_source",
	"need_signal" text,
	"need_signal_source" text,
	"budget_signal" text,
	"budget_signal_source" text,
	"lost_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"contact_id" uuid,
	"created_by" "created_by" NOT NULL,
	"source_claim_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_cycle_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"companies_scanned" integer DEFAULT 0 NOT NULL,
	"new_content_count" integer DEFAULT 0 NOT NULL,
	"entries_added" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error_detail" text,
	"skipped_reason" text,
	"is_rollup" boolean DEFAULT false NOT NULL,
	"cycles_covered" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;