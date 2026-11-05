const TOKEN_KEY = "crane.token";
const SERVER_KEY = "crane.serverUrl";

/** True inside the Capacitor Android/iOS app (the native bridge injects window.Capacitor). */
export const isNativeApp = Boolean(
  (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(),
);

function readServer(): string | null {
  try {
    return localStorage.getItem(SERVER_KEY);
  } catch {
    return null;
  }
}

// Web: same origin (""). Native app: the server chosen on first launch, or the build-time default.
let BASE = (readServer() ?? (import.meta.env.VITE_API_BASE as string | undefined) ?? "").replace(/\/$/, "");

export function getApiBase() {
  return BASE;
}

/** The native app has no server of its own and must be pointed at one. */
export function needsServerSetup() {
  return isNativeApp && !BASE;
}

export function normaliseServerUrl(raw: string): string {
  const u = new URL(raw.trim().includes("://") ? raw.trim() : `https://${raw.trim()}`);
  const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) throw new Error("Use an https:// address");
  return u.origin;
}

export function setServerUrl(url: string | null) {
  BASE = url ?? "";
  try {
    if (url) localStorage.setItem(SERVER_KEY, url);
    else localStorage.removeItem(SERVER_KEY);
  } catch {
    /* storage unavailable */
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token: string | null = readToken();

export function getToken() {
  return token;
}

export function setToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

