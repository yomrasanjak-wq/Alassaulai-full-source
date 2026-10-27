import { createApp } from "../server/_core/app";

const app = createApp();

export default async function handler(req: Parameters<import("express").Express>[0], res: Parameters<import("express").Express>[1]) {
  return (await app)(req, res);
}
