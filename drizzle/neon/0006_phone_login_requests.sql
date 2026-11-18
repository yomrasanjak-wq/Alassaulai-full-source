CREATE TABLE IF NOT EXISTS public.phone_login_requests (
  id bigserial PRIMARY KEY,
  "phoneHash" varchar(64) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS phone_login_requests_phone_created_idx
  ON public.phone_login_requests ("phoneHash", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS phone_login_requests_created_idx
  ON public.phone_login_requests ("createdAt");
