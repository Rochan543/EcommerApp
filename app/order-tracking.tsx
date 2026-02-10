import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Pressable,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

const stepIcons: Record<string, { name: string; family: "ionicons" | "mci" }> = {
  Ordered: { name: "receipt-outline", family: "ionicons" },
  Packed: { name: "cube-outline", family: "ionicons" },
  Shipped: { name: "airplane-outline", family: "ionicons" },
  "Out for Delivery": { name: "bicycle-outline", family: "ionicons" },
  Delivered: { name: "checkmark-circle-outline", family: "ionicons" },
};

export default function OrderTrackingScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  /* ✅ ADDED */
  const [filter, setFilter] = useState("all");

  const query = useQuery({
    queryKey: ["orders", id, filter], // ✅ added filter
    queryFn: () => apiFetch(`/api/orders/${id}?filter=${filter}`),
    enabled: !!id,
  });

  const order = query.data;
  const trackingSteps = order?.trackingSteps || [];

  if (query.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const lastCompletedIndex = [...trackingSteps].reverse().findIndex((s: any) => s.completed);
  const currentStepIndex =
    lastCompletedIndex >= 0 ? trackingSteps.length - 1 - lastCompletedIndex : -1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Platform.OS === "web" ? 90 : insets.top + 20,   // ✅ moved slightly down
        paddingBottom: 40,
      }}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Track Order</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ✅ FILTER BAR ADDED */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {[
          { label: "All", value: "all" },
          { label: "Today", value: "today" },
          { label: "Yesterday", value: "yesterday" },
          { label: "30 Days", value: "last30" },
          { label: "60 Days", value: "last60" },
        ].map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[
              styles.filterChip,
              filter === f.value && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === f.value && styles.filterTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ORDER INFO */}
      <View style={styles.orderInfo}>
        <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
        <Text style={styles.orderDate}>
          Placed on{" "}
          {order.createdAt
            ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : ""}
        </Text>
      </View>

      {/* TRACKING CARD */}
      <View style={styles.trackingCard}>
        <Text style={styles.trackingTitle}>Delivery Status</Text>

        {trackingSteps.map((step: any, index: number) => {
          const isCompleted = step.completed;
          const isCurrent = index === currentStepIndex;
          const isLast = index === trackingSteps.length - 1;
          const iconData =
            stepIcons[step.step] || { name: "ellipse-outline", family: "ionicons" };

          return (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepIndicator}>
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                    isCurrent && !isCompleted && styles.stepCircleCurrent,
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={16} color={Colors.white} />
                  ) : (
                    <Ionicons
                      name={iconData.name as any}
                      size={16}
                      color={isCurrent ? Colors.primary : Colors.textLight}
                    />
                  )}
                </View>

                {!isLast && (
                  <View
                    style={[
                      styles.stepConnector,
                      isCompleted && styles.stepConnectorCompleted,
                    ]}
                  />
                )}
              </View>

              <View style={[styles.stepContent, !isLast && { paddingBottom: 28 }]}>
                <Text
                  style={[
                    styles.stepName,
                    isCompleted && styles.stepNameCompleted,
                    isCurrent && styles.stepNameCurrent,
                  ]}
                >
                  {step.step}
                </Text>

                {step.completedAt && (
                  <Text style={styles.stepTime}>
                    {new Date(step.completedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* DETAILS */}
      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Order Details</Text>

        {(order.items as any[]).map((item: any, i: number) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemText}>
              {item.quantity}x {item.title}
            </Text>
            <Text style={styles.itemPrice}>
              {formatINR(item.price * item.quantity)}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatINR(order.totalAmount)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: Colors.textSecondary },

  header: {
  flexDirection: "row",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  marginBottom: 14,
  marginTop: 12,   // ✅ adds space from top
},

  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "600" },

  /* ✅ FILTER */
  filterRow: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 6,    // ✅ space between header & chips
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    color: Colors.text,
  },
  filterTextActive: {
    color: Colors.white,
    fontWeight: "600",
  },

  orderInfo: {
  paddingHorizontal: 20,
  marginBottom: 24,
  marginTop: 6,   // ✅ extra breathing space
},

  orderId: { fontSize: 20, fontWeight: "700" },
  orderDate: { fontSize: 13, color: Colors.textSecondary },

  trackingCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
  },

  trackingTitle: { fontSize: 16, marginBottom: 20 },

  stepRow: { flexDirection: "row", gap: 16 },
  stepIndicator: { alignItems: "center", width: 32 },

  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleCompleted: { backgroundColor: Colors.primary },
  stepCircleCurrent: { borderColor: Colors.primary },

  stepConnector: { width: 2, flex: 1, backgroundColor: Colors.border },
  stepConnectorCompleted: { backgroundColor: Colors.primary },

  stepContent: { flex: 1 },
  stepName: { color: Colors.textLight },
  stepNameCompleted: { color: Colors.text },
  stepNameCurrent: { color: Colors.primary },
  stepTime: {
  fontSize: 12,
  color: Colors.textSecondary,
},


  detailsCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
  },

  detailsTitle: { fontSize: 16, marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between" },
  itemText: { color: Colors.textSecondary },
  itemPrice: { fontWeight: "600" },

  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: 10,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: { fontSize: 15 },
  totalAmount: { fontSize: 18, color: Colors.primary },
});
