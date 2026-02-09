import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const statsQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiFetch("/api/admin/dashboard"),
  });

  const stats = statsQuery.data || {
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
  };

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: "people" as const, color: "#3B82F6", bg: "#EFF6FF" },
    { label: "Products", value: stats.totalProducts, icon: "cube" as const, color: "#8B5CF6", bg: "#F5F3FF" },
    { label: "Orders", value: stats.totalOrders, icon: "receipt" as const, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Revenue", value: formatINR(stats.totalRevenue), icon: "cash" as const, color: "#16A34A", bg: "#F0FDF4" },
  ];

  const dateStr = clock.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = clock.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Platform.OS === "web" ? 67 : insets.top + 8,
        paddingBottom: 120,
      }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => statsQuery.refetch()}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hey {user?.name || "Admin"} 👋</Text>
          <Text style={styles.welcomeText}>Welcome</Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        </Pressable>
      </View>

      <View style={styles.clockCard}>
        <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
        <Text style={styles.dateText}>{dateStr}</Text>
        <View style={styles.timeBadge}>
          <Ionicons name="time-outline" size={14} color={Colors.white} />
          <Text style={styles.timeText}>{timeStr}</Text>
        </View>
      </View>

      {statsQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
          decelerationRate="fast"
        >
          {cards.map((card) => (
            <View key={card.label} style={[styles.statCard, { backgroundColor: card.bg }]}>
              <View style={[styles.iconCircle, { backgroundColor: card.color }]}>
                <Ionicons name={card.icon} size={20} color={Colors.white} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Pressable
        style={({ pressed }) => [styles.trackerButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        onPress={() => router.push("/admin-order-tracker")}
      >
        <View style={styles.trackerIconWrap}>
          <Ionicons name="locate-outline" size={24} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.trackerTitle}>Order Tracker</Text>
          <Text style={styles.trackerSubtitle}>View, filter & export all orders</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={Colors.textSecondary} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  welcomeText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
  },
  clockCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dateText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  cardsRow: {
    gap: 12,
    paddingRight: 20,
    marginBottom: 24,
  },
  statCard: {
    width: 150,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  trackerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  trackerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  trackerTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  trackerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
