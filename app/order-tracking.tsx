import React from "react";
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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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

  const query = useQuery({
    queryKey: ["orders", id],
    queryFn: () => apiFetch(`/api/orders/${id}`),
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
  const currentStepIndex = lastCompletedIndex >= 0 ? trackingSteps.length - 1 - lastCompletedIndex : -1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 67 : insets.top, paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Track Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.orderInfo}>
        <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
        <Text style={styles.orderDate}>
          Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : ""}
        </Text>
      </View>

      <View style={styles.trackingCard}>
        <Text style={styles.trackingTitle}>Delivery Status</Text>

        {trackingSteps.map((step: any, index: number) => {
          const isCompleted = step.completed;
          const isCurrent = index === currentStepIndex;
          const isLast = index === trackingSteps.length - 1;
          const iconData = stepIcons[step.step] || { name: "ellipse-outline", family: "ionicons" };

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
                {isCurrent && isCompleted && step.step !== "Delivered" && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current Status</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Order Details</Text>
        {(order.items as any[]).map((item: any, i: number) => (
          <View key={i} style={styles.itemRow}>
            <Text style={styles.itemText} numberOfLines={1}>{item.quantity}x {item.title}</Text>
            <Text style={styles.itemPrice}>{formatINR(item.price * item.quantity)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{formatINR(order.totalAmount)}</Text>
        </View>
      </View>

      {order.shippingAddress && (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Shipping Address</Text>
          <Text style={styles.addressText}>{(order.shippingAddress as any).fullName}</Text>
          <Text style={styles.addressText}>{(order.shippingAddress as any).addressLine1}</Text>
          {(order.shippingAddress as any).addressLine2 && (
            <Text style={styles.addressText}>{(order.shippingAddress as any).addressLine2}</Text>
          )}
          <Text style={styles.addressText}>
            {(order.shippingAddress as any).city}, {(order.shippingAddress as any).state} {(order.shippingAddress as any).pincode}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  errorText: { fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  orderInfo: { paddingHorizontal: 20, marginBottom: 20 },
  orderId: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  orderDate: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 4 },
  trackingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  trackingTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 20 },
  stepRow: { flexDirection: "row", gap: 16 },
  stepIndicator: { alignItems: "center", width: 32 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.border,
    zIndex: 1,
  },
  stepCircleCompleted: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepCircleCurrent: { borderColor: Colors.primary, backgroundColor: "#F0FDF4" },
  stepConnector: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.border,
    marginTop: -2,
  },
  stepConnectorCompleted: { backgroundColor: Colors.primary },
  stepContent: { flex: 1, paddingTop: 4 },
  stepName: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textLight },
  stepNameCompleted: { color: Colors.text, fontFamily: "Inter_600SemiBold" },
  stepNameCurrent: { color: Colors.primary, fontFamily: "Inter_600SemiBold" },
  stepTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  currentBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  currentBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3B82F6" },
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 8,
  },
  detailsTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginRight: 8 },
  itemPrice: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  totalAmount: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.primary },
  addressText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
});
