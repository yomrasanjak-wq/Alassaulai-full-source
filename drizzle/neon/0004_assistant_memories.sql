CREATE TABLE IF NOT EXISTS public."assistantMemories" (
  id serial PRIMARY KEY,
  "ownerOpenId" varchar(64),
  "visitorSubjectHash" varchar(64),
  "consentedAt" timestamptz,
  enabled boolean NOT NULL DEFAULT false,
  "displayName" varchar(80),
  preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  "activeTopics" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "recentSummary" text,
  "lastInteractionAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_memories_single_owner CHECK (
    (("ownerOpenId" IS NOT NULL)::integer + ("visitorSubjectHash" IS NOT NULL)::integer) = 1
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS assistant_memories_user_unique
  ON public."assistantMemories" ("ownerOpenId") WHERE "ownerOpenId" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS assistant_memories_visitor_unique
  ON public."assistantMemories" ("visitorSubjectHash") WHERE "visitorSubjectHash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS assistant_memories_updated_idx
  ON public."assistantMemories" ("updatedAt" DESC);
