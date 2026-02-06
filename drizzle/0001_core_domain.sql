CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "role" text DEFAULT 'user' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" ("role");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
ALTER TABLE IF EXISTS "todo_lists"
  ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "todo_lists"
  ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "todo_lists"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "todo_lists"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT '#2563eb' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_user_id_idx" ON "categories" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_user_name_uq" ON "categories" ("user_id", "name");
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
UPDATE "tasks"
SET "user_id" = l."user_id"
FROM "todo_lists" l
WHERE "tasks"."list_id" = l."id" AND "tasks"."user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "category_id" uuid;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'medium' NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'not_started' NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "due_date" timestamp;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_list_id_idx" ON "tasks" ("list_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks" ("due_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "category_id" uuid,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_user_id_idx" ON "notes" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "task_id" uuid,
  "title" text NOT NULL,
  "description" text,
  "starts_at" timestamp NOT NULL,
  "ends_at" timestamp NOT NULL,
  "location" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_user_id_idx" ON "calendar_events" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calendar_events_starts_at_idx" ON "calendar_events" ("starts_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "task_id" uuid,
  "event_id" uuid,
  "message" text NOT NULL,
  "remind_at" timestamp NOT NULL,
  "is_sent" boolean DEFAULT false NOT NULL,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_user_id_idx" ON "reminders" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reminders_remind_at_idx" ON "reminders" ("remind_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "theme" text DEFAULT 'system' NOT NULL,
  "language" text DEFAULT 'sr' NOT NULL,
  "layout_density" text DEFAULT 'comfortable' NOT NULL,
  "timezone" text DEFAULT 'Europe/Belgrade' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_id_uq" ON "user_preferences" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_preferences_theme_idx" ON "user_preferences" ("theme");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" text NOT NULL,
  "target_user_id" text,
  "action" text NOT NULL,
  "details" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_id_idx" ON "admin_audit_logs" ("admin_id");
--> statement-breakpoint
ALTER TABLE IF EXISTS "tasks" DROP CONSTRAINT IF EXISTS "tasks_list_id_todo_lists_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "todo_lists" DROP CONSTRAINT IF EXISTS "todo_lists_user_id_user_id_fk";
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_fk') THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_user_id_fk') THEN
    ALTER TABLE "account" ADD CONSTRAINT "account_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'todo_lists_user_id_fk') THEN
    ALTER TABLE "todo_lists" ADD CONSTRAINT "todo_lists_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_user_id_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_list_id_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_list_id_fk"
      FOREIGN KEY ("list_id") REFERENCES "todo_lists"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_category_id_fk') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fk"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_user_id_fk') THEN
    ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_user_id_fk') THEN
    ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notes_category_id_fk') THEN
    ALTER TABLE "notes" ADD CONSTRAINT "notes_category_id_fk"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_user_id_fk') THEN
    ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_task_id_fk') THEN
    ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_fk"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_user_id_fk') THEN
    ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_task_id_fk') THEN
    ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fk"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_event_id_fk') THEN
    ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_preferences_user_id_fk') THEN
    ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_admin_id_fk') THEN
    ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_fk"
      FOREIGN KEY ("admin_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_logs_target_user_id_fk') THEN
    ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_target_user_id_fk"
      FOREIGN KEY ("target_user_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
