import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AnwbClient } from "./anwb-client.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerRouteTools } from "./tools/routes.js";
import { registerIncidentTools } from "./tools/incidents.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export type Toolset = "locations" | "routes" | "incidents";

const ALL_TOOLSETS: Toolset[] = ["locations", "routes", "incidents"];

export const parseToolsets = (env?: string): Set<Toolset> => {
  if (!env) return new Set(ALL_TOOLSETS);

  const requested = env.split(",").map((s) => s.trim().toLowerCase());
  const valid = new Set<Toolset>();

  for (const name of requested) {
    if (ALL_TOOLSETS.includes(name as Toolset)) {
      valid.add(name as Toolset);
    }
  }

  return valid.size > 0 ? valid : new Set(ALL_TOOLSETS);
};

type ToolRegisterer = (server: McpServer, client: AnwbClient) => void;

const toolsetRegistry: Record<Toolset, ToolRegisterer[]> = {
  locations: [registerLocationTools],
  routes: [registerRouteTools],
  incidents: [registerIncidentTools],
};

export const createServer = (
  client: AnwbClient,
  toolsets?: Set<Toolset>,
): McpServer => {
  const server = new McpServer({
    name: "anwb-mcp",
    version,
  });

  const enabled = toolsets ?? new Set(ALL_TOOLSETS);
  const registered = new Set<ToolRegisterer>();

  for (const toolset of enabled) {
    const registerers = toolsetRegistry[toolset];

    for (const register of registerers) {
      if (!registered.has(register)) {
        registered.add(register);
        register(server, client);
      }
    }
  }

  return server;
};
