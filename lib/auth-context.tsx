import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
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
}

interface AuthContextValue {
  user: UserData | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name: string; phone: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ecom_auth_token";
const USER_KEY = "ecom_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }

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
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  async function updateProfile(data: { name: string; phone: string }) {
    if (!token) return;
    const baseUrl = getApiUrl();
    const url = new URL("/api/auth/profile", baseUrl);
    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.message || "Update failed");
    }

    const updated = await res.json();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
    setUser(updated);
  }

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout, updateProfile }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
