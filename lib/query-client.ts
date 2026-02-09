import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "ecom_auth_token";
const REFRESH_TOKEN_KEY = "ecom_refresh_token";
const USER_KEY = "ecom_auth_user";

export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  let url = new URL(`https://${host}`);

  return url.href;
}

async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return null;

      const baseUrl = getApiUrl();
      const url = new URL("/api/auth/refresh", baseUrl);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
        return null;
      }

      const data = await res.json();
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
      if (data.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
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

  const token = await getStoredToken();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = {};
      if (data) retryHeaders["Content-Type"] = "application/json";
      retryHeaders["Authorization"] = `Bearer ${newToken}`;

      const retryRes = await fetch(url.toString(), {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
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

    const token = await getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url.toString(), { headers });

    if (res.status === 401 && token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${newToken}` },
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
