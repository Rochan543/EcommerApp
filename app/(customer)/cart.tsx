import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

export default function CartScreen() {
  const insets = useSafeAreaInsets();

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiFetch("/api/cart"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      apiFetch(`/api/cart/${id}`, { method: "PUT", body: JSON.stringify({ quantity }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/cart/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const items = cartQuery.data || [];
  const total = items.reduce((sum: number, item: any) => {
    const price = item.product?.discountPrice || item.product?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  function handleCheckout() {
    if (items.length === 0) {
      Alert.alert("Cart Empty", "Add some products to your cart first");
      return;
    }
    router.push("/checkout");
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Text style={styles.title}>Cart</Text>
        <Text style={styles.itemCount}>{items.length} items</Text>
      </View>

      {cartQuery.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={56} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptyText}>Browse products and add items to your cart</Text>
            </View>
          }
          renderItem={({ item }) => {
            const product = item.product;
            if (!product) return null;
            const price = product.discountPrice || product.price;
            return (
              <View style={styles.cartItem}>
                {product.images?.length > 0 ? (
                  <Image
                    source={{ uri: getImageUrl(product.images[0]) }}
                    style={styles.itemImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.itemImage, styles.itemPlaceholder]}>
                    <Ionicons name="image-outline" size={24} color={Colors.textLight} />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{product.title}</Text>
                  {item.size && (
                    <View style={styles.sizeBadge}>
                      <Text style={styles.sizeBadgeText}>Size: {item.size}</Text>
                    </View>
                  )}
                  <Text style={styles.itemPrice}>{formatINR(price * item.quantity)}</Text>
                  <View style={styles.qtyRow}>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => {
                        if (item.quantity <= 1) {
                          removeMutation.mutate(item.id);
                        } else {
                          updateMutation.mutate({ id: item.id, quantity: item.quantity - 1 });
                        }
                      }}
                    >
                      <Ionicons name="remove" size={18} color={Colors.text} />
                    </Pressable>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => updateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    >
                      <Ionicons name="add" size={18} color={Colors.text} />
                    </Pressable>
                  </View>
                </View>
                <Pressable onPress={() => removeMutation.mutate(item.id)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {items.length > 0 && (
        <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 12 }]}>
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatINR(total)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.checkoutBtn, pressed && { opacity: 0.9 }]}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>Checkout</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </Pressable>
        </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  itemCount: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 200,
    gap: 10,
  },
  cartItem: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
  },
  itemPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  sizeBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  sizeBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  qtyText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  removeBtn: {
    justifyContent: "center",
    padding: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  checkoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
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
});
