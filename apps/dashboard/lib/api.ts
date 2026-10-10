import type {
  ActionDelivery,
  CameraDetectionInput,
  Event,
  EventInput,
  GemmaConfig,
  Incident,
  IncidentBrief,
  IncidentBriefRequest,
  Integrations,
  Me,
  PublicOverview,
  TimelineEntry,
  Venue,
} from "@shaktios/types";
import { accessToken } from "./supabase";
import { apiUrl, apiConfigurationError } from "./config";
export { apiUrl } from "./config";
export type {
  ActionDelivery,
  CameraDetectionInput,
  Event,
  EventInput,
  GemmaConfig,
  Incident,
  IncidentBrief,
  IncidentBriefRequest,
  Integrations,
  Me,
  PhotoTriageRequest,
  PhotoTriageResponse,
  PublicOverview,
  TimelineEntry,
  Venue,
} from "@shaktios/types";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string, fallback: string) {
    super(detail ? `${fallback} (${status}): ${detail}` : `${fallback} (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function throwForStatus(response: Response, fallback: string): Promise<never> {
  let detail = "";
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
    else if (body.detail !== undefined) detail = JSON.stringify(body.detail);
  } catch {
    // Non-JSON error body — fall back to the status message.
  }
  throw new ApiError(response.status, detail, fallback);
}

export function websocketUrl(path: string): string {
  if (apiConfigurationError) throw new Error(apiConfigurationError);
  return `${apiUrl.replace(/^http/, "ws")}${path}`;
}

/** Authenticated API fetch using the current live Supabase session. */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  if (apiConfigurationError) throw new Error(apiConfigurationError);
  const token = await accessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

/** Optional public overview client. The permanently static landing never calls it. */
export async function getOverview(): Promise<PublicOverview> {
  if (apiConfigurationError) throw new Error(apiConfigurationError);
  const response = await fetch(`${apiUrl}/public/overview`, { cache: "no-store" });
  if (!response.ok) await throwForStatus(response, "Public overview request failed");
  return response.json();
}

export async function getMe(): Promise<Me> {
  const response = await apiFetch(`${apiUrl}/me`);
  if (!response.ok) await throwForStatus(response, "Operator session request failed");
  return response.json();
}

export async function getIncidents(): Promise<Incident[]> {
  const response = await apiFetch(`${apiUrl}/incidents?limit=200`);
  if (!response.ok) await throwForStatus(response, "Incident request failed");
  return response.json();
}

export async function getIncident(incidentId: string): Promise<Incident> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}`);
  if (!response.ok) await throwForStatus(response, "Incident request failed");
  return response.json();
}

export async function getEvents(): Promise<Event[]> {
  const response = await apiFetch(`${apiUrl}/events?limit=200`);
  if (!response.ok) await throwForStatus(response, "Event request failed");
  return response.json();
}

export async function getIncidentEvents(incidentId: string): Promise<Event[]> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/events`);
  if (!response.ok) await throwForStatus(response, "Incident events request failed");
  const events = await response.json() as Event[];
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getTimeline(incidentId: string): Promise<TimelineEntry[]> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/timeline?limit=100`);
  if (!response.ok) await throwForStatus(response, "Timeline request failed");
  const entries = await response.json() as TimelineEntry[];
  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getVenues(): Promise<Venue[]> {
  const response = await apiFetch(`${apiUrl}/venues`);
  if (!response.ok) await throwForStatus(response, "Venue request failed");
  return response.json();
}

export async function getIntegrations(): Promise<Integrations> {
  const response = await apiFetch(`${apiUrl}/integrations`);
  if (!response.ok) await throwForStatus(response, "Integration request failed");
  return response.json();
}

export async function submitEvent(event: EventInput): Promise<Event> {
  const response = await apiFetch(`${apiUrl}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) await throwForStatus(response, "Event submission failed");
  return response.json();
}

export async function submitCameraDetection(input: CameraDetectionInput): Promise<Event> {
  const response = await apiFetch(`${apiUrl}/camera/detections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) await throwForStatus(response, "Camera detection submission failed");
  return response.json();
}

export async function updateIncidentStatus(incidentId: string, status: string, note?: string): Promise<Incident> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!response.ok) await throwForStatus(response, "Status update failed");
  return response.json();
}

export async function requestIncidentAction(
  incidentId: string,
  type: string,
  note?: string,
): Promise<ActionDelivery> {
  const response = await apiFetch(`${apiUrl}/incidents/${incidentId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, note }),
  });
  if (!response.ok) await throwForStatus(response, "Action request failed");
  return response.json();
}

/** Gemma 4 assistance. Ephemeral drafts only: never stores reports or edits incidents. */
export async function getAssistConfig(): Promise<GemmaConfig> {
  const response = await apiFetch(`${apiUrl}/assist/config`);
  if (!response.ok) await throwForStatus(response, "Assist config request failed");
  return response.json();
}

export async function requestIncidentBrief(body: IncidentBriefRequest): Promise<IncidentBrief> {
  const response = await apiFetch(`${apiUrl}/assist/incident-brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await throwForStatus(response, "Gemma brief request failed");
  return response.json();
}
