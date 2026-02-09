import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Share,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

type FilterType = "all" | "today" | "yesterday" | "last30";

interface TrackerOrder {
  id: string;
  userName: string;
  userPhone: string;
  productNames: string;
  paymentType: string;
  totalAmount: number;
  deliveryAddress: string;
  status: string;
  createdAt: string;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last30", label: "Last 30 Days" },
];

function statusColor(status: string) {
  switch (status) {
    case "delivered": return "#16A34A";
    case "shipped": return "#3B82F6";
    case "processing": return "#F59E0B";
    case "confirmed": return "#8B5CF6";
    case "cancelled": return "#DC2626";
    default: return "#6B7280";
  }
}

export default function AdminOrderTracker() {
  const [filter, setFilter] = useState<FilterType>("all");

  const ordersQuery = useQuery<TrackerOrder[]>({
    queryKey: ["admin", "orders-tracker", filter],
    queryFn: () =>
      apiFetch(`/api/admin/orders-tracker${filter !== "all" ? `?filter=${filter}` : ""}`),
  });

  const orders = ordersQuery.data || [];

  const generateCSV = useCallback(async () => {
    if (orders.length === 0) {
      Alert.alert("No Data", "There are no orders to export.");
      return;
    }

    const headers = [
      "Order ID",
      "User Name",
      "Phone",
      "Products",
      "Payment Type",
      "Total Amount",
      "Delivery Address",
      "Status",
      "Order Date",
    ];

    const rows = orders.map((o) => [
      o.id,
      o.userName,
      o.userPhone,
      `"${(o.productNames || "").replace(/"/g, '""')}"`,
      o.paymentType,
      o.totalAmount.toString(),
      `"${(o.deliveryAddress || "").replace(/"/g, '""')}"`,
      o.status,
      o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orders_${filter}_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      try {
        await Share.share({ message: csvContent, title: "Orders Export" });
      } catch (err) {
        Alert.alert("Error", "Failed to export CSV");
      }
    }
  }, [orders, filter]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Order Tracker",
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      />

      <View style={{ paddingTop: Platform.OS === "web" ? 0 : 0 }}>
        <View style={styles.topBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.8 }]}
            onPress={generateCSV}
          >
            <Ionicons name="download-outline" size={16} color={Colors.white} />
            <Text style={styles.exportText}>Export CSV</Text>
          </Pressable>
        </View>

        <Text style={styles.countText}>
          {ordersQuery.isLoading ? "Loading..." : `${orders.length} order${orders.length !== 1 ? "s" : ""}`}
        </Text>
      </View>

      {ordersQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="receipt-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>No orders found for this filter</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + "18" }]}>
                  <Text style={[styles.statusText, { color: statusColor(order.status) }]}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardRow}>
                <Ionicons name="person-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.cardLabel}>Customer</Text>
                <Text style={styles.cardValue}>{order.userName}</Text>
              </View>
              <View style={styles.cardRow}>
                <Ionicons name="call-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.cardLabel}>Phone</Text>
                <Text style={styles.cardValue}>{order.userPhone}</Text>
              </View>
              <View style={styles.cardRow}>
                <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.cardLabel}>Products</Text>
                <Text style={styles.cardValue} numberOfLines={2}>{order.productNames || "-"}</Text>
              </View>
              <View style={styles.cardRow}>
                <Ionicons name="card-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.cardLabel}>Payment</Text>
                <View style={[styles.payBadge, order.paymentType === "Paid" ? styles.payBadgePaid : styles.payBadgeCod]}>
                  <Text style={[styles.payBadgeText, order.paymentType === "Paid" ? styles.payTextPaid : styles.payTextCod]}>
                    {order.paymentType}
                  </Text>
                </View>
              </View>
              <View style={styles.cardRow}>
                <Ionicons name="cash-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.cardLabel}>Amount</Text>
                <Text style={[styles.cardValue, { fontFamily: "Inter_700Bold", color: Colors.primary }]}>
                  {formatINR(order.totalAmount)}
                </Text>
              </View>
              {order.deliveryAddress && order.deliveryAddress !== "-" && (
                <View style={styles.cardRow}>
                  <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.cardLabel}>Address</Text>
                  <Text style={styles.cardValue} numberOfLines={2}>{order.deliveryAddress}</Text>
                </View>
              )}
              <View style={styles.cardRow}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.cardLabel}>Date</Text>
                <Text style={styles.cardValue}>
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric"
                  }) : "-"}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  filtersRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  exportText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  orderId: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    width: 70,
  },
  cardValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    textAlign: "right",
  },
  payBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto",
  },
  payBadgePaid: {
    backgroundColor: "#DCFCE7",
  },
  payBadgeCod: {
    backgroundColor: "#FEF3C7",
  },
  payBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  payTextPaid: {
    color: "#16A34A",
  },
  payTextCod: {
    color: "#D97706",
  },
});
