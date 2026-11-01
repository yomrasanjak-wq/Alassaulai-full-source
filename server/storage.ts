// New uploads are stored in Vercel Blob. Legacy Manus objects continue to
// use the /manus-storage proxy and are not migrated or rewritten here.
import { put } from "@vercel/blob";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function getLegacyForgeConfig() {
  const forgeUrl = ENV.storageApiUrl;
  const forgeKey = ENV.storageApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Legacy Manus storage is unavailable: BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY are not configured",
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const pathname = normalizeKey(relKey);
  if (!pathname) throw new Error("Storage path is required");

  // Vercel Blob obtains its short-lived OIDC credential from the connected
  // Vercel project. No storage token is exposed to the browser or stored here.
  const body = typeof data === "string" ? data : Buffer.from(data);
  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });

  return { key: blob.pathname, url: blob.url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  if (/^https?:\/\//i.test(key)) return { key, url: key };
  // Preserve existing database records that point at the legacy Manus proxy.
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = getLegacyForgeConfig();
  const key = normalizeKey(relKey);

  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });

  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Legacy Manus signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
