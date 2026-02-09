import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";

/**
 * Get backend API base URL
 */
export function getApiUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "https://ecommerapp.onrender.com"
  );
}

/**
 * In-memory access token
 */
let memoryToken: string | null = null;

export function setQueryToken(t: string | null) {
  memoryToken = t;
}

/**
 * Refresh token handler
 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
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

/**
 * Throw readable error
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Main API Request helper
 */
export async function apiRequest(
  method: string,
  route: string,
  data?: unknown
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${route}`;

  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (memoryToken) headers["Authorization"] = `Bearer ${memoryToken}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = {};
      if (data) retryHeaders["Content-Type"] = "application/json";
      retryHeaders["Authorization"] = `Bearer ${newToken}`;

      const retryRes = await fetch(url, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });

      await throwIfResNotOk(retryRes);
      return retryRes;
    }
  }

  await throwIfResNotOk(res);
  return res;
}

/**
 * React Query fetcher
 */
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = `${baseUrl}/${queryKey.join("/")}`;

    const headers: Record<string, string> = {};
    if (memoryToken) headers["Authorization"] = `Bearer ${memoryToken}`;

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryRes = await fetch(url, {
          headers: { Authorization: `Bearer ${newToken}` },
          credentials: "include",
        });

        if (on401 === "returnNull" && retryRes.status === 401) {
          return null;
        }

        await throwIfResNotOk(retryRes);
        return await retryRes.json();
      }
    }

    if (on401 === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Query Client
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
