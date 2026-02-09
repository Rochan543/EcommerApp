import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  ScrollView,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { apiFetch, getImageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const bannersQuery = useQuery({
    queryKey: ["banners"],
    queryFn: () => apiFetch("/api/banners"),
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/api/categories"),
  });

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => apiFetch("/api/products"),
  });

  const announcementsQuery = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => apiFetch("/api/announcements/active"),
    enabled: !!user,
  });

  const [showAnnPopup, setShowAnnPopup] = useState(false);
  const [currentAnnIndex, setCurrentAnnIndex] = useState(0);
  const unviewedAnns: any[] = announcementsQuery.data || [];

  const markViewedMutation = useMutation({
    mutationFn: (announcementId: string) =>
      apiFetch("/api/announcements/viewed", {
        method: "POST",
        body: JSON.stringify({ announcementId }),
      }),
  });

  useEffect(() => {
    if (unviewedAnns.length > 0 && !showAnnPopup) {
      setCurrentAnnIndex(0);
      setShowAnnPopup(true);
    }
  }, [unviewedAnns.length]);

  function handleCloseAnn() {
    const current = unviewedAnns[currentAnnIndex];
    if (current) {
      markViewedMutation.mutate(current.id);
    }
    if (currentAnnIndex < unviewedAnns.length - 1) {
      setCurrentAnnIndex(currentAnnIndex + 1);
    } else {
      setShowAnnPopup(false);
    }
  }

  const isLoading = bannersQuery.isLoading || categoriesQuery.isLoading || productsQuery.isLoading;

  const onRefresh = useCallback(() => {
    bannersQuery.refetch();
    categoriesQuery.refetch();
    productsQuery.refetch();
  }, []);

  const banners = bannersQuery.data || [];
  const categories = categoriesQuery.data || [];
  const products = productsQuery.data || [];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 67 : insets.top, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || "there"}</Text>
          <Text style={styles.headerSubtitle}>Find something you love</Text>
        </View>
      </View>

      {banners.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bannerList}
          pagingEnabled={false}
          decelerationRate="fast"
          snapToInterval={width - 32}
        >
          {banners.map((banner: any) => (
            <Pressable key={banner.id} style={styles.bannerCard}>
              {banner.image ? (
                <Image
                  source={{ uri: getImageUrl(banner.image) }}
                  style={styles.bannerImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.bannerImage, styles.bannerPlaceholder]}>
                  <Ionicons name="megaphone-outline" size={32} color={Colors.white} />
                </View>
              )}
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {categories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Pressable onPress={() => router.push("/(customer)/categories")}>
              <Text style={styles.seeAll}>See All</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            {categories.slice(0, 8).map((cat: any) => (
              <Pressable
                key={cat.id}
                style={styles.categoryCard}
                onPress={() => router.push({ pathname: "/category/[id]", params: { id: cat.id, name: cat.name } })}
              >
                {cat.image ? (
                  <View style={styles.categoryImageWrap}>
                    <Image source={{ uri: getImageUrl(cat.image) }} style={styles.categoryImage} contentFit="cover" />
                  </View>
                ) : (
                  <View style={[styles.categoryImageWrap, styles.categoryPlaceholder]}>
                    <Ionicons name="folder-outline" size={24} color={Colors.primary} />
                  </View>
                )}
                <Text style={styles.categoryName} numberOfLines={1}>
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
        </View>
        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No products available yet</Text>
          </View>
        ) : (
          <View style={styles.productGrid}>
            {products.slice(0, 6).map((product: any) => (
              <Pressable
                key={product.id}
                style={({ pressed }) => [styles.productCard, pressed && { transform: [{ scale: 0.97 }] }]}
                onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
              >
                {(product.images?.length > 0) ? (
                  <Image
                    source={{ uri: getImageUrl(product.images[0]) }}
                    style={styles.productImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.productImage, styles.productPlaceholder]}>
                    <Ionicons name="image-outline" size={32} color={Colors.textLight} />
                  </View>
                )}
                {product.discountPrice && product.discountPrice < product.price && (
                  <View style={styles.discountTag}>
                    <Text style={styles.discountTagText}>
                      {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                    </Text>
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                  <View style={styles.priceRow}>
                    {product.discountPrice ? (
                      <>
                        <Text style={styles.discountPrice}>{formatINR(product.discountPrice)}</Text>
                        <Text style={styles.originalPrice}>{formatINR(product.price)}</Text>
                      </>
                    ) : (
                      <Text style={styles.productPrice}>{formatINR(product.price)}</Text>
                    )}
                  </View>
                </View>
                <Pressable
                  style={styles.quickAddBtn}
                  onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
                >
                  <Ionicons name="add" size={18} color={Colors.white} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {showAnnPopup && unviewedAnns.length > 0 && unviewedAnns[currentAnnIndex] && (
        <Modal visible={showAnnPopup} transparent animationType="none" statusBarTranslucent>
          <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.annOverlay}>
            <Animated.View entering={SlideInDown.duration(400).springify()} exiting={SlideOutDown.duration(300)} style={styles.annPopup}>
              <Pressable style={styles.annCloseBtn} onPress={handleCloseAnn}>
                <Ionicons name="close" size={22} color={Colors.white} />
              </Pressable>
              {unviewedAnns[currentAnnIndex].image ? (
                <Image
                  source={{ uri: getImageUrl(unviewedAnns[currentAnnIndex].image) }}
                  style={styles.annPopupImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.annPopupImagePlaceholder}>
                  <View style={styles.annPopupIconWrap}>
                    <Ionicons name="notifications" size={48} color={Colors.white} />
                  </View>
                </View>
              )}
              <View style={styles.annPopupContent}>
                <Text style={styles.annPopupTitle}>{unviewedAnns[currentAnnIndex].title}</Text>
                {unviewedAnns[currentAnnIndex].message ? (
                  <ScrollView style={styles.annPopupMsgScroll} showsVerticalScrollIndicator={false}>
                    <Text style={styles.annPopupMessage}>{unviewedAnns[currentAnnIndex].message}</Text>
                  </ScrollView>
                ) : null}
                {unviewedAnns.length > 1 && (
                  <View style={styles.annDots}>
                    {unviewedAnns.map((_: any, i: number) => (
                      <View key={i} style={[styles.annDot, i === currentAnnIndex && styles.annDotActive]} />
                    ))}
                  </View>
                )}
                <Pressable style={styles.annGotItBtn} onPress={handleCloseAnn}>
                  <Text style={styles.annGotItText}>
                    {currentAnnIndex < unviewedAnns.length - 1 ? "Next" : "Got it"}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </ScrollView>
  );
}

const cardWidth = (width - 48 - 12) / 2;

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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bannerList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  bannerCard: {
    width: width - 40,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.primaryLight,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
  },
  bannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  bannerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  section: {
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  categoryList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  categoryCard: {
    alignItems: "center",
    width: 76,
  },
  categoryImageWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8F5E9",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  categoryImage: {
    width: "100%",
    height: "100%",
  },
  categoryPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    marginTop: 6,
    textAlign: "center",
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 12,
  },
  productCard: {
    width: cardWidth,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  productImage: {
    width: "100%",
    height: cardWidth * 1.05,
    backgroundColor: Colors.surfaceAlt,
  },
  productPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  discountTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountTagText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  productInfo: {
    padding: 10,
    paddingBottom: 12,
    gap: 4,
  },
  productTitle: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  productPrice: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  discountPrice: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    textDecorationLine: "line-through",
  },
  quickAddBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  annOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  annPopup: {
    width: Math.min(width - 48, 380),
    maxHeight: height * 0.78,
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  annCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  annPopupImage: {
    width: "100%",
    height: 200,
  },
  annPopupImagePlaceholder: {
    width: "100%",
    height: 160,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  annPopupIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  annPopupContent: {
    padding: 20,
    gap: 12,
  },
  annPopupTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  annPopupMsgScroll: {
    maxHeight: 120,
  },
  annPopupMessage: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: "center",
  },
  annDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  annDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
  },
  annDotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  annGotItBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  annGotItText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
