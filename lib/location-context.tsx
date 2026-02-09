import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { Platform, Alert } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./auth-context";

interface LocationData {
  city: string;
  state: string;
  pincode: string;
  country: string;
  latitude: number;
  longitude: number;
  addressLine1: string;
  addressLine2: string;
}

interface LocationContextValue {
  location: LocationData | null;
  isDetecting: boolean;
  permissionAsked: boolean;
  showPermissionPrompt: boolean;
  requestLocationPermission: () => Promise<void>;
  denyLocationPermission: () => void;
  updateManualLocation: (data: Partial<LocationData>) => Promise<void>;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);
const LOCATION_ASKED_KEY = "ecom_location_asked";

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, updateLocation } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.city && user.pincode) {
        setLocation({
          city: user.city || "",
          state: user.state || "",
          pincode: user.pincode || "",
          country: user.country || "India",
          latitude: user.latitude || 0,
          longitude: user.longitude || 0,
          addressLine1: user.addressLine1 || "",
          addressLine2: user.addressLine2 || "",
        });
      }
      checkIfShouldAskPermission();
    } else {
      setLocation(null);
      setShowPermissionPrompt(false);
    }
  }, [user?.id]);

  async function checkIfShouldAskPermission() {
    try {
      const asked = await AsyncStorage.getItem(LOCATION_ASKED_KEY);
      if (asked) {
        setPermissionAsked(true);
        return;
      }
      if (user && (!user.city || !user.pincode)) {
        setShowPermissionPrompt(true);
      }
    } catch {}
  }

  async function reverseGeocode(lat: number, lng: number): Promise<Partial<LocationData>> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "User-Agent": "ShopEase-App/1.0" } }
      );
      const data = await response.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
      const state = addr.state || "";
      const pincode = addr.postcode || "";
      const country = addr.country || "India";
      const road = addr.road || "";
      const neighbourhood = addr.neighbourhood || addr.suburb || "";
      return {
        city,
        state,
        pincode,
        country,
        latitude: lat,
        longitude: lng,
        addressLine1: road,
        addressLine2: neighbourhood,
      };
    } catch {
      return { latitude: lat, longitude: lng };
    }
  }

  async function requestLocationPermission() {
    setIsDetecting(true);
    try {
      if (Platform.OS === "web") {
        await detectWebLocation();
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const geocoded = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          const locData: LocationData = {
            city: geocoded.city || "",
            state: geocoded.state || "",
            pincode: geocoded.pincode || "",
            country: geocoded.country || "India",
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            addressLine1: geocoded.addressLine1 || "",
            addressLine2: geocoded.addressLine2 || "",
          };
          setLocation(locData);
          await updateLocation(locData);
        }
      }
      await AsyncStorage.setItem(LOCATION_ASKED_KEY, "true");
      setPermissionAsked(true);
      setShowPermissionPrompt(false);
    } catch (err: any) {
      console.log("Location error:", err.message);
    } finally {
      setIsDetecting(false);
    }
  }

  async function detectWebLocation() {
    return new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        resolve();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const geocoded = await reverseGeocode(latitude, longitude);
          const locData: LocationData = {
            city: geocoded.city || "",
            state: geocoded.state || "",
            pincode: geocoded.pincode || "",
            country: geocoded.country || "India",
            latitude,
            longitude,
            addressLine1: geocoded.addressLine1 || "",
            addressLine2: geocoded.addressLine2 || "",
          };
          setLocation(locData);
          await updateLocation(locData);
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  function denyLocationPermission() {
    AsyncStorage.setItem(LOCATION_ASKED_KEY, "true");
    setPermissionAsked(true);
    setShowPermissionPrompt(false);
  }

  async function updateManualLocation(data: Partial<LocationData>) {
    const updated = { ...location, ...data } as LocationData;
    setLocation(updated);
    await updateLocation(updated);
  }

  async function refreshLocation() {
    await requestLocationPermission();
  }

  const value = useMemo(
    () => ({
      location,
      isDetecting,
      permissionAsked,
      showPermissionPrompt,
      requestLocationPermission,
      denyLocationPermission,
      updateManualLocation,
      refreshLocation,
    }),
    [location, isDetecting, permissionAsked, showPermissionPrompt]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within LocationProvider");
  return context;
}
