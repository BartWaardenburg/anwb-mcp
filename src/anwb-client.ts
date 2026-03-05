import { TtlCache } from "./cache.js";
import type {
  LocationSearchParams,
  LocationSearchResponse,
  RouteParams,
  RouteResponse,
  EvRouteParams,
  EvRouteResponse,
  EvCarsResponse,
  IncidentsResponse,
} from "./types.js";

export class AnwbApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export interface RetryOptions {
  maxRetries: number;
}

const DEFAULT_RETRY: RetryOptions = { maxRetries: 3 };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class AnwbClient {
  private readonly baseUrl: string;
  private readonly callerId: string;
  private readonly retry: RetryOptions;
  private readonly cache: TtlCache;
  private readonly cachingEnabled: boolean;

  constructor(
    callerId = "anwb-mcp",
    baseUrl = "https://api.anwb.nl",
    cacheTtlMs?: number,
    retry: RetryOptions = DEFAULT_RETRY,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.callerId = callerId;
    this.retry = retry;
    this.cachingEnabled = cacheTtlMs !== 0;
    this.cache = new TtlCache(cacheTtlMs ?? 120_000);
  }

  private async cachedRequest<T>(cacheKey: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    if (!this.cachingEnabled || ttlMs <= 0) return fetcher();

    const cached = this.cache.get<T>(cacheKey);
    if (cached !== undefined) return cached;

    const result = await fetcher();
    this.cache.set(cacheKey, result, ttlMs);
    return result;
  }

  // --- Location Search ---

  async findLocations(params: LocationSearchParams): Promise<LocationSearchResponse> {
    const query = new URLSearchParams();
    query.set("freetext", params.freetext);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    if (params.area) query.set("area", params.area);
    if (params.idxSet) query.set("idxSet", params.idxSet.join(","));
    query.set("c", "false");

    const queryString = query.toString();
    return this.cachedRequest(
      `locations:${queryString}`,
      300_000,
      () => this.request<LocationSearchResponse>(`/routing/route/v1/find-locations?${queryString}`),
    );
  }

  // --- Route ---

  async getRoute(params: RouteParams): Promise<RouteResponse> {
    const mode = params.transportMode ?? "car";
    const query = new URLSearchParams();
    query.set("locations", params.locations);
    if (mode === "car" || mode === "caravan") {
      query.set("routeType", params.routeType ?? "fastest");
      query.set("traffic", String(params.traffic ?? true));
      if (params.tollInfo !== undefined) query.set("tollInfo", String(params.tollInfo));
    } else {
      if (params.routeType) query.set("routeType", params.routeType);
    }
    if (params.avoid && params.avoid.length > 0) query.set("avoid", params.avoid.join(","));
    if (params.includeAlternatives !== undefined) query.set("includeAlternatives", String(params.includeAlternatives));
    if (mode === "bike" && params.transportSubtype) query.set("transportSubtype", params.transportSubtype);

    const queryString = query.toString();
    return this.cachedRequest(
      `route:${mode}:${queryString}`,
      60_000,
      () => this.request<RouteResponse>(`/routing/route/v1/route/${mode}?${queryString}`),
    );
  }

  // --- EV Route ---

  async getEvRoute(params: EvRouteParams): Promise<EvRouteResponse> {
    const query = new URLSearchParams();
    query.set("locations", params.locations);
    query.set("carId", params.carId);
    query.set("capacity", String(params.capacity));
    query.set("stateOfCharge", String(params.stateOfCharge));
    if (params.finalStateOfCharge !== undefined) query.set("finalStateOfCharge", String(params.finalStateOfCharge));
    if (params.complexity !== undefined) query.set("complexity", String(params.complexity));

    const queryString = query.toString();
    return this.cachedRequest(
      `route:ev:${queryString}`,
      60_000,
      () => this.request<EvRouteResponse>(`/routing/route/v1/route/ev?${queryString}`),
    );
  }

  // --- EV Cars ---

  async getEvCars(): Promise<EvCarsResponse> {
    return this.cachedRequest(
      "ev-cars",
      3_600_000,
      () => this.request<EvCarsResponse>("/routing/route/v1/electric-vehicles"),
    );
  }

  // --- Incidents ---

  async getIncidents(): Promise<IncidentsResponse> {
    return this.cachedRequest(
      "incidents",
      60_000,
      () => this.request<IncidentsResponse>("/routing/v1/incidents/incidents-desktop", undefined, false),
    );
  }

  // --- Private ---

  private static async parseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.includes("application/json")
      ? response.json().catch(() => null)
      : response.text().catch(() => "");
  }

  private async request<T>(path: string, init?: RequestInit, requireCallerId = true): Promise<T> {
    const headers = new Headers(init?.headers);
    if (requireCallerId) {
      headers.set("x-anwb-caller-id", this.callerId);
    }

    const url = `${this.baseUrl}${path}`;
    const requestInit: RequestInit = { ...init, headers };

    const maxRetries = Math.max(0, this.retry.maxRetries);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(url, requestInit);

      if (response.ok) {
        return await AnwbClient.parseBody(response) as T;
      }

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get("retry-after");
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000;
        await sleep(delayMs);
        continue;
      }

      throw new AnwbApiError(
        `ANWB API request failed: ${response.status} ${response.statusText}`,
        response.status,
        await AnwbClient.parseBody(response),
      );
    }

    /* v8 ignore next */
    throw new Error("Retry loop exited unexpectedly");
  }
}
