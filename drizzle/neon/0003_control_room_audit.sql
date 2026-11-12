CREATE TABLE IF NOT EXISTS public."controlAuditLogs" (
  id serial PRIMARY KEY,
  "actorOpenId" varchar(64) NOT NULL,
  action varchar(80) NOT NULL,
  "targetType" varchar(40) NOT NULL,
  "targetId" varchar(80),
  details text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS control_audit_logs_created_idx
  ON public."controlAuditLogs" ("createdAt" DESC);
