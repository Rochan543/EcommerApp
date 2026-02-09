import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const [paymentMethod, setPaymentMethod] = useState("cod");

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiFetch("/api/cart"),
  });

  const items = cartQuery.data || [];
  const total = items.reduce((sum: number, item: any) => {
    const price = item.product?.discountPrice || item.product?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  const orderMutation = useMutation({
    mutationFn: () => {
      const orderItems = items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product?.discountPrice || item.product?.price || 0,
        title: item.product?.title || "Product",
      }));
      return apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: orderItems,
          totalAmount: total,
          paymentMethod,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Order Placed", "Your order has been placed successfully!", [
        { text: "OK", onPress: () => router.replace("/(customer)/orders") },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message);
    },
  });

  if (cartQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const paymentMethods = [
    { id: "cod", label: "Cash on Delivery", icon: "cash-outline" as const },
    { id: "card", label: "Credit/Debit Card", icon: "card-outline" as const },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {items.map((item: any) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.quantity}x {item.product?.title}
              </Text>
              <Text style={styles.itemPrice}>
                ${((item.product?.discountPrice || item.product?.price || 0) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {paymentMethods.map((method) => (
            <Pressable
              key={method.id}
              style={[styles.paymentOption, paymentMethod === method.id && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <Ionicons
                name={method.icon}
                size={22}
                color={paymentMethod === method.id ? Colors.primary : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.paymentLabel,
                  paymentMethod === method.id && styles.paymentLabelActive,
                ]}
              >
                {method.label}
              </Text>
              <Ionicons
                name={paymentMethod === method.id ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={paymentMethod === method.id ? Colors.primary : Colors.textLight}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.placeOrderBtn, pressed && { opacity: 0.9 }]}
          onPress={() => orderMutation.mutate()}
          disabled={orderMutation.isPending}
        >
          {orderMutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.placeOrderText}>Place Order - ${total.toFixed(2)}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  paymentLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  paymentLabelActive: {
    color: Colors.text,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 20,
  },
  placeOrderBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  placeOrderText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
});
