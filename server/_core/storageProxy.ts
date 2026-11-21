type Request = {
  body: any;
  ip?: string;
  query: Record<string, unknown>;
  headers: import("node:http").IncomingHttpHeaders;
  params: Record<string, string>;
  get(name: string): string | undefined;
};
type Response = {
  setHeader(name: string, value: string): any;
  cookie(name: string, value: any, options?: any): any;
  clearCookie(name: string, options?: any): any;
  status(code: number): any;
  json(body?: any): any;
  send(body?: any): any;
  redirect(statusOrUrl: number | string, url?: string): any;
  set(name: string, value: string): any;
};
type Application = { get: any; post: any };
import { ENV } from "./env";

export function registerStorageProxy(app: Application) {
  app.get(["/manus-storage/*", "/api/manus-storage/*"], async (req: Request, res: Response) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.storageApiUrl || !ENV.storageApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.storageApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: "Bearer " + ENV.storageApiKey },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error("[StorageProxy] forge error: " + forgeResp.status + " " + body);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
