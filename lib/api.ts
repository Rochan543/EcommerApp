import { getApiUrl } from "./query-client";
import { fetch } from "expo/fetch";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "ecom_auth_token";

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const baseUrl = getApiUrl();
  const url = new URL(path, baseUrl);
  const token = await getToken();

  const headers: any = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers,
  });

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

  const headers: any = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: formData as any,
  });

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
