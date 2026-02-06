ALTER TABLE IF EXISTS "tasks" DROP COLUMN IF EXISTS "completed";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_role_check') THEN
    ALTER TABLE "user"
      ADD CONSTRAINT "user_role_check"
      CHECK ("role" IN ('user', 'admin', 'manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_priority_check') THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_priority_check"
      CHECK ("priority" IN ('low', 'medium', 'high'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_status_check') THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_status_check"
      CHECK ("status" IN ('not_started', 'in_progress', 'done'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_time_check') THEN
    ALTER TABLE "calendar_events"
      ADD CONSTRAINT "calendar_events_time_check"
      CHECK ("ends_at" > "starts_at");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_target_check') THEN
    ALTER TABLE "reminders"
      ADD CONSTRAINT "reminders_target_check"
      CHECK ("task_id" IS NOT NULL OR "event_id" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_theme_check') THEN
    ALTER TABLE "user_preferences"
      ADD CONSTRAINT "user_preferences_theme_check"
      CHECK ("theme" IN ('system', 'light', 'dark'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_language_check') THEN
    ALTER TABLE "user_preferences"
      ADD CONSTRAINT "user_preferences_language_check"
      CHECK ("language" IN ('sr', 'en'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_density_check') THEN
    ALTER TABLE "user_preferences"
      ADD CONSTRAINT "user_preferences_density_check"
      CHECK ("layout_density" IN ('compact', 'comfortable'));
  END IF;
END $$;
