import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

const TOKEN_KEY = "ecom_auth_token";
const REFRESH_TOKEN_KEY = "ecom_refresh_token";
const USER_KEY = "ecom_auth_user";

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
      const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);

      if (!storedRefreshToken) {
        await clearAuth();
        return;
      }

      try {
        const baseUrl = getApiUrl();
        const url = new URL("/api/auth/refresh", baseUrl);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        if (res.ok) {
          const data = await res.json();
          await AsyncStorage.setItem(TOKEN_KEY, data.token);
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
          setToken(data.token);
          setUser(data.user);
          return;
        }
      } catch {}

      if (storedToken && storedUser) {
        try {
          const baseUrl = getApiUrl();
          const url = new URL("/api/auth/me", baseUrl);
          const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${storedToken}` },
          });

          if (res.ok) {
            const freshUser = await res.json();
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
            setToken(storedToken);
            setUser(freshUser);
            return;
          }
        } catch {}
      }

      await clearAuth();
    } catch {
      await clearAuth();
    } finally {
      setIsLoading(false);
    }
  }

  async function clearAuth() {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const promise = (async () => {
      try {
        const storedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (!storedRefreshToken) {
          await clearAuth();
          return null;
        }

        const baseUrl = getApiUrl();
        const url = new URL("/api/auth/refresh", baseUrl);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        if (!res.ok) {
          await clearAuth();
          return null;
        }

        const data = await res.json();
        await AsyncStorage.setItem(TOKEN_KEY, data.token);
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.token as string;
      } catch {
        await clearAuth();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = promise;
    return promise;
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = await AsyncStorage.getItem(TOKEN_KEY);
    if (current) return current;
    return refreshAccessToken();
  }, [refreshAccessToken]);

  async function login(email: string, password: string) {
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/login", baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Login failed");
    }

    const data = await res.json();
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
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
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Registration failed");
    }

    const data = await res.json();
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
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
      });
      if (!retryRes.ok) {
        const d = await retryRes.json();
        throw new Error(d.message || "Update failed");
      }
      const updated = await retryRes.json();
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      setUser(updated);
      return;
    }

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.message || "Update failed");
    }

    const updated = await res.json();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
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
      });
      if (!retryRes.ok) {
        const d = await retryRes.json();
        throw new Error(d.message || "Update failed");
      }
      const updated = await retryRes.json();
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      setUser(updated);
      return;
    }

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.message || "Update failed");
    }

    const updated = await res.json();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
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
