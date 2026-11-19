-- Additive external identity mapping for independent authentication.
-- Safe to apply without changing or rewriting existing users.openId values.
CREATE TABLE IF NOT EXISTS public."authIdentities" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES public."users"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL,
  "providerSubject" varchar(255) NOT NULL,
  "providerEmail" varchar(320),
  "emailVerified" boolean NOT NULL DEFAULT false,
  "linkedByOpenId" varchar(64),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_provider_subject_uq"
  ON public."authIdentities" ("provider", "providerSubject");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_identities_user_provider_uq"
  ON public."authIdentities" ("userId", "provider");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_identities_user_id_idx"
  ON public."authIdentities" ("userId");

-- This migration intentionally does not insert, merge, or alter user records.
