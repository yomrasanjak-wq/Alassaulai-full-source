import "dotenv/config";
import { neon } from "@neondatabase/serverless";

/**
 * Read-only account inventory for the first-party owner-auth migration.
 * This script never updates users, roles, identities, credentials, or sessions.
 * It deliberately prints no email address, openId, database URL, or secret.
 */
const databaseUrl = process.env.DATABASE_URL;
const ownerEmail = (process.env.ALASSAUL_OWNER_EMAIL ?? process.env.OWNER_EMAIL ?? "")
  .trim()
  .toLowerCase();
const legacyOwnerOpenId = process.env.OWNER_OPEN_ID ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. No database changes were made.");
}
if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
  throw new Error("ALASSAUL_OWNER_EMAIL (or OWNER_EMAIL) must be configured. No database changes were made.");
}

const sql = neon(databaseUrl);
const tables = await sql.query(
  `SELECT
     to_regclass('public.users') IS NOT NULL AS users_exists,
     to_regclass('public."authIdentities"') IS NOT NULL AS identities_exists`,
  [],
) as Array<{ users_exists: boolean; identities_exists: boolean }>;

if (!tables[0]?.users_exists) {
  throw new Error("The public.users table was not found. No database changes were made.");
}

const accounts = await sql.query(
  `SELECT
     id,
     role,
     lower(btrim(email)) = $1 AS email_matches_owner,
     ($2 <> '' AND "openId" = $2) AS matches_legacy_owner_open_id
   FROM public.users
   WHERE lower(btrim(email)) = $1
      OR ($2 <> '' AND "openId" = $2)
   ORDER BY id`,
  [ownerEmail, legacyOwnerOpenId],
) as Array<{
  id: number;
  role: string;
  email_matches_owner: boolean;
  matches_legacy_owner_open_id: boolean;
}>;

const ids = accounts.map((account) => Number(account.id));
let verifiedEmailIdentityUserIds: number[] = [];
if (tables[0].identities_exists && ids.length > 0) {
  const identities = await sql.query(
    `SELECT DISTINCT "userId" AS user_id
     FROM public."authIdentities"
     WHERE provider = 'email_otp'
       AND lower(btrim("providerSubject")) = $1
       AND "emailVerified" = true
       AND "userId" = ANY($2::int[])`,
    [ownerEmail, ids],
  ) as Array<{ user_id: number }>;
  verifiedEmailIdentityUserIds = identities.map((identity) => Number(identity.user_id));
}

const emailMatches = accounts.filter((account) => account.email_matches_owner);
const legacyMatches = accounts.filter((account) => account.matches_legacy_owner_open_id);

console.log(JSON.stringify({
  audit: "read-only",
  databaseChangesMade: false,
  ownerEmailConfigured: true,
  legacyOwnerOpenIdConfigured: Boolean(legacyOwnerOpenId),
  usersTableExists: tables[0].users_exists,
  authIdentitiesTableExists: tables[0].identities_exists,
  ownerEmailMatchCount: emailMatches.length,
  legacyOwnerOpenIdMatchCount: legacyMatches.length,
  matchingAccounts: accounts.map((account) => ({
    userId: account.id,
    role: account.role,
    emailMatchesConfiguredOwner: account.email_matches_owner,
    matchesLegacyOwnerOpenId: account.matches_legacy_owner_open_id,
    hasVerifiedOwnerEmailOtpIdentity: verifiedEmailIdentityUserIds.includes(Number(account.id)),
  })),
  safeToPlanMigration: emailMatches.length === 1 &&
    legacyMatches.length === 1 &&
    emailMatches[0].id === legacyMatches[0].id,
}, null, 2));
