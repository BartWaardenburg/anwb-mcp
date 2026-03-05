import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AnwbClient } from "../anwb-client.js";
import type { Route, RouteInstruction, EvRoute, EvCar } from "../types.js";
import { toTextResult, toErrorResult } from "../tool-result.js";

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
};

const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
};

const formatRouteInstructions = (instructions: RouteInstruction[]): string => {
  return instructions
    .filter((inst) => inst.maneuver !== "DEPART" || inst.distanceInMeters === 0)
    .map((inst) => {
      const distance = inst.instructionDistanceInMeters > 0
        ? ` (${formatDistance(inst.instructionDistanceInMeters)})`
        : "";
      const roadNums = inst.roadNumbers && inst.roadNumbers.length > 0 ? ` [${inst.roadNumbers.join(", ")}]` : "";
      return `  - ${inst.message}${roadNums}${distance}`;
    })
    .join("\n");
};

const formatRoute = (route: Route, index: number, isAlternative: boolean): string => {
  const summary = route.summary;
  const label = isAlternative ? `Alternative route ${index}` : "Recommended route";

  const parts = [
    `${label}:`,
    `  Distance: ${formatDistance(summary.distanceInMeters)}`,
    `  Duration: ${formatDuration(summary.durationInSeconds)}`,
    summary.delayInSeconds > 0 ? `  Delay: ${formatDuration(summary.delayInSeconds)}` : null,
    `  Departure: ${summary.departure}`,
    `  Arrival: ${summary.arrival}`,
    summary.roadNumbers && summary.roadNumbers.length > 0 ? `  Roads: ${summary.roadNumbers.join(" → ")}` : null,
    summary.tollRoads && summary.tollRoads > 0 ? `  Toll roads: ${summary.tollRoads}` : null,
    summary.tollVignettes && summary.tollVignettes.length > 0 ? `  Toll vignettes: ${summary.tollVignettes.join(", ")}` : null,
    summary.numberOfFerries && summary.numberOfFerries > 0 ? `  Ferries: ${summary.numberOfFerries}` : null,
    summary.countryCodesAlongTheRoute && summary.countryCodesAlongTheRoute.length > 0
      ? `  Countries: ${summary.countryCodesAlongTheRoute.join(", ")}`
      : null,
    summary.difference
      ? `  Compared to recommended: ${summary.difference.distanceInMeters >= 0 ? "+" : ""}${formatDistance(summary.difference.distanceInMeters)}, ${summary.difference.durationInSeconds >= 0 ? "+" : ""}${formatDuration(Math.abs(summary.difference.durationInSeconds))}`
      : null,
  ].filter(Boolean);

  if (route.legs.length > 0 && route.legs[0].instructions) {
    parts.push("", "  Turn-by-turn directions:");
    parts.push(formatRouteInstructions(route.legs[0].instructions));
  }

  return parts.join("\n");
};

const formatEvRoute = (route: EvRoute): string => {
  const summary = route.summary;
  const ev = summary.evInformation;

  const parts = [
    "EV Route:",
    `  Distance: ${formatDistance(summary.distanceInMeters)}`,
    `  Duration: ${formatDuration(summary.durationInSeconds)}`,
    `  Departure: ${summary.departure}`,
    `  Arrival: ${summary.arrival}`,
    `  Battery: ${ev.rangeStartPercentage}% → ${ev.rangeEndPercentage}%`,
    `  Range: ${formatDistance(ev.rangeStart)} → ${formatDistance(ev.rangeEnd)}`,
    `  Consumption: ${ev.consumptionKwh} kWh`,
    ev.charges > 0 ? `  Charging stops: ${ev.charges}` : `  Charging stops: none needed`,
    ev.chargeTime > 0 ? `  Total charge time: ${formatDuration(ev.chargeTime)}` : null,
    route.savings.money !== 0 ? `  Cost savings vs fuel: €${route.savings.money.toFixed(2)}` : null,
  ].filter(Boolean);

  if (route.stationsAlongRoute.length > 0) {
    parts.push(`  Charging stations along route: ${route.stationsAlongRoute.length}`);
  }

  for (const [i, leg] of route.legs.entries()) {
    const inst = leg.instructions[0];
    if (!inst) continue;
    parts.push("");
    parts.push(`  Leg ${i + 1}:`);
    parts.push(`    Distance: ${formatDistance(inst.distanceInMeters)}`);
    parts.push(`    Duration: ${formatDuration(inst.durationInSeconds)}`);
    parts.push(`    Battery: ${inst.rangeStartPercentage}% → ${inst.rangeEndPercentage}%`);
    if (inst.stationId) {
      parts.push(`    Charging station: ${inst.stationId}`);
      parts.push(`    Charge: ${inst.charge.from}% → ${inst.charge.to ?? "?"}%`);
      parts.push(`    Charge time: ${formatDuration(inst.chargeTime)}`);
    }
  }

  return parts.join("\n");
};

