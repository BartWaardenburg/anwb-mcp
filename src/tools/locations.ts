import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AnwbClient } from "../anwb-client.js";
import type { LocationResult } from "../types.js";
import { toTextResult, toErrorResult } from "../tool-result.js";

const formatLocation = (loc: LocationResult): string => {
  const parts = [
    loc.poi ? `POI: ${loc.poi.name}` : null,
    `Address: ${loc.address}`,
    loc.city ? `City: ${loc.city}` : null,
    loc.countrySubdivision ? `Province: ${loc.countrySubdivision}` : null,
    loc.country ? `Country: ${loc.country}` : null,
    `Coordinates: ${loc.latitude}, ${loc.longitude}`,
    `Type: ${loc.type}`,
  ].filter(Boolean);
  return parts.join("\n  ");
};

export const registerLocationTools = (server: McpServer, client: AnwbClient): void => {
  server.registerTool(
    "find_locations",
    {
      title: "Search ANWB Locations",
      description:
        "Search for locations, addresses, streets, cities, and points of interest in the Netherlands and surrounding countries. " +
        "Returns matching locations with coordinates, useful for route planning. " +
        "Use this to find coordinates for the calculate_route tool.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        query: z.string().describe("Free-text search query (e.g. city name, address, POI name)."),
        limit: z.number().int().min(1).max(20).default(7).describe("Maximum number of results to return (1-20)."),
        area: z.enum(["ALL", "NLD"]).default("ALL").describe("Geographic area to search in. ALL includes the Netherlands and surrounding countries, NLD limits to the Netherlands only."),
        indexSets: z.array(z.enum(["PAD", "Str", "Geo", "Addr", "POI"])).optional().describe("Index sets to search: PAD (addresses), Str (streets), Geo (geographic areas), Addr (address ranges), POI (points of interest). Default is all."),
      }),
    },
    async ({ query, limit, area, indexSets }) => {
      try {
        const response = await client.findLocations({
          freetext: query,
          limit,
          area,
          idxSet: indexSets,
        });

        const results = response.data ?? [];

        if (results.length === 0) {
          return toTextResult("No locations found matching the search query.");
        }

        const lines = results.map((loc, i) => `${i + 1}. ${formatLocation(loc)}`);

        return toTextResult(
          [`Found ${results.length} location${results.length !== 1 ? "s" : ""}:`, "", ...lines].join("\n"),
          { locations: results } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
};
