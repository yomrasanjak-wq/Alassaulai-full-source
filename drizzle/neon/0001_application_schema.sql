DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE public.control_request_status AS ENUM ('pending', 'reviewed', 'in_progress', 'completed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  "openId" varchar(64) NOT NULL UNIQUE,
  name text,
  email varchar(320),
  "loginMethod" varchar(64),
  role public.user_role NOT NULL DEFAULT 'user',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "lastSignedIn" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public."controlRequests" (
  id serial PRIMARY KEY,
  title varchar(255) NOT NULL DEFAULT 'طلب جديد',
  command text NOT NULL,
  "requesterType" varchar(32) NOT NULL DEFAULT 'visitor',
  category varchar(32) NOT NULL DEFAULT 'general',
  priority varchar(16) NOT NULL DEFAULT 'normal',
  assignee varchar(32),
  "decisionNote" text,
  status public.control_request_status NOT NULL DEFAULT 'pending',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public."mediaItems" (
  id serial PRIMARY KEY,
  name varchar(255) NOT NULL,
  url text NOT NULL,
  "mimeType" varchar(120) NOT NULL,
  category varchar(32) NOT NULL DEFAULT 'entertainment',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS public."guestMemories" (
  id serial PRIMARY KEY,
  "imageUrl" text,
  caption text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
