import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnwbClient } from "../anwb-client.js";
import { AnwbApiError } from "../anwb-client.js";
import { registerLocationTools } from "./locations.js";
import { registerRouteTools } from "./routes.js";
import { registerIncidentTools } from "./incidents.js";

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

const createMockServer = () => {
  const handlers = new Map<string, ToolHandler>();
  return {
    registerTool: vi.fn((name: string, _config: unknown, handler: ToolHandler) => {
      handlers.set(name, handler);
    }),
    getHandler: (name: string): ToolHandler => {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`No handler registered for "${name}"`);
      return handler;
    },
  };
};

const apiError = new AnwbApiError("API failed", 500, { code: "INTERNAL" });

const createMockClient = (): Record<string, ReturnType<typeof vi.fn>> => ({
  findLocations: vi.fn(),
  getRoute: vi.fn(),
  getEvRoute: vi.fn(),
  getEvCars: vi.fn(),
  getIncidents: vi.fn(),
});

// --- Location Tools ---

describe("location tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerLocationTools(server as never, client as unknown as AnwbClient);
  });

  describe("find_locations", () => {
    const handler = () => server.getHandler("find_locations");

    it("returns formatted location results", async () => {
      client.findLocations.mockResolvedValueOnce({
        data: [
          {
            poi: null,
            address: "Amsterdam",
            street: null,
            houseNumber: null,
            postcode: null,
            city: "Amsterdam",
            country: "Nederland",
            countryCode: "NLD",
            latitude: 52.373166,
            longitude: 4.89066,
            countrySubdivision: "Noord-Holland",
            type: "Geography",
            score: 0.99,
          },
          {
            poi: { name: "Amsterdam Airport Schiphol" },
            address: "Vertrekpassage 4, 1118 AP Schiphol",
            street: "Vertrekpassage",
            houseNumber: "4",
            postcode: "1118 AP",
            city: "Schiphol",
            country: "Nederland",
            countryCode: "NLD",
            latitude: 52.310636,
            longitude: 4.763636,
            countrySubdivision: "Noord-Holland",
            type: "POI",
            score: 0.98,
          },
        ],
      });

      const result = (await handler()({ query: "amsterdam", limit: 7, area: "ALL" })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Found 2 locations");
      expect(result.content[0].text).toContain("Amsterdam");
      expect(result.content[0].text).toContain("52.373166");
      expect(result.content[0].text).toContain("Noord-Holland");
      expect(result.content[0].text).toContain("POI: Amsterdam Airport Schiphol");
      expect(result.structuredContent).toBeDefined();
    });

    it("returns message when no results found", async () => {
      client.findLocations.mockResolvedValueOnce({ data: [] });

      const result = (await handler()({ query: "nonexistent", limit: 7, area: "ALL" })) as ToolResult;

      expect(result.content[0].text).toContain("No locations found");
    });

    it("handles null data array", async () => {
      client.findLocations.mockResolvedValueOnce({});

      const result = (await handler()({ query: "test", limit: 7, area: "ALL" })) as ToolResult;

      expect(result.content[0].text).toContain("No locations found");
    });

    it("handles API errors", async () => {
      client.findLocations.mockRejectedValueOnce(apiError);

      const result = (await handler()({ query: "test", limit: 7, area: "ALL" })) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ANWB API error");
    });

    it("returns singular text for single result", async () => {
      client.findLocations.mockResolvedValueOnce({
        data: [
          {
            poi: null,
            address: "Ede",
            city: "Ede",
            country: "Nederland",
            latitude: 52.04,
            longitude: 5.67,
            type: "Geography",
            score: 0.99,
          },
        ],
      });

      const result = (await handler()({ query: "ede", limit: 7, area: "ALL" })) as ToolResult;

      expect(result.content[0].text).toContain("Found 1 location:");
    });
  });
});

// --- Route Tools ---

