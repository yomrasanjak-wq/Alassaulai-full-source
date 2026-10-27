import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = async () => {
  // Prefer runtime configuration so Netlify deployments do not silently depend
  // on Vite build-time variables being present in the static bundle.
  let oauthPortalUrl = String(import.meta.env.VITE_OAUTH_PORTAL_URL ?? "").trim();
  let appId = String(import.meta.env.VITE_APP_ID ?? "").trim();

  try {
    const response = await fetch("/api/oauth/config", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (response.ok) {
      const config = await response.json() as { oauthPortalUrl?: string; appId?: string };
      oauthPortalUrl = String(config.oauthPortalUrl ?? oauthPortalUrl).trim();
      appId = String(config.appId ?? appId).trim();
    } else if (response.status === 503) {
      const config = await response.json().catch(() => ({})) as { missing?: string[] };
      const missing = Array.isArray(config.missing) && config.missing.length
        ? ` الإعدادات الناقصة: ${config.missing.join("، ")}.`
        : " راجع إعدادات OAuth وقاعدة البيانات ومفتاح الجلسة في Netlify.";
      window.alert(`تسجيل الدخول غير جاهز في الخادم.${missing}`);
      return;
    }
  } catch {
    // If the runtime endpoint is unreachable, build-time values may still work.
  }

  if (!oauthPortalUrl || !appId) {
    window.alert(
      "تعذّر فتح بوابة الدخول لأن إعدادات تسجيل الدخول غير مكتملة في الاستضافة. " +
      "يرجى ضبط OAUTH_PORTAL_URL وVITE_APP_ID في إعدادات Netlify ثم إعادة البناء والنشر."
    );
    return;
  }

  let portalBase: URL;
  try {
    portalBase = new URL(oauthPortalUrl);
    if (portalBase.protocol !== "https:" && portalBase.hostname !== "localhost") {
      throw new Error("OAuth portal must use HTTPS");
    }
  } catch {
    window.alert("عنوان بوابة الدخول غير صحيح. يرجى مراجعة إعداد OAUTH_PORTAL_URL في Netlify.");
    return;
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL("/app-auth", portalBase);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.assign(url.toString());
};
