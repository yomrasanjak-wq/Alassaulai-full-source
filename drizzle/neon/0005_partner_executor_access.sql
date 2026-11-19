-- ALASSAUL-AI partner/executor access model.
-- Additive only: existing users and control requests remain unchanged.
-- Apply manually to Neon only after a verified backup and explicit approval.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'partner';
--> statement-breakpoint
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'executor';
--> statement-breakpoint
ALTER TABLE public."controlRequests"
  ADD COLUMN IF NOT EXISTS "requesterOpenId" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS control_requests_requester_created_idx
  ON public."controlRequests" ("requesterOpenId", "createdAt" DESC);