describe("route tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerRouteTools(server as never, client as unknown as AnwbClient);
  });

  describe("calculate_route", () => {
    const handler = () => server.getHandler("calculate_route");

    it("returns formatted car route with summary", async () => {
      client.getRoute.mockResolvedValueOnce({
        value: [
          {
            id: "route-1",
            waypoints: [
              { latitude: 52.37, longitude: 4.89 },
              { latitude: 51.44, longitude: 5.47 },
            ],
            legs: [
              {
                summary: {
                  distanceInMeters: 125000,
                  durationInSeconds: 4500,
                  delayInSeconds: 300,
                  departure: "2026-03-05T10:00:00Z",
                  arrival: "2026-03-05T11:15:00Z",
                },
                instructions: [
                  {
                    id: "1",
                    point: { latitude: 52.37, longitude: 4.89 },
                    distanceInMeters: 0,
                    instructionDistanceInMeters: 0,
                    durationInSeconds: 0,
                    countryCode: "NLD",
                    drivingSide: "RIGHT",
                    message: "Vertrek vanuit Amsterdam",
                    maneuver: "DEPART",
                    street: "Centraal",
                    direction: null,
                    roadNumbers: [],
                    exitNumber: null,
                  },
                  {
                    id: "2",
                    point: { latitude: 52.36, longitude: 4.90 },
                    distanceInMeters: 1000,
                    instructionDistanceInMeters: 1000,
                    durationInSeconds: 60,
                    countryCode: "NLD",
                    drivingSide: "RIGHT",
                    message: "Neem de A2 richting Utrecht",
                    maneuver: "TURN_RIGHT",
                    street: "A2",
                    direction: null,
                    roadNumbers: ["A2"],
                    exitNumber: null,
                  },
                ],
              },
            ],
            transportMode: "car",
            summary: {
              distanceInMeters: 125000,
              durationInSeconds: 4500,
              delayInSeconds: 300,
              departure: "2026-03-05T10:00:00Z",
              arrival: "2026-03-05T11:15:00Z",
              roadNumbers: ["A2", "A27"],
              tollRoads: 0,
              countryCodesAlongTheRoute: ["NLD"],
            },
          },
        ],
      });

      const result = (await handler()({
        locations: "52.37,4.89:51.44,5.47",
        transportMode: "car",
        routeType: "fastest",
        includeAlternatives: true,
        tollInfo: true,
        traffic: true,
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Recommended route");
      expect(result.content[0].text).toContain("125.0 km");
      expect(result.content[0].text).toContain("1h 15min");
      expect(result.content[0].text).toContain("Delay: 5 min");
      expect(result.content[0].text).toContain("A2 → A27");
      expect(result.content[0].text).toContain("Vertrek vanuit Amsterdam");
      expect(result.content[0].text).toContain("Neem de A2 richting Utrecht");
      expect(result.content[0].text).toContain("[A2]");
      expect(result.structuredContent).toBeDefined();
    });

    it("returns formatted bike route", async () => {
      client.getRoute.mockResolvedValueOnce({
        value: [
          {
            id: "route-bike-1",
            waypoints: [
              { latitude: 52.09, longitude: 5.12 },
              { latitude: 52.08, longitude: 5.13 },
            ],
            legs: [
              {
                summary: {
                  distanceInMeters: 3500,
                  durationInSeconds: 840,
                  delayInSeconds: 0,
                  departure: "2026-03-05T10:00:00Z",
                  arrival: "2026-03-05T10:14:00Z",
                },
                instructions: [
                  {
                    id: "1",
                    point: { latitude: 52.09, longitude: 5.12 },
                    distanceInMeters: 0,
                    instructionDistanceInMeters: 0,
                    durationInSeconds: 0,
                    message: "Vertrek",
                    maneuver: "DEPART",
                  },
                  {
                    id: "2",
                    point: { latitude: 52.09, longitude: 5.12 },
                    distanceInMeters: 500,
                    instructionDistanceInMeters: 500,
                    durationInSeconds: 120,
                    message: "Ga rechtsaf naar Fietspad",
                    maneuver: "TURN_RIGHT",
                    remark: "Fietspad",
                  },
                ],
              },
            ],
            transportMode: "bike",
            summary: {
              distanceInMeters: 3500,
              durationInSeconds: 840,
              delayInSeconds: 0,
              departure: "2026-03-05T10:00:00Z",
              arrival: "2026-03-05T10:14:00Z",
            },
          },
        ],
      });

      const result = (await handler()({
        locations: "52.09,5.12:52.08,5.13",
        transportMode: "bike",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Recommended route");
      expect(result.content[0].text).toContain("3.5 km");
      expect(result.content[0].text).toContain("14 min");
      expect(result.content[0].text).toContain("Ga rechtsaf naar Fietspad");
    });

    it("returns formatted pedestrian route", async () => {
      client.getRoute.mockResolvedValueOnce({
        value: [
          {
            id: "route-ped-1",
            waypoints: [
              { latitude: 52.09, longitude: 5.12 },
              { latitude: 52.085, longitude: 5.125 },
            ],
            legs: [
              {
                summary: {
                  distanceInMeters: 800,
                  durationInSeconds: 600,
                  delayInSeconds: 0,
                  departure: "2026-03-05T10:00:00Z",
                  arrival: "2026-03-05T10:10:00Z",
                },
                instructions: [
                  {
                    id: "1",
                    point: { latitude: 52.09, longitude: 5.12 },
                    distanceInMeters: 0,
                    instructionDistanceInMeters: 0,
                    durationInSeconds: 0,
                    message: "Vertrek",
                    maneuver: "DEPART",
                  },
                  {
                    id: "2",
                    point: { latitude: 52.09, longitude: 5.12 },
                    distanceInMeters: 200,
                    instructionDistanceInMeters: 200,
                    durationInSeconds: 150,
                    message: "Ga linksaf",
                    maneuver: "TURN_LEFT",
                    availability: "open",
                    subTypeTitle: "Voetpad",
                  },
                ],
              },
            ],
            transportMode: "pedestrian",
            summary: {
              distanceInMeters: 800,
              durationInSeconds: 600,
              delayInSeconds: 0,
              departure: "2026-03-05T10:00:00Z",
              arrival: "2026-03-05T10:10:00Z",
            },
          },
        ],
      });

      const result = (await handler()({
        locations: "52.09,5.12:52.085,5.125",
        transportMode: "pedestrian",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Recommended route");
      expect(result.content[0].text).toContain("800 m");
      expect(result.content[0].text).toContain("10 min");
      expect(result.content[0].text).toContain("Ga linksaf");
    });

    it("handles instructions without roadNumbers (bike/pedestrian)", async () => {
      client.getRoute.mockResolvedValueOnce({
        value: [
          {
            id: "route-1",
            waypoints: [],
            legs: [
              {
                summary: { distanceInMeters: 1000, durationInSeconds: 300, delayInSeconds: 0, departure: "2026-03-05T10:00:00Z", arrival: "2026-03-05T10:05:00Z" },
                instructions: [
                  {
                    id: "1",
                    point: { latitude: 52.09, longitude: 5.12 },
                    distanceInMeters: 500,
                    instructionDistanceInMeters: 500,
                    durationInSeconds: 150,
                    message: "Ga rechtdoor",
                    maneuver: "STRAIGHT",
                  },
                ],
              },
            ],
            transportMode: "bike",
            summary: { distanceInMeters: 1000, durationInSeconds: 300, delayInSeconds: 0, departure: "2026-03-05T10:00:00Z", arrival: "2026-03-05T10:05:00Z" },
          },
        ],
      });

      const result = (await handler()({
        locations: "52.09,5.12:52.08,5.13",
        transportMode: "bike",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Ga rechtdoor");
      expect(result.content[0].text).not.toContain("[");
    });

    it("returns message when no route found", async () => {
      client.getRoute.mockResolvedValueOnce({ value: [] });

      const result = (await handler()({
        locations: "0,0:0,0",
        transportMode: "car",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
      })) as ToolResult;

      expect(result.content[0].text).toContain("No route found");
    });

    it("labels alternative routes correctly", async () => {
      client.getRoute.mockResolvedValueOnce({
        value: [
          {
            id: "1",
            waypoints: [],
            legs: [{ summary: { distanceInMeters: 100000, durationInSeconds: 3600, delayInSeconds: 0, departure: "2026-03-05T10:00:00Z", arrival: "2026-03-05T11:00:00Z" }, instructions: [] }],
            transportMode: "car",
            summary: { distanceInMeters: 100000, durationInSeconds: 3600, delayInSeconds: 0, departure: "2026-03-05T10:00:00Z", arrival: "2026-03-05T11:00:00Z" },
          },
          {
            id: "2",
            waypoints: [],
            legs: [{ summary: { distanceInMeters: 90000, durationInSeconds: 3900, delayInSeconds: 0, departure: "2026-03-05T10:00:00Z", arrival: "2026-03-05T11:05:00Z" }, instructions: [] }],
            transportMode: "car",
            summary: {
              distanceInMeters: 90000,
              durationInSeconds: 3900,
              delayInSeconds: 0,
              departure: "2026-03-05T10:00:00Z",
              arrival: "2026-03-05T11:05:00Z",
              difference: { distanceInMeters: -10000, durationInSeconds: 300 },
            },
          },
        ],
      });

      const result = (await handler()({
        locations: "52.37,4.89:51.44,5.47",
        transportMode: "car",
        routeType: "fastest",
        includeAlternatives: true,
        tollInfo: true,
        traffic: true,
      })) as ToolResult;

      expect(result.content[0].text).toContain("Recommended route");
      expect(result.content[0].text).toContain("Alternative route 2");
      expect(result.content[0].text).toContain("Compared to recommended");
    });

    it("handles API errors", async () => {
      client.getRoute.mockRejectedValueOnce(apiError);

      const result = (await handler()({
        locations: "52.37,4.89:51.44,5.47",
        transportMode: "car",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
      })) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ANWB API error");
    });

    it("passes transportMode to client", async () => {
      client.getRoute.mockResolvedValueOnce({ value: [] });

      await handler()({
        locations: "52.37,4.89:51.44,5.47",
        transportMode: "bike",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
        avoid: [],
      });

      expect(client.getRoute).toHaveBeenCalledWith(
        expect.objectContaining({ transportMode: "bike" }),
      );
    });

    it("passes avoid parameter to client", async () => {
      client.getRoute.mockResolvedValueOnce({ value: [] });

      await handler()({
        locations: "52.37,4.89:51.44,5.47",
        transportMode: "car",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: true,
        traffic: true,
        avoid: ["tollRoads", "motorways"],
      });

      expect(client.getRoute).toHaveBeenCalledWith(
        expect.objectContaining({ avoid: ["tollRoads", "motorways"] }),
      );
    });

    it("passes transportSubtype for bike mode", async () => {
      client.getRoute.mockResolvedValueOnce({ value: [] });

      await handler()({
        locations: "52.37,4.89:51.44,5.47",
        transportMode: "bike",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: false,
        traffic: false,
        avoid: [],
        transportSubtype: "ebike",
      });

      expect(client.getRoute).toHaveBeenCalledWith(
        expect.objectContaining({ transportSubtype: "ebike" }),
      );
    });

    it("returns formatted caravan route", async () => {
      client.getRoute.mockResolvedValueOnce({
        value: [
          {
            id: "route-caravan-1",
            waypoints: [
              { latitude: 52.04, longitude: 5.67 },
              { latitude: 52.35, longitude: 5.98 },
            ],
            legs: [
              {
                summary: {
                  distanceInMeters: 55000,
                  durationInSeconds: 3000,
                  delayInSeconds: 0,
                  departure: "2026-03-05T10:00:00Z",
                  arrival: "2026-03-05T10:50:00Z",
                },
                instructions: [
                  {
                    id: "1",
                    point: { latitude: 52.04, longitude: 5.67 },
                    distanceInMeters: 0,
                    instructionDistanceInMeters: 0,
                    durationInSeconds: 0,
                    countryCode: "NLD",
                    drivingSide: "RIGHT",
                    message: "Vertrek vanuit Ede",
                    maneuver: "DEPART",
                    street: "Maanderplein",
                    direction: null,
                    roadNumbers: [],
                    exitNumber: null,
                  },
                ],
              },
            ],
            transportMode: "caravan",
            summary: {
              distanceInMeters: 55000,
              durationInSeconds: 3000,
              delayInSeconds: 0,
              departure: "2026-03-05T10:00:00Z",
              arrival: "2026-03-05T10:50:00Z",
              roadNumbers: ["A1", "A50"],
              tollRoads: 0,
              countryCodesAlongTheRoute: ["NLD"],
            },
          },
        ],
      });

      const result = (await handler()({
        locations: "52.04,5.67:52.35,5.98",
        transportMode: "caravan",
        routeType: "fastest",
        includeAlternatives: false,
        tollInfo: true,
        traffic: true,
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("55.0 km");
      expect(result.content[0].text).toContain("A1 → A50");
    });
  });

  describe("calculate_ev_route", () => {
    const handler = () => server.getHandler("calculate_ev_route");

    it("returns formatted EV route with battery info", async () => {
      client.getEvRoute.mockResolvedValueOnce({
        value: {
          id: "ev-route-1",
          transportMode: "ev",
          waypoints: [
            { latitude: 52.04, longitude: 5.67 },
            { latitude: 52.35, longitude: 5.98 },
          ],
          polyline: "abc",
          savings: { money: -1.09, averageGasPrice: 0, averageEnergyPrice: 0 },
          legs: [
            {
              instructions: [
                {
                  id: "1",
                  type: "final",
                  name: "",
                  departure: "2026-03-05T10:00:00Z",
                  arrival: "2026-03-05T10:45:00Z",
                  distanceInMeters: 60000,
                  durationInSeconds: 2700,
                  rangeStart: 193000,
                  rangeStartPercentage: 100,
                  rangeEnd: 124000,
                  rangeEndPercentage: 64,
                  destination: { latitude: 52.35, longitude: 5.98 },
                  stationId: null,
                  recommendedConnector: null,
                  chargeTime: 0,
                  charge: { from: 64, to: null },
                  range: { from: 124000, to: null },
                },
              ],
              summary: {
                departure: "2026-03-05T10:00:00Z",
                arrival: "2026-03-05T10:45:00Z",
                rangeStart: 193000,
                rangeStartPercentage: 100,
                rangeEnd: 124000,
                rangeEndPercentage: 64,
              },
            },
          ],
          summary: {
            departure: "2026-03-05T10:00:00Z",
            arrival: "2026-03-05T10:45:00Z",
            distanceInMeters: 60000,
            durationInSeconds: 2700,
            evInformation: {
              charges: 0,
              chargeTime: 0,
              rangeStart: 193000,
              rangeEnd: 124000,
              rangeStartPercentage: 100,
              rangeEndPercentage: 64,
              consumptionKwh: 12.5,
            },
          },
          stationsAlongRoute: [
            { id: "station-1", latitude: 52.2, longitude: 5.8 },
          ],
          tags: ["highway"],
        },
      });

      const result = (await handler()({
        locations: "52.04,5.67:52.35,5.98",
        carId: "646ca73f3f6beb1fcbdbdf70",
        capacity: 100,
        stateOfCharge: 100,
        finalStateOfCharge: 20,
        complexity: 1.15,
      })) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("EV Route");
      expect(result.content[0].text).toContain("60.0 km");
      expect(result.content[0].text).toContain("100% → 64%");
      expect(result.content[0].text).toContain("12.5 kWh");
      expect(result.content[0].text).toContain("none needed");
      expect(result.content[0].text).toContain("Charging stations along route: 1");
      expect(result.content[0].text).toContain("€-1.09");
      expect(result.structuredContent).toBeDefined();
    });

    it("returns message when no EV route found", async () => {
      client.getEvRoute.mockResolvedValueOnce({ value: null });

      const result = (await handler()({
        locations: "0,0:0,0",
        carId: "abc",
        capacity: 100,
        stateOfCharge: 100,
        finalStateOfCharge: 20,
        complexity: 1.15,
      })) as ToolResult;

      expect(result.content[0].text).toContain("No EV route found");
    });

    it("handles API errors", async () => {
      client.getEvRoute.mockRejectedValueOnce(apiError);

      const result = (await handler()({
        locations: "52.04,5.67:52.35,5.98",
        carId: "abc",
        capacity: 100,
        stateOfCharge: 100,
        finalStateOfCharge: 20,
        complexity: 1.15,
      })) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ANWB API error");
    });

    it("shows charging stop details when route requires charging", async () => {
      client.getEvRoute.mockResolvedValueOnce({
        value: {
          id: "ev-route-2",
          transportMode: "ev",
          waypoints: [],
          polyline: "abc",
          savings: { money: 0, averageGasPrice: 0, averageEnergyPrice: 0 },
          legs: [
            {
              instructions: [
                {
                  id: "1",
                  type: "charge",
                  name: "Fastned A1",
                  departure: "2026-03-05T10:00:00Z",
                  arrival: "2026-03-05T11:00:00Z",
                  distanceInMeters: 150000,
                  durationInSeconds: 3600,
                  rangeStart: 193000,
                  rangeStartPercentage: 100,
                  rangeEnd: 30000,
                  rangeEndPercentage: 16,
                  destination: { latitude: 52.5, longitude: 5.5 },
                  stationId: "station-abc",
                  recommendedConnector: "CCS",
                  chargeTime: 1200,
                  charge: { from: 16, to: 80 },
                  range: { from: 30000, to: 154000 },
                },
              ],
              summary: {
                departure: "2026-03-05T10:00:00Z",
                arrival: "2026-03-05T11:00:00Z",
                rangeStart: 193000,
                rangeStartPercentage: 100,
                rangeEnd: 30000,
                rangeEndPercentage: 16,
              },
            },
            {
              instructions: [
                {
                  id: "2",
                  type: "final",
                  name: "",
                  departure: "2026-03-05T11:20:00Z",
                  arrival: "2026-03-05T12:00:00Z",
                  distanceInMeters: 100000,
                  durationInSeconds: 2400,
                  rangeStart: 154000,
                  rangeStartPercentage: 80,
                  rangeEnd: 60000,
                  rangeEndPercentage: 31,
                  destination: { latitude: 53.0, longitude: 6.0 },
                  stationId: null,
                  recommendedConnector: null,
                  chargeTime: 0,
                  charge: { from: 31, to: null },
                  range: { from: 60000, to: null },
                },
              ],
              summary: {
                departure: "2026-03-05T11:20:00Z",
                arrival: "2026-03-05T12:00:00Z",
                rangeStart: 154000,
                rangeStartPercentage: 80,
                rangeEnd: 60000,
                rangeEndPercentage: 31,
              },
            },
          ],
          summary: {
            departure: "2026-03-05T10:00:00Z",
            arrival: "2026-03-05T12:00:00Z",
            distanceInMeters: 250000,
            durationInSeconds: 7200,
            evInformation: {
              charges: 1,
              chargeTime: 1200,
              rangeStart: 193000,
              rangeEnd: 60000,
              rangeStartPercentage: 100,
              rangeEndPercentage: 31,
              consumptionKwh: 45.0,
            },
          },
          stationsAlongRoute: [],
          tags: [],
        },
      });

      const result = (await handler()({
        locations: "52.04,5.67:53.0,6.0",
        carId: "abc",
        capacity: 100,
        stateOfCharge: 100,
        finalStateOfCharge: 20,
        complexity: 1.15,
      })) as ToolResult;

      expect(result.content[0].text).toContain("Charging stops: 1");
      expect(result.content[0].text).toContain("Total charge time: 20 min");
      expect(result.content[0].text).toContain("Charging station: station-abc");
      expect(result.content[0].text).toContain("Charge: 16% → 80%");
    });
  });

  describe("list_ev_cars", () => {
    const handler = () => server.getHandler("list_ev_cars");

    it("returns formatted EV cars list", async () => {
      client.getEvCars.mockResolvedValueOnce({ result: [
        { id: "abc123", naming: { make: "Tesla", model: "Model 3", chargetripVersion: "Long Range" }, battery: { usableKWH: 75, fullKWH: 82 } },
        { id: "def456", naming: { make: "Volkswagen", model: "ID.4", chargetripVersion: "Pro" }, battery: { usableKWH: 77, fullKWH: 82 } },
      ] });

      const result = (await handler()({})) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Found 2 electric vehicles");
      expect(result.content[0].text).toContain("Tesla Model 3 Long Range");
      expect(result.content[0].text).toContain("abc123");
      expect(result.content[0].text).toContain("75 kWh usable");
      expect(result.content[0].text).toContain("Volkswagen ID.4 Pro");
      expect(result.structuredContent).toBeDefined();
    });

    it("filters by make", async () => {
      client.getEvCars.mockResolvedValueOnce({ result: [
        { id: "abc", naming: { make: "Tesla", model: "Model 3", chargetripVersion: "LR" }, battery: { usableKWH: 75, fullKWH: 82 } },
        { id: "def", naming: { make: "BMW", model: "iX3", chargetripVersion: "Standard" }, battery: { usableKWH: 74, fullKWH: 80 } },
      ] });

      const result = (await handler()({ make: "Tesla" })) as ToolResult;

      expect(result.content[0].text).toContain("Found 1 electric vehicle:");
      expect(result.content[0].text).toContain("Tesla");
      expect(result.content[0].text).not.toContain("BMW");
    });

    it("filters by search term", async () => {
      client.getEvCars.mockResolvedValueOnce({ result: [
        { id: "abc", naming: { make: "Tesla", model: "Model 3", chargetripVersion: "LR" }, battery: { usableKWH: 75, fullKWH: 82 } },
        { id: "def", naming: { make: "Tesla", model: "Model Y", chargetripVersion: "LR" }, battery: { usableKWH: 75, fullKWH: 82 } },
      ] });

      const result = (await handler()({ search: "Model 3" })) as ToolResult;

      expect(result.content[0].text).toContain("Model 3");
      expect(result.content[0].text).not.toContain("Model Y");
    });

    it("returns no results message when filter matches nothing", async () => {
      client.getEvCars.mockResolvedValueOnce({ result: [
        { id: "abc", naming: { make: "Tesla", model: "Model 3", chargetripVersion: "LR" }, battery: { usableKWH: 75, fullKWH: 82 } },
      ] });

      const result = (await handler()({ make: "Nonexistent" })) as ToolResult;

      expect(result.content[0].text).toContain("No electric vehicles found");
    });

    it("handles API errors", async () => {
      client.getEvCars.mockRejectedValueOnce(apiError);

      const result = (await handler()({})) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ANWB API error");
    });
  });
});

// --- Incident Tools ---

describe("incident tools", () => {
  let server: ReturnType<typeof createMockServer>;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    server = createMockServer();
    client = createMockClient();
    registerIncidentTools(server as never, client as unknown as AnwbClient);
  });

  describe("get_traffic_incidents", () => {
    const handler = () => server.getHandler("get_traffic_incidents");

    it("returns formatted incidents", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [
          {
            road: "A1",
            type: "a",
            segments: [
              {
                start: "Amsterdam",
                end: "Amersfoort",
                jams: [
                  {
                    id: 1,
                    road: "A1",
                    segmentId: 1,
                    codeDirection: 1,
                    type: "a",
                    afrc: 0,
                    category: "jams",
                    label: "closed",
                    incidentType: "road-closed",
                    from: "Baarn",
                    fromLoc: { lat: 52.22, lon: 5.30 },
                    to: "Amersfoort",
                    toLoc: { lat: 52.21, lon: 5.37 },
                    events: [{ alertC: 406, text: "Dicht" }],
                    reason: "De oprit is dicht.",
                  },
                ],
                radars: [
                  {
                    id: 2,
                    road: "A1",
                    segmentId: 1,
                    codeDirection: 1,
                    type: "a",
                    afrc: 0,
                    category: "radars",
                    incidentType: "radar",
                    from: "Hilversum",
                    fromLoc: { lat: 52.25, lon: 5.21 },
                    to: "Eemnes",
                    toLoc: { lat: 52.23, lon: 5.24 },
                    events: [{ alertC: 3101, text: "Snelheidscontrole" }],
                    reason: "Bij hectometerpaal 27.7.",
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = (await handler()({})) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Traffic update:");
      expect(result.content[0].text).toContain("A1");
      expect(result.content[0].text).toContain("2 incidents");
      expect(result.content[0].text).toContain("road-closed");
      expect(result.content[0].text).toContain("Baarn");
      expect(result.content[0].text).toContain("radar");
      expect(result.structuredContent).toBeDefined();
    });

    it("filters by road", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [
          {
            road: "A1",
            type: "a",
            segments: [{ start: "A", end: "B", jams: [{ id: 1, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "jams", incidentType: "jam", from: "X", fromLoc: { lat: 52, lon: 5 }, to: "Y", toLoc: { lat: 52, lon: 5 }, events: [], reason: "File" }] }],
          },
          {
            road: "A2",
            type: "a",
            segments: [{ start: "C", end: "D", jams: [{ id: 2, road: "A2", segmentId: 2, codeDirection: 1, type: "a", afrc: 0, category: "jams", incidentType: "jam", from: "P", fromLoc: { lat: 51, lon: 5 }, to: "Q", toLoc: { lat: 51, lon: 5 }, events: [], reason: "File" }] }],
          },
        ],
      });

      const result = (await handler()({ road: "A1" })) as ToolResult;

      expect(result.content[0].text).toContain("A1");
      expect(result.content[0].text).not.toContain("A2");
      expect(result.content[0].text).toContain("Filtered by road: A1");
    });

    it("filters by category", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [
          {
            road: "A1",
            type: "a",
            segments: [{
              start: "A",
              end: "B",
              jams: [{ id: 1, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "jams", incidentType: "jam", from: "X", fromLoc: { lat: 52, lon: 5 }, to: "Y", toLoc: { lat: 52, lon: 5 }, events: [], reason: "File" }],
              radars: [{ id: 2, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "radars", incidentType: "radar", from: "P", fromLoc: { lat: 52, lon: 5 }, to: "Q", toLoc: { lat: 52, lon: 5 }, events: [], reason: "Radar" }],
            }],
          },
        ],
      });

      const result = (await handler()({ category: "radars" })) as ToolResult;

      expect(result.content[0].text).toContain("radar");
      expect(result.content[0].text).toContain("1 incident");
      expect(result.content[0].text).toContain("Filtered by category: radars");
    });

    it("returns no incidents message when filtered result is empty", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [
          {
            road: "A1",
            type: "a",
            segments: [{ start: "A", end: "B" }],
          },
        ],
      });

      const result = (await handler()({ road: "A99" })) as ToolResult;

      expect(result.content[0].text).toContain("No incidents found for road A99");
    });

    it("returns no traffic info message when roads are empty", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [],
      });

      const result = (await handler()({})) as ToolResult;

      expect(result.content[0].text).toContain("No traffic information available");
    });

    it("handles API errors", async () => {
      client.getIncidents.mockRejectedValueOnce(apiError);

      const result = (await handler()({})) as ToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("ANWB API error");
    });
  });

  describe("get_traffic_summary", () => {
    const handler = () => server.getHandler("get_traffic_summary");

    it("returns traffic summary with counts", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [
          {
            road: "A1",
            type: "a",
            segments: [{
              start: "A",
              end: "B",
              jams: [
                { id: 1, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "jams", incidentType: "jam", from: "X", fromLoc: { lat: 52, lon: 5 }, to: "Y", toLoc: { lat: 52, lon: 5 }, events: [], reason: "File" },
                { id: 2, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "jams", incidentType: "road-closed", from: "P", fromLoc: { lat: 52, lon: 5 }, to: "Q", toLoc: { lat: 52, lon: 5 }, events: [], reason: "Dicht" },
              ],
              roadworks: [
                { id: 3, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "roadworks", incidentType: "roadwork", from: "R", fromLoc: { lat: 52, lon: 5 }, to: "S", toLoc: { lat: 52, lon: 5 }, events: [], reason: "Werk" },
              ],
              radars: [
                { id: 4, road: "A1", segmentId: 1, codeDirection: 1, type: "a", afrc: 0, category: "radars", incidentType: "radar", from: "T", fromLoc: { lat: 52, lon: 5 }, to: "U", toLoc: { lat: 52, lon: 5 }, events: [], reason: "Radar" },
              ],
            }],
          },
        ],
      });

      const result = (await handler()({})) as ToolResult;

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Traffic summary:");
      expect(result.content[0].text).toContain("Total incidents: 4");
      expect(result.content[0].text).toContain("Traffic jams: 1");
      expect(result.content[0].text).toContain("Road closures: 1");
      expect(result.content[0].text).toContain("Roadworks: 1");
      expect(result.content[0].text).toContain("Speed cameras: 1");
      expect(result.content[0].text).toContain("A1");
      expect(result.structuredContent).toBeDefined();
    });

    it("handles empty roads", async () => {
      client.getIncidents.mockResolvedValueOnce({
        success: true,
        dateTime: "2026-03-05T20:00:00Z",
        roads: [],
      });

      const result = (await handler()({})) as ToolResult;

      expect(result.content[0].text).toContain("Total incidents: 0");
      expect(result.content[0].text).toContain("Affected roads: none");
    });

    it("handles API errors", async () => {
      client.getIncidents.mockRejectedValueOnce(apiError);

      const result = (await handler()({})) as ToolResult;

      expect(result.isError).toBe(true);
    });
  });
});
