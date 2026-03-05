import { describe, it, expect } from "vitest";
import { createServer, parseToolsets } from "./server.js";
import type { AnwbClient } from "./anwb-client.js";

const mockClient = {} as AnwbClient;

type RegisteredTool = { annotations?: Record<string, unknown> };
type ServerWithTools = { _registeredTools: Record<string, RegisteredTool> };

const getTools = (toolsets?: Set<string>): Record<string, RegisteredTool> =>
  (createServer(mockClient, toolsets as never) as unknown as ServerWithTools)._registeredTools;

describe("createServer", () => {
  it("creates a server", () => {
    const server = createServer(mockClient);
    expect(server).toBeDefined();
  });

  it("registers all 6 tools", () => {
    const tools = getTools();
    expect(Object.keys(tools)).toHaveLength(6);
  });

  it("registers all expected tool names", () => {
    const tools = getTools();

    const expectedTools = [
      "find_locations",
      "calculate_route",
      "calculate_ev_route",
      "list_ev_cars",
      "get_traffic_incidents",
      "get_traffic_summary",
    ];

    for (const name of expectedTools) {
      expect(name in tools, `Tool "${name}" should be registered`).toBe(true);
    }
  });

  it("all tools have annotations", () => {
    const tools = getTools();

    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.annotations, `Tool "${name}" should have annotations`).toBeDefined();
    }
  });
});

describe("parseToolsets", () => {
  it("returns all toolsets when env is undefined", () => {
    const result = parseToolsets(undefined);
    expect(result.size).toBe(3);
  });

  it("returns all toolsets when env is empty", () => {
    const result = parseToolsets("");
    expect(result.size).toBe(3);
  });

  it("parses a single toolset", () => {
    const result = parseToolsets("routes");
    expect(result).toEqual(new Set(["routes"]));
  });

  it("parses multiple toolsets", () => {
    const result = parseToolsets("routes,incidents");
    expect(result).toEqual(new Set(["routes", "incidents"]));
  });

  it("ignores invalid toolset names", () => {
    const result = parseToolsets("routes,invalid,incidents");
    expect(result).toEqual(new Set(["routes", "incidents"]));
  });

  it("returns all toolsets if all names are invalid", () => {
    const result = parseToolsets("invalid,unknown");
    expect(result.size).toBe(3);
  });

  it("handles whitespace in toolset names", () => {
    const result = parseToolsets(" routes , incidents ");
    expect(result).toEqual(new Set(["routes", "incidents"]));
  });
});

describe("toolset filtering", () => {
  it("registers only location tools when locations toolset is selected", () => {
    const tools = getTools(new Set(["locations"]) as never);
    expect("find_locations" in tools).toBe(true);
    expect("calculate_route" in tools).toBe(false);
    expect("get_traffic_incidents" in tools).toBe(false);
  });

  it("registers only route tools when routes toolset is selected", () => {
    const tools = getTools(new Set(["routes"]) as never);
    expect("calculate_route" in tools).toBe(true);
    expect("calculate_ev_route" in tools).toBe(true);
    expect("list_ev_cars" in tools).toBe(true);
    expect("find_locations" in tools).toBe(false);
    expect("get_traffic_incidents" in tools).toBe(false);
  });

  it("registers only incident tools when incidents toolset is selected", () => {
    const tools = getTools(new Set(["incidents"]) as never);
    expect("get_traffic_incidents" in tools).toBe(true);
    expect("get_traffic_summary" in tools).toBe(true);
    expect("find_locations" in tools).toBe(false);
    expect("calculate_route" in tools).toBe(false);
  });

  it("does not register duplicate tools when all toolsets are selected", () => {
    const tools = getTools(new Set(["locations", "routes", "incidents"]) as never);
    const toolNames = Object.keys(tools);
    const unique = new Set(toolNames);
    expect(toolNames.length).toBe(unique.size);
  });
});
