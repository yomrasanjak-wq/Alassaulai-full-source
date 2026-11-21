export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Open the first-party email sign-in dialog without redirecting to an external identity portal. */
export const startLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/") {
    window.location.assign("/?login=1");
    return;
  }
  window.dispatchEvent(new Event("alassaul:open-login"));
};
