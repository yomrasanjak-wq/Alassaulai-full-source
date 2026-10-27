import { createApp } from "../server/_core/index";

const appPromise = createApp();

export default async function handler(req: Parameters<import("express").Express>[0], res: Parameters<import("express").Express>[1]) {
  const app = await appPromise;
  return app(req, res);
}
