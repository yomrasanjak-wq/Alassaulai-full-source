import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ENV } from "./env";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";

/**
 * Runtime-only Express app for serverless functions.
 * Keep Vite, Tailwind, Babel, and other build-time tools out of this dependency graph.
 */
export function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Large entertainment files go directly from the browser to Vercel Blob.
  // This endpoint only issues a short-lived, constrained upload token; it never
  // receives the video/audio bytes through a Vercel Function.
  app.post("/api/media/upload", async (req, res) => {
    try {
      const body = req.body as HandleUploadBody;
      const response = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (_pathname, clientPayload) => {
          const context = await createContext({ req, res });
          const isOwner = Boolean(ENV.ownerOpenId && context.user?.openId === ENV.ownerOpenId);
          if (!context.user || (context.user.role !== "admin" && !isOwner)) {
            throw new Error("ليس لديك صلاحية رفع الوسائط.");
          }

          let metadata: { name?: string; mimeType?: string };
          try {
            metadata = JSON.parse(clientPayload || "{}") as { name?: string; mimeType?: string };
          } catch {
            throw new Error("بيانات الملف غير صالحة.");
          }
          const name = typeof metadata.name === "string" ? metadata.name.trim().slice(0, 255) : "";
          const mimeType = typeof metadata.mimeType === "string" ? metadata.mimeType.trim().toLowerCase() : "";
          if (!name || !(mimeType.startsWith("video/") || mimeType.startsWith("audio/"))) {
            throw new Error("يسمح برفع ملفات الفيديو والصوت فقط.");
          }

          return {
            allowedContentTypes: ["video/*", "audio/*"],
            maximumSizeInBytes: 50 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ name, mimeType }),
          };
        },
        // The browser registers the returned URL through the authenticated
        // media.registerUploaded mutation after the direct transfer succeeds.
        onUploadCompleted: async () => undefined,
      });
      res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تجهيز رفع الملف.";
      const status = /صلاحية|ليس لديك/.test(message) ? 403 : 400;
      res.status(status).json({ error: message });
    }
  });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
