import { getApiUrl } from "./query-client";
import { fetch } from "expo/fetch";

let memoryToken: string | null = null;

export function setMemoryToken(t: string | null) {
  memoryToken = t;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/auth/refresh", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (!res.ok) {
        memoryToken = null;
        return null;
      }

      const data = await res.json();
      memoryToken = data.token;
      return data.token as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const fetchOptions = {
    method: options.method || "GET",
    headers,
    body: options.body as string | undefined,
    credentials: "include" as const,
  };

  const res = await fetch(url.toString(), fetchOptions);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      const retryRes = await fetch(url.toString(), {
        method: fetchOptions.method,
        headers,
        body: fetchOptions.body,
        credentials: "include",
      });

      if (!retryRes.ok) {
        const data = await retryRes.json().catch(() => ({ message: "Request failed" }));
        throw new Error(data.message || `Error ${retryRes.status}`);
      }
      return retryRes.json();
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(data.message || `Error ${res.status}`);
  }

  return res.json();
}

export async function apiUpload(path: string, formData: FormData): Promise<any> {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);

  const headers: Record<string, string> = {};
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: formData as any,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryRes = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${newToken}` },
        body: formData as any,
        credentials: "include",
      });

      if (!retryRes.ok) {
        const data = await retryRes.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(data.message || `Error ${retryRes.status}`);
      }
      return retryRes.json();
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error(data.message || `Error ${res.status}`);
  }

  return res.json();
}

export function getImageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const baseUrl = getApiUrl();
  return new URL(path, baseUrl).toString();
}
