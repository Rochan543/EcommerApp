import React, { useState, useRef } from "react";
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
  Modal,
  PanResponder,
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width, height: screenHeight } = Dimensions.get("window");

function ImageZoomModal({ visible, imageUri, onClose }: { visible: boolean; imageUri: string; onClose: () => void }) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const lastTap = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const now = Date.now();
        if (now - lastTap.current < 300 && evt.nativeEvent.changedTouches.length === 1) {
          if (lastScale.current > 1.1) {
            scale.value = withSpring(1);
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            lastScale.current = 1;
            lastTranslateX.current = 0;
            lastTranslateY.current = 0;
          } else {
            scale.value = withSpring(2.5);
            lastScale.current = 2.5;
          }
        }
        lastTap.current = now;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.changedTouches.length >= 2) {
          const touches = evt.nativeEvent.changedTouches;
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (!panResponder.current.initialDist) {
            panResponder.current.initialDist = dist;
          } else {
            const newScale = Math.max(0.5, Math.min(5, lastScale.current * (dist / panResponder.current.initialDist)));
            scale.value = newScale;
          }
        } else if (lastScale.current > 1) {
          translateX.value = lastTranslateX.current + gestureState.dx;
          translateY.value = lastTranslateY.current + gestureState.dy;
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (panResponder.current.initialDist) {
          lastScale.current = scale.value;
          panResponder.current.initialDist = null;
          if (lastScale.current < 1) {
            scale.value = withSpring(1);
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
            lastScale.current = 1;
            lastTranslateX.current = 0;
            lastTranslateY.current = 0;
          }
        } else {
          lastTranslateX.current = translateX.value;
          lastTranslateY.current = translateY.value;
          if (lastScale.current <= 1 && Math.abs(gestureState.dy) > 100 && Math.abs(gestureState.vy) > 0.3) {
            onClose();
            scale.value = 1;
            translateX.value = 0;
            translateY.value = 0;
            lastScale.current = 1;
            lastTranslateX.current = 0;
            lastTranslateY.current = 0;
          }
        }
      },
    })
  ).current as any;

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={zoomStyles.overlay}>
        <Pressable style={zoomStyles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <View style={zoomStyles.imageWrap} {...panResponder.panHandlers}>
          <Animated.View style={animStyle}>
            <Image
              source={{ uri: imageUri }}
              style={{ width, height: width }}
              contentFit="contain"
            />
          </Animated.View>
        </View>
        <Text style={zoomStyles.hint}>Pinch to zoom, double-tap to toggle, swipe down to close</Text>
      </View>
    </Modal>
  );
}

const zoomStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageWrap: {
    width,
    height: width,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  hint: {
    position: "absolute",
    bottom: 60,
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});

function RecommendedProductCard({ item }: { item: any }) {
  const price = item.price;
  return (
    <Pressable
      style={recStyles.card}
      onPress={() => router.push(`/product/${item.id}`)}
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
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
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
        body: JSON.stringify({ productId: id, quantity, size: selectedSize }),
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
    const hasSizes = product.sizes && (product.sizes as any[]).length > 0;
    if (hasSizes && !selectedSize) {
      Alert.alert("Select Size", "Please select a size before purchasing");
      return;
    }
    const price = product.discountPrice || product.price;
    router.push({
      pathname: "/checkout",
      params: {
        buyNow: "true",
        productId: product.id,
        productTitle: product.title,
        productPrice: price.toString(),
        quantity: quantity.toString(),
        ...(selectedSize ? { size: selectedSize } : {}),
      },
    });
  };

  const handleAddToCart = () => {
    const product = query.data;
    if (!product) return;
    const hasSizes = product.sizes && (product.sizes as any[]).length > 0;
    if (hasSizes && !selectedSize) {
      Alert.alert("Select Size", "Please select a size before adding to cart");
      return;
    }
    addToCartMutation.mutate();
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
  // const recommended = recommendedQuery.data || [];
  const recommended = recommendedQuery.data?.products || [];
  const reviewsList: any[] = reviewsQuery.data || [];
  const avgRating = reviewsList.length > 0
    ? reviewsList.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsList.length
    : 0;
  const userAlreadyReviewed = user ? reviewsList.some((r: any) => r.userId === user.id) : false;
  // const productSizes: { label: string; stock: number }[] = product.sizes || [];
  const productSizes: { label: string; stock: number }[] =
  Array.isArray(product.sizes) ? product.sizes : [];
  const hasSizes = productSizes.length > 0;
  console.log("SIZES FROM API 👉", productSizes);


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
                <Pressable key={i} onPress={() => setZoomImage(getImageUrl(img))}>
                  <Image
                    source={{ uri: getImageUrl(img) }}
                    style={styles.image}
                    contentFit="cover"
                  />
                  <View style={styles.zoomHint}>
                    <Ionicons name="expand-outline" size={18} color="#fff" />
                  </View>
                </Pressable>
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

          {hasSizes && (
            <View style={styles.sizeSection}>
              <Text style={styles.sizeLabel}>Select Size</Text>
              <View style={styles.sizeRow}>
                {productSizes.map((s) => {
                  const isSelected = selectedSize === s.label;
                  const outOfStock = s.stock <= 0;
                  return (
                    <Pressable
                      key={s.label}
                      style={[
                        styles.sizeChip,
                        isSelected && styles.sizeChipActive,
                        outOfStock && styles.sizeChipDisabled,
                      ]}
                      onPress={() => {
                        if (!outOfStock) {
                          setSelectedSize(isSelected ? null : s.label);
                          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                      disabled={outOfStock}
                    >
                      <Text style={[
                        styles.sizeChipText,
                        isSelected && styles.sizeChipTextActive,
                        outOfStock && styles.sizeChipTextDisabled,
                      ]}>
                        {s.label}
                      </Text>
                      {outOfStock && <Text style={styles.sizeOos}>Out of stock</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

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
              keyExtractor={(item) => item.id}
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
            onPress={handleAddToCart}
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

      <ImageZoomModal
        visible={!!zoomImage}
        imageUri={zoomImage || ""}
        onClose={() => setZoomImage(null)}
      />
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
  zoomHint: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    width: 32,
    height: 32,
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
  sizeSection: {
    gap: 10,
  },
  sizeLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  sizeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sizeChip: {
    minWidth: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
  },
  sizeChipActive: {
    borderColor: Colors.primary,
    backgroundColor: "#E8F5E9",
  },
  sizeChipDisabled: {
    opacity: 0.45,
    backgroundColor: Colors.surfaceAlt,
  },
  sizeChipText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  sizeChipTextActive: {
    color: Colors.primary,
  },
  sizeChipTextDisabled: {
    color: Colors.textLight,
  },
  sizeOos: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.error,
    marginTop: 2,
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
