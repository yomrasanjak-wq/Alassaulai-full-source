ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "googleSub" varchar(255);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique_idx
  ON public.users ("googleSub")
  WHERE "googleSub" IS NOT NULL;
