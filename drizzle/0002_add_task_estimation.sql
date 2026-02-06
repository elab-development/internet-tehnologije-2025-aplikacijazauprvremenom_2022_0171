ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "estimated_minutes" integer DEFAULT 30;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ALTER COLUMN "estimated_minutes" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_estimated_minutes_idx" ON "tasks" ("estimated_minutes");
