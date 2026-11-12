-- Expand the authenticated staff roles without changing existing users.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'secretary';
--> statement-breakpoint
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'assistant';
--> statement-breakpoint
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'it';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS control_requests_assignee_created_idx
  ON public."controlRequests" (assignee, "createdAt" DESC);
