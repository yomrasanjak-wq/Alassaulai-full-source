import serverless from "serverless-http";
import type { Handler } from "@netlify/functions";
import { createApp } from "../../server/_core/app";

// Keep one Express app instance warm per function instance. Rewrite the Netlify
// function prefix back to /api so existing tRPC routes remain unchanged.
const appPromise = createApp();
export const handler: Handler = async (event, context) => {
  const app = await appPromise;
  const toLambda = serverless(app);
  const prefix = "/.netlify/functions/api";
  const path = event.path.startsWith(prefix) ? `/api${event.path.slice(prefix.length)}` : event.path;
  return toLambda({ ...event, path }, context);
};
