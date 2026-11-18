CREATE TABLE IF NOT EXISTS public.email_login_codes (
  id bigserial PRIMARY KEY,
  email varchar(320) NOT NULL,
  "codeHash" varchar(64) NOT NULL,
  "ipHash" varchar(64) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  "expiresAt" timestamptz NOT NULL,
  "consumedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_codes_email_created_idx
  ON public.email_login_codes (email, "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_codes_ip_created_idx
  ON public.email_login_codes ("ipHash", "createdAt" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_codes_expiry_idx
  ON public.email_login_codes ("expiresAt");
