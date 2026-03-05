// --- Location Search ---

export interface LocationPoi {
  name: string;
}

export interface LocationResult {
  poi: LocationPoi | null;
  address: string;
  street: string | null;
  houseNumber: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  countrySecondarySubdivision: string | null;
  countrySubdivision: string | null;
  type: string;
  score: number;
}

export interface LocationSearchResponse {
  copyright: string;
  data: LocationResult[];
}

// --- Route ---

export interface RouteWaypoint {
  latitude: number;
  longitude: number;
}

export interface RouteSummary {
  distanceInMeters: number;
  durationInSeconds: number;
  delayInSeconds: number;
  departure: string;
  arrival: string;
  roadNumbers?: string[];
  difference?: {
    distanceInMeters: number;
    durationInSeconds: number;
  };
  tollRoads?: number;
  tollVignettes?: string[];
  tollRoadCoordinates?: { latitude: number; longitude: number }[][];
  countryCodesAlongTheRoute?: string[];
  numberOfFerries?: number;
}

export interface RouteInstruction {
  id: string;
  point: {
    latitude: number;
    longitude: number;
  };
  distanceInMeters: number;
  instructionDistanceInMeters: number;
  durationInSeconds: number;
  countryCode?: string;
  drivingSide?: string;
  message: string;
  maneuver: string;
  street?: string | null;
  direction?: string | null;
  roadNumbers?: string[];
  exitNumber?: string | null;
  remark?: string | null;
  availability?: string | null;
  subTypeTitle?: string | null;
}

export interface RouteLeg {
  summary: RouteSummary;
  polyline: string;
  instructions: RouteInstruction[];
}

export interface Route {
  id: string;
  waypoints: RouteWaypoint[];
  legs: RouteLeg[];
  transportMode: string;
  summary: RouteSummary;
}

export interface RouteResponse {
  copyright: string;
  value: Route[];
}

// --- Incidents ---

export interface IncidentLocation {
  lat: number;
  lon: number;
}

export interface IncidentEvent {
  alertC: number;
  text: string;
}

export interface IncidentBounds {
  southWest: IncidentLocation;
  northEast: IncidentLocation;
}

export interface Incident {
  id: number;
  road: string;
  segmentId: number;
  codeDirection: number;
  type: string;
  afrc: number;
  category: string;
  label?: string;
  incidentType: string;
  from: string;
  fromLoc: IncidentLocation;
  to: string;
  toLoc: IncidentLocation;
  loc?: IncidentLocation;
  HM?: number;
  polyline?: string;
  bounds?: IncidentBounds;
  events: IncidentEvent[];
  reason: string;
  start?: string;
  stop?: string;
  delay?: number;
  distance?: number;
}

export interface RoadSegment {
  start: string;
  end: string;
  jams?: Incident[];
  radars?: Incident[];
  roadworks?: Incident[];
}

export interface Road {
  road: string;
  type: string;
  segments: RoadSegment[];
}

export interface IncidentsResponse {
  success: boolean;
  copyright: string;
  dateTime: string;
  roads: Road[];
}

// --- Search Parameters ---

export type LocationIndexSet = "PAD" | "Str" | "Geo" | "Addr" | "POI";

export type LocationArea = "ALL" | "NLD";

export interface LocationSearchParams {
  freetext: string;
  limit?: number;
  area?: LocationArea;
  idxSet?: LocationIndexSet[];
}

export type TransportMode = "car" | "bike" | "pedestrian" | "caravan";

export type RouteType = "fastest" | "shortest";

export type RouteAvoid = "tollRoads" | "motorways" | "ferries" | "unpavedRoads";

export type BikeSubtype = "bike" | "ebike";

export interface RouteParams {
  transportMode: TransportMode;
  locations: string;
  tollInfo?: boolean;
  traffic?: boolean;
  routeType?: RouteType;
  includeAlternatives?: boolean;
  avoid?: RouteAvoid[];
  transportSubtype?: BikeSubtype;
}

// --- EV Cars ---

export interface EvCarNaming {
  make: string;
  model: string;
  chargetripVersion: string;
}

export interface EvCarBattery {
  usableKWH: number;
  fullKWH: number;
}

export interface EvCar {
  id: string;
  naming: EvCarNaming;
  battery: EvCarBattery;
}

export interface EvCarsResponse {
  result: EvCar[];
}

// --- EV Route ---

export interface EvRouteParams {
  locations: string;
  carId: string;
  capacity: number;
  stateOfCharge: number;
  finalStateOfCharge?: number;
  complexity?: number;
}

export interface EvChargingStation {
  id: string;
  latitude: number;
  longitude: number;
}

export interface EvLegInstruction {
  id: string;
  type: string;
  name: string | null;
  departure: string;
  arrival: string;
  distanceInMeters: number;
  durationInSeconds: number;
  rangeStart: number;
  rangeStartPercentage: number;
  rangeEnd: number;
  rangeEndPercentage: number;
  destination: { latitude: number; longitude: number };
  stationId: string | null;
  recommendedConnector: string | null;
  chargeTime: number;
  charge: { from: number; to: number | null };
  range: { from: number; to: number | null };
}

export interface EvLegSummary {
  departure: string;
  arrival: string;
  rangeStart: number;
  rangeStartPercentage: number;
  rangeEnd: number;
  rangeEndPercentage: number;
}

export interface EvLeg {
  instructions: EvLegInstruction[];
  summary: EvLegSummary;
}

export interface EvSummary {
  departure: string;
  arrival: string;
  distanceInMeters: number;
  durationInSeconds: number;
  evInformation: {
    charges: number;
    chargeTime: number;
    rangeStart: number;
    rangeEnd: number;
    rangeStartPercentage: number;
    rangeEndPercentage: number;
    consumptionKwh: number;
  };
}

export interface EvRoute {
  id: string;
  transportMode: string;
  waypoints: RouteWaypoint[];
  polyline: string;
  savings: { money: number; averageGasPrice: number; averageEnergyPrice: number };
  legs: EvLeg[];
  summary: EvSummary;
  stationsAlongRoute: EvChargingStation[];
  tags: string[];
}

export interface EvRouteResponse {
  copyright: string;
  value: EvRoute;
}
