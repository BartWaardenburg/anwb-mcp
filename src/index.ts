#!/usr/bin/env node

import { createRequire } from "node:module";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AnwbClient } from "./anwb-client.js";
import { createServer, parseToolsets } from "./server.js";
import { checkForUpdate } from "./update-checker.js";

const require = createRequire(import.meta.url);
const { name, version } = require("../package.json") as { name: string; version: string };

const cacheTtl = process.env.ANWB_CACHE_TTL !== undefined
  ? parseInt(process.env.ANWB_CACHE_TTL, 10) * 1000
  : undefined;
const maxRetries = process.env.ANWB_MAX_RETRIES !== undefined
  ? parseInt(process.env.ANWB_MAX_RETRIES, 10)
  : 3;

const client = new AnwbClient(undefined, undefined, cacheTtl, { maxRetries });
const toolsets = parseToolsets(process.env.ANWB_TOOLSETS);
const server = createServer(client, toolsets);

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Fire-and-forget — don't block server startup
  void checkForUpdate(name, version);
};

main().catch((error) => {
  console.error("ANWB MCP server failed:", error);
  process.exit(1);
});
