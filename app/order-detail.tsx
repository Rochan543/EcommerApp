import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export default function OrderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  const query = useQuery({
    queryKey: ["orders", id],
    queryFn: () => apiFetch(`/api/orders/${id}`),
    enabled: !!id,
  });

  const order = query.data;

  if (query.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Order Details", headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Stack.Screen options={{ title: "Order Details", headerShown: true }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </>
    );
  }

  const items = (order.items as any[]) || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  const deliveryCharge = subtotal < 500 ? 40 : 0;
  const grandTotal = subtotal + deliveryCharge;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Order Details",
          headerShown: true,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20,
          paddingTop: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.orderHeaderRow}>
            <View>
              <Text style={styles.orderId}>Order #{(order.id as string).slice(0, 8)}</Text>
              <Text style={styles.orderDate}>
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : ""}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColors[order.status] || Colors.textSecondary },
              ]}
            >
              <Text style={styles.statusText}>{order.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {items.map((item: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} x {formatINR(item.price)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatINR(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>{formatINR(subtotal)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Charge</Text>
            <Text style={[styles.priceValue, deliveryCharge === 0 && styles.freeText]}>
              {deliveryCharge === 0 ? "FREE" : formatINR(deliveryCharge)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>{formatINR(grandTotal)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Method</Text>
            <Text style={styles.infoValue}>
              {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View
              style={[
                styles.paymentBadge,
                {
                  backgroundColor:
                    order.paymentStatus === "paid" ? "#DCFCE7" : "#FEF3C7",
                },
              ]}
            >
              <Text
                style={[
                  styles.paymentBadgeText,
                  {
                    color:
                      order.paymentStatus === "paid" ? "#16A34A" : "#D97706",
                  },
                ]}
              >
                {order.paymentStatus || "pending"}
              </Text>
            </View>
          </View>
        </View>

        {order.shippingAddress && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipping Address</Text>
            <Text style={styles.addressText}>
              {(order.shippingAddress as any).fullName}
            </Text>
            <Text style={styles.addressText}>
              {(order.shippingAddress as any).addressLine1}
            </Text>
            {(order.shippingAddress as any).addressLine2 && (
              <Text style={styles.addressText}>
                {(order.shippingAddress as any).addressLine2}
              </Text>
            )}
            <Text style={styles.addressText}>
              {(order.shippingAddress as any).city},{" "}
              {(order.shippingAddress as any).state}{" "}
              {(order.shippingAddress as any).pincode}
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderId: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  orderDate: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
    textTransform: "capitalize" as const,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  itemMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  priceLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  freeText: {
    color: Colors.primary,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  grandTotalValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  paymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize" as const,
  },
  addressText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
