CREATE TABLE IF NOT EXISTS public.phone_login_requests (
  id serial PRIMARY KEY,
  "phoneHash" varchar(64) NOT NULL,
  "deliveryStatus" varchar(16) NOT NULL DEFAULT 'sent',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE public.phone_login_requests
  ADD COLUMN IF NOT EXISTS "deliveryStatus" varchar(16) NOT NULL DEFAULT 'sent';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS phone_login_requests_phone_created_idx
  ON public.phone_login_requests ("phoneHash", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS phone_login_requests_created_idx
  ON public.phone_login_requests ("createdAt");
