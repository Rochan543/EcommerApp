import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";

export function getApiUrl(): string {
  let host = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL;

  if (!host) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL is not set");
  }

  let url = new URL(host);

  return url.href;
}

let memoryToken: string | null = null;

export function setQueryToken(t: string | null) {
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

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (memoryToken) headers["Authorization"] = `Bearer ${memoryToken}`;

  const res = await fetch(url.toString(), {
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

      const retryRes = await fetch(url.toString(), {
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

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const headers: Record<string, string> = {};
    if (memoryToken) headers["Authorization"] = `Bearer ${memoryToken}`;

    const res = await fetch(url.toString(), { headers, credentials: "include" });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${newToken}` },
          credentials: "include",
        });

        if (unauthorizedBehavior === "returnNull" && retryRes.status === 401) {
          return null;
        }

        await throwIfResNotOk(retryRes);
        return await retryRes.json();
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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
