import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnwbClient, AnwbApiError } from "./anwb-client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("AnwbClient", () => {
  let client: AnwbClient;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockFetch.mockReset();
    client = new AnwbClient("test-caller", "https://api.test.com");
  });

  describe("request building", () => {
    it("sends x-anwb-caller-id header on location and route requests", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      await client.findLocations({ freetext: "amsterdam" });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("x-anwb-caller-id")).toBe("test-caller");
    });

    it("does not send x-anwb-caller-id header on incident requests", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ success: true, roads: [] }));

      await client.getIncidents();

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get("x-anwb-caller-id")).toBeNull();
    });

    it("strips trailing slash from baseUrl", () => {
      const c = new AnwbClient("caller", "https://api.test.com/");
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
      void c.findLocations({ freetext: "test" });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toMatch(/^https:\/\/api\.test\.com\/routing\//);
    });
  });

  describe("findLocations", () => {
    it("builds query string from search params", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      await client.findLocations({ freetext: "ede", limit: 5, area: "NLD" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("freetext=ede");
      expect(url).toContain("limit=5");
      expect(url).toContain("area=NLD");
    });

    it("includes idxSet when provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      await client.findLocations({ freetext: "test", idxSet: ["PAD", "Geo"] });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("idxSet=PAD%2CGeo");
    });

    it("omits optional params when not provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      await client.findLocations({ freetext: "test" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("limit=");
      expect(url).not.toContain("idxSet=");
    });

    it("caches location search results", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }));

      await client.findLocations({ freetext: "test" });
      await client.findLocations({ freetext: "test" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("does not use cache for different params", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }));

      await client.findLocations({ freetext: "test" });
      await client.findLocations({ freetext: "other" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("getRoute", () => {
    it("builds query string from route params", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "car",
        locations: "52.37,4.89:51.44,5.47",
        tollInfo: true,
        traffic: true,
        routeType: "fastest",
        includeAlternatives: true,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/route/car?");
      expect(url).toContain("locations=52.37%2C4.89%3A51.44%2C5.47");
      expect(url).toContain("tollInfo=true");
      expect(url).toContain("traffic=true");
      expect(url).toContain("routeType=fastest");
      expect(url).toContain("includeAlternatives=true");
    });

    it("uses bike transport mode in URL path", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "bike",
        locations: "52.37,4.89:51.44,5.47",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/route/bike?");
    });

    it("uses pedestrian transport mode in URL path", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "pedestrian",
        locations: "52.37,4.89:51.44,5.47",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/route/pedestrian?");
    });

    it("defaults to car when transportMode is not set", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({ locations: "52.37,4.89:51.44,5.47" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/route/car?");
    });

    it("omits tollInfo and traffic for bike mode", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "bike",
        locations: "52.37,4.89:51.44,5.47",
        tollInfo: true,
        traffic: true,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("tollInfo");
      expect(url).not.toContain("traffic");
    });

    it("omits tollInfo and traffic for pedestrian mode", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "pedestrian",
        locations: "52.37,4.89:51.44,5.47",
        tollInfo: true,
        traffic: true,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("tollInfo");
      expect(url).not.toContain("traffic");
    });

    it("always includes routeType and traffic for car mode", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({ locations: "52.37,4.89:51.44,5.47" });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("locations=");
      expect(url).not.toContain("tollInfo");
      expect(url).toContain("routeType=fastest");
      expect(url).toContain("traffic=true");
    });

    it("caches route results", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ value: [] }));

      await client.getRoute({ locations: "52.37,4.89:51.44,5.47" });
      await client.getRoute({ locations: "52.37,4.89:51.44,5.47" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("uses caravan transport mode in URL path", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "caravan",
        locations: "52.04,5.67:52.35,5.98",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/route/caravan?");
    });

    it("includes tollInfo and traffic for caravan mode", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "caravan",
        locations: "52.04,5.67:52.35,5.98",
        tollInfo: true,
        traffic: true,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("tollInfo=true");
      expect(url).toContain("traffic=true");
    });

    it("uses separate cache keys per transport mode", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ value: [] }));

      await client.getRoute({ transportMode: "car", locations: "52.37,4.89:51.44,5.47" });
      await client.getRoute({ transportMode: "bike", locations: "52.37,4.89:51.44,5.47" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("includes avoid parameter when provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "car",
        locations: "52.37,4.89:51.44,5.47",
        avoid: ["tollRoads", "motorways"],
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("avoid=tollRoads%2Cmotorways");
    });

    it("omits avoid parameter when empty", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "car",
        locations: "52.37,4.89:51.44,5.47",
        avoid: [],
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("avoid");
    });

    it("includes transportSubtype for bike mode", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "bike",
        locations: "52.37,4.89:51.44,5.47",
        transportSubtype: "ebike",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("transportSubtype=ebike");
    });

    it("ignores transportSubtype for non-bike modes", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: [] }));

      await client.getRoute({
        transportMode: "car",
        locations: "52.37,4.89:51.44,5.47",
        transportSubtype: "ebike",
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("transportSubtype");
    });
  });

  describe("getEvRoute", () => {
    it("builds query string from EV route params", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: {} }));

      await client.getEvRoute({
        locations: "52.04,5.67:52.35,5.98",
        carId: "646ca73f3f6beb1fcbdbdf70",
        capacity: 100,
        stateOfCharge: 100,
        finalStateOfCharge: 20,
        complexity: 4.2,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/route/ev?");
      expect(url).toContain("locations=");
      expect(url).toContain("carId=646ca73f3f6beb1fcbdbdf70");
      expect(url).toContain("capacity=100");
      expect(url).toContain("stateOfCharge=100");
      expect(url).toContain("finalStateOfCharge=20");
      expect(url).toContain("complexity=4.2");
    });

    it("omits optional EV params when not provided", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ value: {} }));

      await client.getEvRoute({
        locations: "52.04,5.67:52.35,5.98",
        carId: "abc",
        capacity: 50,
        stateOfCharge: 80,
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain("finalStateOfCharge");
      expect(url).not.toContain("complexity");
    });

    it("caches EV route results", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ value: {} }));

      await client.getEvRoute({ locations: "52.04,5.67:52.35,5.98", carId: "abc", capacity: 100, stateOfCharge: 100 });
      await client.getEvRoute({ locations: "52.04,5.67:52.35,5.98", carId: "abc", capacity: 100, stateOfCharge: 100 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getEvCars", () => {
    it("fetches EV cars list", async () => {
      const data = { result: [{ id: "abc", naming: { make: "Tesla", model: "Model 3", chargetripVersion: "Long Range" }, battery: { usableKWH: 75, fullKWH: 82 } }] };
      mockFetch.mockResolvedValueOnce(jsonResponse(data));

      const result = await client.getEvCars();

      expect(result).toEqual(data);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/routing/route/v1/electric-vehicles");
    });

    it("caches EV cars results", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ result: [] }));

      await client.getEvCars();
      await client.getEvCars();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("getIncidents", () => {
    it("fetches incidents", async () => {
      const data = { success: true, dateTime: "2026-03-05T20:00:00Z", roads: [] };
      mockFetch.mockResolvedValueOnce(jsonResponse(data));

      const result = await client.getIncidents();

      expect(result).toEqual(data);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/routing/v1/incidents/incidents-desktop");
    });

    it("caches incident results", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ success: true, roads: [] }));

      await client.getIncidents();
      await client.getIncidents();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("throws AnwbApiError on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
        }),
      );

      await expect(client.findLocations({ freetext: "test" })).rejects.toThrow(AnwbApiError);
    });

    it("includes status code in thrown error", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Bad request" }), {
          status: 400,
          statusText: "Bad Request",
          headers: { "content-type": "application/json" },
        }),
      );

      try {
        await client.findLocations({ freetext: "test" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AnwbApiError);
        expect((error as AnwbApiError).status).toBe(400);
      }
    });

    it("includes parsed body as details", async () => {
      const errorBody = { message: "header validation failed" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 400,
          statusText: "Bad Request",
          headers: { "content-type": "application/json" },
        }),
      );

      try {
        await client.findLocations({ freetext: "test" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as AnwbApiError).details).toEqual(errorBody);
      }
    });

    it("handles text error responses", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Server error", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "content-type": "text/plain" },
        }),
      );

      try {
        await client.findLocations({ freetext: "test" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AnwbApiError);
        expect((error as AnwbApiError).status).toBe(500);
        expect((error as AnwbApiError).details).toBe("Server error");
      }
    });
  });

  describe("retry on 429", () => {
    it("retries on 429 with exponential backoff", async () => {
      vi.useFakeTimers();

      const rateLimited = new Response(null, {
        status: 429,
        statusText: "Too Many Requests",
      });
      const success = jsonResponse({ data: [] });

      mockFetch.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(success);

      const promise = client.findLocations({ freetext: "test" });

      await vi.advanceTimersByTimeAsync(1001);

      const result = await promise;
      expect(result).toEqual({ data: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("uses retry-after header when provided", async () => {
      vi.useFakeTimers();

      const rateLimited = new Response(null, {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "2" },
      });
      const success = jsonResponse({ data: [] });

      mockFetch.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(success);

      const promise = client.findLocations({ freetext: "test" });

      await vi.advanceTimersByTimeAsync(2001);

      const result = await promise;
      expect(result).toEqual({ data: [] });

      vi.useRealTimers();
    });

    it("throws after max retries on persistent 429", async () => {
      const noRetryClient = new AnwbClient("caller", "https://api.test.com", undefined, { maxRetries: 0 });

      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          statusText: "Too Many Requests",
        }),
      );

      await expect(noRetryClient.findLocations({ freetext: "test" })).rejects.toThrow(AnwbApiError);
    });
  });

  describe("caching disabled", () => {
    it("does not cache when cacheTtlMs is 0", async () => {
      const uncachedClient = new AnwbClient("caller", "https://api.test.com", 0);
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }));

      await uncachedClient.findLocations({ freetext: "test" });
      await uncachedClient.findLocations({ freetext: "test" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
