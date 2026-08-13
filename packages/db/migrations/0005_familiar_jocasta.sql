ALTER TYPE "public"."proposal_type" ADD VALUE 'next_step';--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_target_field_matches_type";--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "opportunity_id" uuid;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_target_field_matches_type" CHECK (("proposals"."proposal_type"::text = 'field_update'
             AND "proposals"."target_field" IN ('industry', 'country', 'size', 'website')
             AND "proposals"."opportunity_id" IS NULL)
          OR ("proposals"."proposal_type"::text = 'timeline_entry'
             AND "proposals"."target_field" IS NULL
             AND "proposals"."opportunity_id" IS NULL)
          OR ("proposals"."proposal_type"::text = 'next_step'
             AND "proposals"."target_field" = 'next_step_text'
             AND "proposals"."opportunity_id" IS NOT NULL));