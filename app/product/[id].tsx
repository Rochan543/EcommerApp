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
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

function RecommendedProductCard({ item }: { item: any }) {
  const price = item.price;
  return (
    <Pressable
      style={recStyles.card}
      onPress={() => router.push(`/product/${item._id}`)}
    >
      {item.image ? (
        <Image
          source={{ uri: getImageUrl(item.image) }}
          style={recStyles.image}
          contentFit="cover"
        />
      ) : (
        <View style={[recStyles.image, recStyles.placeholder]}>
          <Ionicons name="image-outline" size={28} color={Colors.textLight} />
        </View>
      )}
      <View style={recStyles.info}>
        <Text style={recStyles.name} numberOfLines={2}>{item.title}</Text>
        <Text style={recStyles.price}>{formatINR(price)}</Text>
        <Pressable
          style={recStyles.viewBtn}
          onPress={() => router.push(`/product/${item._id}`)}
        >
          <Text style={recStyles.viewText}>View Product</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [quantity, setQuantity] = useState(1);
  const [currentImage, setCurrentImage] = useState(0);
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["product", id],
    queryFn: () => apiFetch(`/api/products/${id}`),
  });

  const recommendedQuery = useQuery({
    queryKey: ["recommended", id],
    queryFn: () => apiFetch(`/api/products/recommended/${id}`),
    enabled: !!id,
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

  const handleBuyNow = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    const product = query.data;
    if (!product) return;
    const price = product.discountPrice || product.price;
    router.push({
      pathname: "/checkout",
      params: {
        buyNow: "true",
        productId: product.id,
        productTitle: product.title,
        productPrice: price.toString(),
        quantity: quantity.toString(),
      },
    });
  };

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
  const recommended = recommendedQuery.data || [];

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
            <Text style={[styles.price, hasDiscount && { color: Colors.primary }]}>
              {formatINR(price)}
            </Text>
            {hasDiscount && (
              <Text style={styles.oldPrice}>{formatINR(product.price)}</Text>
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

        {recommendedQuery.isLoading ? (
          <View style={styles.recommendedSection}>
            <Text style={styles.recommendedTitle}>Recommended Products</Text>
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
          </View>
        ) : recommended.length > 0 ? (
          <View style={styles.recommendedSection}>
            <Text style={styles.recommendedTitle}>Recommended Products</Text>
            <FlatList
              data={recommended}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.recommendedList}
              renderItem={({ item }) => <RecommendedProductCard item={item} />}
              scrollEnabled={recommended.length > 0}
            />
          </View>
        ) : null}
      </ScrollView>

      {product.stock > 0 && (
        <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : 28 }]}>
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
                <Text style={styles.addText}>{formatINR(price * quantity)}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.buyNowBtn, pressed && { opacity: 0.9 }]}
            onPress={handleBuyNow}
          >
            <MaterialCommunityIcons name="lightning-bolt" size={20} color={Colors.white} />
            <Text style={styles.buyNowText}>Buy Now</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const recStyles = StyleSheet.create({
  card: {
    width: 150,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  image: {
    width: 150,
    height: 120,
    backgroundColor: Colors.surfaceAlt,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    padding: 10,
    gap: 4,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 18,
  },
  price: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  viewBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
    marginTop: 4,
  },
  viewText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});

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
    paddingBottom: 130,
  },
  image: {
    width,
    height: width * 0.9,
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
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
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
  recommendedSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  recommendedTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 14,
  },
  recommendedList: {
    paddingRight: 20,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    padding: 12,
    gap: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
  },
  qtySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    gap: 8,
    paddingHorizontal: 2,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    minWidth: 16,
    textAlign: "center",
  },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  buyNowBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#E67E22",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  buyNowText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
});