export const registerRouteTools = (server: McpServer, client: AnwbClient): void => {
  server.registerTool(
    "calculate_route",
    {
      title: "Calculate Route",
      description:
        "Calculate a route between two or more locations using ANWB route planning. " +
        "Supports car, caravan, bike, and pedestrian modes. " +
        "Provide locations as latitude,longitude pairs separated by colons (e.g. '52.37,4.89:51.44,5.47'). " +
        "Returns distance, duration, turn-by-turn directions, toll information (car/caravan only), and optional alternative routes. " +
        "Use find_locations first to get coordinates for place names.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        locations: z.string().describe("Waypoints as lat,lon pairs separated by colons. Minimum 2 points. Example: '52.373166,4.89066:51.441643,5.469722' (Amsterdam to Eindhoven)."),
        transportMode: z.enum(["car", "caravan", "bike", "pedestrian"]).default("car").describe("Transport mode: car (default), caravan, bike, or pedestrian."),
        routeType: z.enum(["fastest", "shortest"]).default("fastest").describe("Route optimization: fastest (default) or shortest distance. Note: 'shortest' only works for bike and pedestrian modes."),
        includeAlternatives: z.boolean().default(true).describe("Include alternative routes in the response."),
        tollInfo: z.boolean().default(true).describe("Include toll road information (car/caravan mode only, ignored for bike/pedestrian)."),
        traffic: z.boolean().default(true).describe("Take current traffic conditions into account (car/caravan mode only, ignored for bike/pedestrian)."),
        avoid: z.array(z.enum(["tollRoads", "motorways", "ferries", "unpavedRoads"])).default([]).describe("Road types to avoid. Options: tollRoads, motorways, ferries, unpavedRoads. Applies to car/caravan modes primarily."),
        transportSubtype: z.enum(["bike", "ebike"]).optional().describe("Bike subtype: 'bike' (regular) or 'ebike' (electric bicycle). Only applies when transportMode is 'bike'."),
      }),
    },
    async ({ locations, transportMode, routeType, includeAlternatives, tollInfo, traffic, avoid, transportSubtype }) => {
      try {
        const response = await client.getRoute({
          transportMode,
          locations,
          routeType,
          includeAlternatives,
          tollInfo,
          traffic,
          avoid: avoid && avoid.length > 0 ? avoid : undefined,
          transportSubtype,
        });

        const routes = response.value ?? [];

        if (routes.length === 0) {
          return toTextResult("No route found for the given locations.");
        }

        const lines = routes.map((route, i) => formatRoute(route, i + 1, i > 0));

        return toTextResult(
          lines.join("\n\n"),
          { routes: routes.map(({ legs: _legs, ...rest }) => rest) } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    "calculate_ev_route",
    {
      title: "Calculate EV Route",
      description:
        "Calculate an electric vehicle route between two or more locations using ANWB EV route planning. " +
        "Requires an EV car model ID, battery capacity, and current state of charge. " +
        "Returns distance, duration, battery consumption, charging stops (if needed), and nearby charging stations. " +
        "Provide locations as latitude,longitude pairs separated by colons. " +
        "Use find_locations first to get coordinates for place names.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        locations: z.string().describe("Waypoints as lat,lon pairs separated by colons. Minimum 2 points. Example: '52.373166,4.89066:51.441643,5.469722'."),
        carId: z.string().describe("EV car model ID from the ANWB database (e.g. '646ca73f3f6beb1fcbdbdf70')."),
        capacity: z.number().min(1).describe("Battery capacity in kWh (e.g. 100 for a 100 kWh battery)."),
        stateOfCharge: z.number().min(5).max(100).describe("Current battery state of charge as a percentage (5-100)."),
        finalStateOfCharge: z.number().min(10).max(75).default(20).describe("Desired minimum battery percentage at arrival (10-75, default: 20)."),
        complexity: z.number().min(0).default(1.15).describe("Route complexity factor (default: 1.15). Higher values may find more optimal routes."),
      }),
    },
    async ({ locations, carId, capacity, stateOfCharge, finalStateOfCharge, complexity }) => {
      try {
        const response = await client.getEvRoute({
          locations,
          carId,
          capacity,
          stateOfCharge,
          finalStateOfCharge,
          complexity,
        });

        const route = response.value;

        if (!route) {
          return toTextResult("No EV route found for the given locations and vehicle parameters.");
        }

        const text = formatEvRoute(route);

        return toTextResult(
          text,
          { summary: route.summary, stationsAlongRoute: route.stationsAlongRoute, savings: route.savings } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );

  server.registerTool(
    "list_ev_cars",
    {
      title: "List Electric Vehicles",
      description:
        "List available electric vehicle models from the ANWB database. " +
        "Returns car IDs, make, model, version, and battery information. " +
        "Use the car ID with calculate_ev_route to plan an EV route. " +
        "Optionally filter by make (brand) or search by model name.",
      annotations: { readOnlyHint: true, openWorldHint: true },

      inputSchema: z.object({
        make: z.string().optional().describe("Filter by car make/brand (case-insensitive). Example: 'Tesla', 'Volkswagen', 'BMW'."),
        search: z.string().optional().describe("Search term to filter by model name (case-insensitive). Example: 'Model 3', 'ID.4'."),
      }),
    },
    async ({ make, search }) => {
      try {
        const response = await client.getEvCars();
        const cars = response.result;

        const filtered = cars.filter((car) => {
          if (make && car.naming.make.toLowerCase() !== make.toLowerCase()) return false;
          if (search) {
            const term = search.toLowerCase();
            const fullName = `${car.naming.make} ${car.naming.model} ${car.naming.chargetripVersion}`.toLowerCase();
            if (!fullName.includes(term)) return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          return toTextResult("No electric vehicles found matching the given criteria.");
        }

        const formatCar = (car: EvCar): string =>
          `  - ${car.naming.make} ${car.naming.model} ${car.naming.chargetripVersion} (ID: ${car.id}, battery: ${car.battery.usableKWH} kWh usable / ${car.battery.fullKWH} kWh full)`;

        const lines = [
          `Found ${filtered.length} electric vehicle${filtered.length === 1 ? "" : "s"}:`,
          "",
          ...filtered.map(formatCar),
        ];

        return toTextResult(
          lines.join("\n"),
          { cars: filtered } as Record<string, unknown>,
        );
      } catch (error) {
        return toErrorResult(error);
      }
    },
  );
};
