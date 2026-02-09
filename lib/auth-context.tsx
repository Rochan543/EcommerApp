import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from "react";
import { getApiUrl } from "./query-client";
import { fetch } from "expo/fetch";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  profileImage?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  addressLine1?: string;
  addressLine2?: string;
}

interface AuthContextValue {
  user: UserData | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name: string; phone: string }) => Promise<void>;
  updateLocation: (data: Partial<Pick<UserData, "city" | "state" | "pincode" | "country" | "latitude" | "longitude" | "addressLine1" | "addressLine2">>) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const baseUrl = getApiUrl();

      const refreshUrl = new URL("/api/auth/refresh", baseUrl);
      const refreshRes = await fetch(refreshUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setToken(data.token);
        setUser(data.user);
        return;
      }

      const meUrl = new URL("/api/auth/me", baseUrl);
      const meRes = await fetch(meUrl.toString(), {
        credentials: "include",
      });

      if (meRes.ok) {
        const freshUser = await meRes.json();
        setUser(freshUser);
        return;
      }

      setToken(null);
      setUser(null);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearAuth() {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/auth/logout", baseUrl);
      await fetch(url.toString(), { method: "POST", credentials: "include" });
    } catch {}
    setToken(null);
    setUser(null);
  }

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
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
          setToken(null);
          setUser(null);
          return null;
        }

        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        return data.token as string;
      } catch {
        setToken(null);
        setUser(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (token) return token;
    return refreshAccessToken();
  }, [token, refreshAccessToken]);

  async function login(email: string, password: string) {
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/login", baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string, phone?: string) {
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/register", baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, phone: phone || "" }),
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Registration failed");
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
  }

  async function logout() {
    await clearAuth();
  }

  async function updateProfile(data: { name: string; phone: string }) {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/profile", baseUrl);
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) throw new Error("Session expired. Please log in again.");
      const retryRes = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!retryRes.ok) {
        const d = await retryRes.json();
        throw new Error(d.message || "Update failed");
      }
      const updated = await retryRes.json();
      setUser(updated);
      return;
    }

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.message || "Update failed");
    }

    const updated = await res.json();
    setUser(updated);
  }

  async function updateLocation(data: Partial<Pick<UserData, "city" | "state" | "pincode" | "country" | "latitude" | "longitude" | "addressLine1" | "addressLine2">>) {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("Not authenticated");
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/location", baseUrl);
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
      credentials: "include",
    });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) throw new Error("Session expired. Please log in again.");
      const retryRes = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!retryRes.ok) {
        const d = await retryRes.json();
        throw new Error(d.message || "Update failed");
      }
      const updated = await retryRes.json();
      setUser(updated);
      return;
    }

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.message || "Update failed");
    }

    const updated = await res.json();
    setUser(updated);
  }

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout, updateProfile, updateLocation, getAccessToken }),
    [user, token, isLoading, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
