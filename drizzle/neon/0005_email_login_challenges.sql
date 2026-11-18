-- Additive only: short-lived email OTP challenges; existing users and roles are untouched.
CREATE TABLE IF NOT EXISTS public."emailLoginChallenges" (
  id serial PRIMARY KEY,
  email varchar(320) NOT NULL,
  "requestIpHash" varchar(64) NOT NULL,
  "codeHash" varchar(64) NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  "consumedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_login_challenges_email_created_idx
  ON public."emailLoginChallenges" (email, "createdAt" DESC);
