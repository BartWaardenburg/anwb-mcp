import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AnwbClient } from "../anwb-client.js";
import type { Incident, Road } from "../types.js";
import { toTextResult, toErrorResult } from "../tool-result.js";

const formatIncident = (incident: Incident): string => {
  const parts = [
    `    Type: ${incident.incidentType}`,
    `    From: ${incident.from}`,
    `    To: ${incident.to}`,
    `    Reason: ${incident.reason}`,
    incident.label ? `    Label: ${incident.label}` : null,
    incident.delay !== undefined ? `    Delay: ${Math.ceil(incident.delay / 60)} min` : null,
    incident.distance !== undefined ? `    Length: ${(incident.distance / 1000).toFixed(1)} km` : null,
    incident.start ? `    Start: ${incident.start}` : null,
    incident.stop ? `    End: ${incident.stop}` : null,
    `    Location: ${incident.fromLoc.lat},${incident.fromLoc.lon} → ${incident.toLoc.lat},${incident.toLoc.lon}`,
  ].filter(Boolean);
  return parts.join("\n");
};

const collectIncidents = (roads: Road[], category?: string, roadFilter?: string): { road: string; incidents: Incident[] }[] => {
  const results: { road: string; incidents: Incident[] }[] = [];

  for (const road of roads) {
    if (roadFilter && road.road.toLowerCase() !== roadFilter.toLowerCase()) continue;

    const incidents: Incident[] = [];

    for (const segment of road.segments) {
      if (!category || category === "jams") {
        incidents.push(...(segment.jams ?? []));
      }
      if (!category || category === "roadworks") {
        incidents.push(...(segment.roadworks ?? []));
      }
      if (!category || category === "radars") {
        incidents.push(...(segment.radars ?? []));
      }
    }

    if (incidents.length > 0) {
      results.push({ road: road.road, incidents });
    }
  }

  return results;
};

export const registerIncidentTools = (server: McpServer, client: AnwbClient): void => {
  server.registerTool(
    "get_traffic_incidents",
    {
      title: "Get Traffic Incidents",
      description:
        "Get current traffic incidents on Dutch highways from ANWB. " +
        "Returns jams, road closures, roadworks, and speed camera locations. " +
        "Optionally filter by road (e.g. 'A1', 'A2') and/or category (jams, roadworks, radars).",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        road: z.string().optional().describe("Filter by specific road (e.g. 'A1', 'A2', 'A12'). Case-insensitive. Returns all roads when omitted."),
        category: z.enum(["jams", "roadworks", "radars"]).optional().describe("Filter by incident category: jams (traffic jams and closures), roadworks (construction), radars (speed cameras). Returns all categories when omitted."),
      }),
    },
    async ({ road, category }) => {
      try {
        const response = await client.getIncidents();
        const roads = response.roads ?? [];

        if (roads.length === 0) {
          return toTextResult("No traffic information available at this time.");
        }

        const grouped = collectIncidents(roads, category, road);

        if (grouped.length === 0) {
          const filters = [
            road ? `road ${road}` : null,
            category ? `category ${category}` : null,
          ].filter(Boolean);
          return toTextResult(
            filters.length > 0
              ? `No incidents found for ${filters.join(" and ")}.`
              : "No incidents found on any road.",
          );
        }

        let totalIncidents = 0;
        const sections = grouped.map(({ road: roadName, incidents }) => {
          totalIncidents += incidents.length;
          const header = `${roadName} (${incidents.length} incident${incidents.length !== 1 ? "s" : ""}):`;
          const lines = incidents.map((inc, i) => `  ${i + 1}. ${inc.incidentType}\n${formatIncident(inc)}`);
          return [header, ...lines].join("\n");
        });

        const summary = [
          `Traffic update: ${response.dateTime}`,
          `Total: ${totalIncidents} incident${totalIncidents !== 1 ? "s" : ""} on ${grouped.length} road${grouped.length !== 1 ? "s" : ""}`,
          road ? `Filtered by road: ${road}` : null,
          category ? `Filtered by category: ${category}` : null,
        ].filter(Boolean);

        return toTextResult(
          [...summary, "", ...sections].join("\n"),
          { dateTime: response.dateTime, roads: grouped } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    "get_traffic_summary",
    {
      title: "Get Traffic Summary",
      description:
        "Get a compact summary of current traffic conditions on Dutch highways. " +
        "Returns total counts of jams, road closures, roadworks, and radars across all highways.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({}),
    },
    async () => {
      try {
        const response = await client.getIncidents();
        const roads = response.roads ?? [];

        let totalJams = 0;
        let totalClosures = 0;
        let totalRoadworks = 0;
        let totalRadars = 0;
        const affectedRoads = new Set<string>();

        for (const road of roads) {
          let hasIncidents = false;

          for (const segment of road.segments) {
            const jams = segment.jams ?? [];
            const roadworks = segment.roadworks ?? [];
            const radars = segment.radars ?? [];

            for (const jam of jams) {
              if (jam.incidentType === "road-closed") {
                totalClosures++;
              } else {
                totalJams++;
              }
            }
            totalRoadworks += roadworks.length;
            totalRadars += radars.length;

            if (jams.length > 0 || roadworks.length > 0) hasIncidents = true;
          }

          if (hasIncidents) affectedRoads.add(road.road);
        }

        const total = totalJams + totalClosures + totalRoadworks + totalRadars;

        const lines = [
          `Traffic summary: ${response.dateTime}`,
          "",
          `Total incidents: ${total}`,
          `  Traffic jams: ${totalJams}`,
          `  Road closures: ${totalClosures}`,
          `  Roadworks: ${totalRoadworks}`,
          `  Speed cameras: ${totalRadars}`,
          "",
          `Affected roads: ${affectedRoads.size > 0 ? [...affectedRoads].sort().join(", ") : "none"}`,
        ];

        return toTextResult(
          lines.join("\n"),
          {
            dateTime: response.dateTime,
            totalJams,
            totalClosures,
            totalRoadworks,
            totalRadars,
            affectedRoads: [...affectedRoads].sort(),
          } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
};
