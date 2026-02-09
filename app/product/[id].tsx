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
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [quantity, setQuantity] = useState(1);
  const [currentImage, setCurrentImage] = useState(0);

  const query = useQuery({
    queryKey: ["product", id],
    queryFn: () => apiFetch(`/api/products/${id}`),
  });

  const addToCartMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: id, quantity }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      Alert.alert("Added to Cart", "Item has been added to your cart");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message);
    },
  });

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const product = query.data;
  if (!product) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const images = product.images || [];
  const price = product.discountPrice || product.price;
  const hasDiscount = product.discountPrice && product.discountPrice < product.price;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setCurrentImage(idx);
              }}
            >
              {images.map((img: string, i: number) => (
                <Image
                  key={i}
                  source={{ uri: getImageUrl(img) }}
                  style={styles.image}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_: string, i: number) => (
                  <View
                    key={i}
                    style={[styles.dot, currentImage === i && styles.dotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={48} color={Colors.textLight} />
          </View>
        )}

        <View style={styles.details}>
          <Text style={styles.title}>{product.title}</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.price, hasDiscount && { color: Colors.error }]}>
              ${price.toFixed(2)}
            </Text>
            {hasDiscount && (
              <Text style={styles.oldPrice}>${product.price.toFixed(2)}</Text>
            )}
            {hasDiscount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                </Text>
              </View>
            )}
          </View>

          <View style={styles.stockRow}>
            <Ionicons
              name={product.stock > 0 ? "checkmark-circle" : "close-circle"}
              size={18}
              color={product.stock > 0 ? Colors.success : Colors.error}
            />
            <Text
              style={[styles.stockText, { color: product.stock > 0 ? Colors.success : Colors.error }]}
            >
              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
            </Text>
          </View>

          {product.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descLabel}>Description</Text>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {product.stock > 0 && (
        <View style={styles.footer}>
          <View style={styles.qtySelector}>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Ionicons name="remove" size={20} color={Colors.text} />
            </Pressable>
            <Text style={styles.qtyText}>{quantity}</Text>
            <Pressable
              style={styles.qtyBtn}
              onPress={() => setQuantity(Math.min(product.stock, quantity + 1))}
            >
              <Ionicons name="add" size={20} color={Colors.text} />
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
            onPress={() => addToCartMutation.mutate()}
            disabled={addToCartMutation.isPending}
          >
            {addToCartMutation.isPending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="cart" size={20} color={Colors.white} />
                <Text style={styles.addText}>${(price * quantity).toFixed(2)}</Text>
              </>
            )}
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
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  image: {
    width,
    height: width,
    backgroundColor: Colors.surfaceAlt,
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  details: {
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    lineHeight: 28,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  price: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  oldPrice: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    textDecorationLine: "line-through",
  },
  discountBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.error,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stockText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  descSection: {
    gap: 6,
    marginTop: 4,
  },
  descLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  descText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 16,
    paddingBottom: Platform.OS === "web" ? 34 : 32,
    gap: 14,
    alignItems: "center",
  },
  qtySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    gap: 12,
    paddingHorizontal: 4,
    height: 48,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    minWidth: 20,
    textAlign: "center",
  },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  addText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
});
