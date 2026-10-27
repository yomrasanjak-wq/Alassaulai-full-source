import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const isServerlessRuntime = process.env.VERCEL === "1" ||
  process.env.NETLIFY === "true" ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

export async function createApp(existingServer?: ReturnType<typeof createServer>) {
  const app = express();
  const server = isServerlessRuntime ? undefined : existingServer ?? createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development" && server) {
    await setupVite(app, server);
  } else if (!isServerlessRuntime) {
    serveStatic(app);
  }
  return app;
}

async function startServer() {
  const server = createServer();
  const app = await createApp(server);
  server.on("request", app);
  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => console.log(`Server running on http://localhost:${port}/`));
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";
const currentFile = fileURLToPath(import.meta.url);

if (!isServerlessRuntime && invokedFile === currentFile) {
  startServer().catch(console.error);
}
