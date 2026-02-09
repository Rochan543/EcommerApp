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
  TextInput,
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

function StarRatingInput({ rating, onRate, size = 28 }: { rating: number; onRate: (r: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => onRate(star)}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={star <= rating ? "#F59E0B" : Colors.textLight}
          />
        </Pressable>
      ))}
    </View>
  );
}

function StarRatingDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? "star" : star - 0.5 <= rating ? "star-half" : "star-outline"}
          size={size}
          color={star <= rating ? "#F59E0B" : Colors.textLight}
        />
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: any }) {
  const date = new Date(review.createdAt);
  const timeAgo = getTimeAgo(date);
  return (
    <View style={reviewStyles.card}>
      <View style={reviewStyles.cardHeader}>
        <View style={reviewStyles.avatar}>
          <Text style={reviewStyles.avatarText}>
            {(review.userName || "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={reviewStyles.reviewerName}>{review.userName}</Text>
          <Text style={reviewStyles.reviewDate}>{timeAgo}</Text>
        </View>
        <StarRatingDisplay rating={review.rating} />
      </View>
      {review.comment ? (
        <Text style={reviewStyles.reviewComment}>{review.comment}</Text>
      ) : null}
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [quantity, setQuantity] = useState(1);
  const [currentImage, setCurrentImage] = useState(0);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
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

  const reviewsQuery = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => apiFetch(`/api/products/${id}/reviews`),
    enabled: !!id,
  });

  const submitReviewMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/products/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", id] });
      setReviewRating(0);
      setReviewComment("");
      Alert.alert("Thank you!", "Your review has been submitted");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Could not submit review");
    },
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
  const reviewsList: any[] = reviewsQuery.data || [];
  const avgRating = reviewsList.length > 0
    ? reviewsList.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsList.length
    : 0;
  const userAlreadyReviewed = user ? reviewsList.some((r: any) => r.userId === user.id) : false;

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

        <View style={reviewStyles.section}>
          <View style={reviewStyles.sectionHeader}>
            <Text style={reviewStyles.sectionTitle}>Ratings & Reviews</Text>
            {reviewsList.length > 0 && (
              <View style={reviewStyles.avgRow}>
                <StarRatingDisplay rating={Math.round(avgRating)} size={16} />
                <Text style={reviewStyles.avgText}>
                  {avgRating.toFixed(1)} ({reviewsList.length})
                </Text>
              </View>
            )}
          </View>

          {user && !userAlreadyReviewed ? (
            <View style={reviewStyles.formCard}>
              <Text style={reviewStyles.formLabel}>Rate this product</Text>
              <StarRatingInput rating={reviewRating} onRate={setReviewRating} />
              <TextInput
                style={reviewStyles.commentInput}
                placeholder="Write your review (optional)"
                placeholderTextColor={Colors.textLight}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Pressable
                style={[
                  reviewStyles.submitBtn,
                  reviewRating === 0 && { opacity: 0.5 },
                ]}
                onPress={() => submitReviewMutation.mutate()}
                disabled={reviewRating === 0 || submitReviewMutation.isPending}
              >
                {submitReviewMutation.isPending ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={reviewStyles.submitText}>Submit Review</Text>
                )}
              </Pressable>
            </View>
          ) : user && userAlreadyReviewed ? (
            <View style={reviewStyles.alreadyReviewed}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={reviewStyles.alreadyText}>You have reviewed this product</Text>
            </View>
          ) : (
            <Pressable style={reviewStyles.loginPrompt} onPress={() => router.push("/login")}>
              <Text style={reviewStyles.loginText}>Log in to write a review</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </Pressable>
          )}

          {reviewsQuery.isLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 16 }} />
          ) : reviewsList.length > 0 ? (
            <View style={{ gap: 10, marginTop: 14 }}>
              {reviewsList.map((review: any) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </View>
          ) : (
            <Text style={reviewStyles.noReviews}>No reviews yet. Be the first to review!</Text>
          )}
        </View>
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

const reviewStyles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  avgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  avgText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  commentInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  alreadyReviewed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 10,
  },
  alreadyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.success,
  },
  loginPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  loginText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  noReviews: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    textAlign: "center",
    marginTop: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  reviewerName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    marginTop: 1,
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
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
