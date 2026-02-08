ALTER TABLE IF EXISTS "user" ADD COLUMN IF NOT EXISTS "manager_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_manager_id_user_id_fk') THEN
    ALTER TABLE "user"
      ADD CONSTRAINT "user_manager_id_user_id_fk"
      FOREIGN KEY ("manager_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_manager_id_idx" ON "user" ("manager_id");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_manager_self_check') THEN
    ALTER TABLE "user"
      ADD CONSTRAINT "user_manager_self_check"
      CHECK ("manager_id" IS NULL OR "manager_id" <> "id");
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
UPDATE "tasks"
SET "created_by_user_id" = "user_id"
WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_created_by_user_id_user_id_fk') THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_created_by_user_id_user_id_fk"
      FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_created_by_user_id_idx" ON "tasks" ("created_by_user_id");
--> statement-breakpoint
ALTER TABLE IF EXISTS "categories" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
UPDATE "categories"
SET "created_by_user_id" = "user_id"
WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "categories" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_created_by_user_id_user_id_fk') THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_created_by_user_id_user_id_fk"
      FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_created_by_user_id_idx" ON "categories" ("created_by_user_id");
--> statement-breakpoint
ALTER TABLE IF EXISTS "notes" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
UPDATE "notes"
SET "created_by_user_id" = "user_id"
WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "notes" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_created_by_user_id_user_id_fk') THEN
    ALTER TABLE "notes"
      ADD CONSTRAINT "notes_created_by_user_id_user_id_fk"
      FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_created_by_user_id_idx" ON "notes" ("created_by_user_id");
--> statement-breakpoint
ALTER TABLE IF EXISTS "calendar_events" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
UPDATE "calendar_events"
SET "created_by_user_id" = "user_id"
WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "calendar_events" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_created_by_user_id_user_id_fk') THEN
    ALTER TABLE "calendar_events"
      ADD CONSTRAINT "calendar_events_created_by_user_id_user_id_fk"
      FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_created_by_user_id_idx" ON "calendar_events" ("created_by_user_id");
--> statement-breakpoint
ALTER TABLE IF EXISTS "reminders" ADD COLUMN IF NOT EXISTS "created_by_user_id" text;
--> statement-breakpoint
UPDATE "reminders"
SET "created_by_user_id" = "user_id"
WHERE "created_by_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "reminders" ALTER COLUMN "created_by_user_id" SET NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_created_by_user_id_user_id_fk') THEN
    ALTER TABLE "reminders"
      ADD CONSTRAINT "reminders_created_by_user_id_user_id_fk"
      FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_created_by_user_id_idx" ON "reminders" ("created_by_user_id");
