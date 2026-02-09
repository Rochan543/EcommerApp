import React from "react";
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
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  const statsQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiFetch("/api/admin/dashboard"),
  });

  const stats = statsQuery.data || { totalUsers: 0, totalProducts: 0, totalOrders: 0, totalRevenue: 0 };

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: "people" as const, color: "#3B82F6", bg: "#EFF6FF" },
    { label: "Products", value: stats.totalProducts, icon: "cube" as const, color: "#8B5CF6", bg: "#F5F3FF" },
    { label: "Orders", value: stats.totalOrders, icon: "receipt" as const, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Revenue", value: formatINR(stats.totalRevenue), icon: "cash" as const, color: "#16A34A", bg: "#F0FDF4" },
  ];

  async function handleLogout() {
    await logout();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 67 : insets.top + 8, paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={() => statsQuery.refetch()} tintColor={Colors.primary} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
        </Pressable>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
  },
  cardsRow: {
    gap: 12,
    paddingRight: 20,
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
});
