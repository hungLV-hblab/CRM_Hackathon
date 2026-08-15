-- board_order: position of a deal inside its stage column on the board, 0 at the top.
-- Hand-written like 0010–0013: those migrations carry no drizzle snapshot, so a generated
-- diff would re-emit tables that are already applied.
ALTER TABLE "opportunities" ADD COLUMN "board_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill preserves the order the board showed before this column existed (updated_at
-- descending within each stage), so nobody's board reshuffles on deploy.
UPDATE "opportunities" SET "board_order" = ranked.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY stage ORDER BY updated_at DESC) - 1 AS rn
  FROM "opportunities"
) ranked
WHERE "opportunities".id = ranked.id;
