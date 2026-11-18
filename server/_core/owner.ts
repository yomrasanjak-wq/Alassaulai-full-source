import { ENV } from "./env";

type OwnerIdentity = { email?: string | null } | null | undefined;

/** The platform owner is identified only by a verified, server-side email allowlist. */
export function isConfiguredOwner(user: OwnerIdentity): boolean {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email && ENV.ownerEmail && email === ENV.ownerEmail);
}
