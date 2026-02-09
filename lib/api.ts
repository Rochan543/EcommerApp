import { getApiUrl } from "./query-client";
import { fetch } from "expo/fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "ecom_auth_token";
const REFRESH_TOKEN_KEY = "ecom_refresh_token";
const USER_KEY = "ecom_auth_user";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
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

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);
  const token = await getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchOptions = {
    method: options.method || "GET",
    headers,
    body: options.body as string | undefined,
  };

  const res = await fetch(url.toString(), fetchOptions);

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      const retryRes = await fetch(url.toString(), {
        ...fetchOptions,
        headers,
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
  const token = await getToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: formData as any,
  });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryRes = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${newToken}` },
        body: formData as any,
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
