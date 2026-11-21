CREATE TABLE IF NOT EXISTS public.email_login_codes (
  id serial PRIMARY KEY,
  email varchar(320) NOT NULL,
  "codeHash" varchar(64) NOT NULL,
  "ipHash" varchar(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  "expiresAt" timestamptz NOT NULL,
  "consumedAt" timestamptz,
  "deliveryStatus" varchar(16) NOT NULL DEFAULT 'sent',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE public.email_login_codes
  ADD COLUMN IF NOT EXISTS "deliveryStatus" varchar(16) NOT NULL DEFAULT 'sent';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_codes_email_created_idx
  ON public.email_login_codes (email, "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_codes_ip_created_idx
  ON public.email_login_codes ("ipHash", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_codes_expiry_idx
  ON public.email_login_codes ("expiresAt");
