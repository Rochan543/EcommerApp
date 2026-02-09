import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

const statusColors: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  processing: "#8B5CF6",
  shipped: "#8B5CF6",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiFetch("/api/orders"),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const orders = query.data || [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Text style={styles.title}>My Orders</Text>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => query.refetch()} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bag-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>Your order history will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const trackingSteps = item.trackingSteps || [];
            const completedSteps = trackingSteps.filter((s: any) => s.completed).length;
            const totalSteps = trackingSteps.length;
            const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

            return (
              <Pressable
                style={styles.orderCard}
                onPress={() => router.push(`/order-detail?id=${item.id}` as any)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>Order #{item.id.slice(0, 8)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || Colors.textSecondary }]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <View style={styles.orderItems}>
                  {(item.items as any[]).slice(0, 2).map((prod: any, i: number) => (
                    <Text key={i} style={styles.orderItemText} numberOfLines={1}>
                      {prod.quantity}x {prod.title}{prod.size ? ` (${prod.size})` : ""}
                    </Text>
                  ))}
                  {(item.items as any[]).length > 2 && (
                    <Text style={styles.moreItemsText}>+{(item.items as any[]).length - 2} more items</Text>
                  )}
                </View>

                {totalSteps > 0 && item.status !== "cancelled" && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {completedSteps === totalSteps
                        ? "Delivered"
                        : trackingSteps.find((s: any, idx: number) => !s.completed)?.step || "Processing"}
                    </Text>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <Text style={styles.orderDate}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                  </Text>
                  <View style={styles.footerRight}>
                    <Text style={styles.orderTotal}>{formatINR(item.totalAmount)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
                  </View>
                </View>

                {item.status !== "cancelled" && item.status !== "delivered" && (
                  <Pressable
                    style={styles.trackBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/order-tracking?id=${item.id}` as any);
                    }}
                  >
                    <Ionicons name="location-outline" size={16} color={Colors.white} />
                    <Text style={styles.trackBtnText}>Track</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 12,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
    textTransform: "capitalize" as const,
  },
  orderItems: {
    gap: 4,
  },
  orderItemText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  moreItemsText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textLight,
  },
  progressSection: {
    gap: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
  },
  orderDate: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  orderTotal: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
  },
  trackBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
