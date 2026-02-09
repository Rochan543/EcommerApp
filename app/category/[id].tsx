import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const cardWidth = (width - 48 - 12) / 2;

export default function CategoryProductsScreen() {
  const { id, name } = useLocalSearchParams();

  const query = useQuery({
    queryKey: ["products", "category", id],
    queryFn: () => apiFetch(`/api/products/category/${id}`),
  });

  const products = query.data || [];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerTitle: (name as string) || "Products" }} />

      {query.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bag-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No products in this category</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
            >
              {item.images?.length > 0 ? (
                <Image
                  source={{ uri: getImageUrl(item.images[0]) }}
                  style={styles.image}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Ionicons name="image-outline" size={32} color={Colors.textLight} />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
                <View style={styles.priceRow}>
                  {item.discountPrice ? (
                    <>
                      <Text style={styles.discountPrice}>${item.discountPrice.toFixed(2)}</Text>
                      <Text style={styles.oldPrice}>${item.price.toFixed(2)}</Text>
                    </>
                  ) : (
                    <Text style={styles.price}>${item.price.toFixed(2)}</Text>
                  )}
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  row: {
    gap: 12,
  },
  card: {
    width: cardWidth,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  image: {
    width: "100%",
    height: cardWidth,
    backgroundColor: Colors.surfaceAlt,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    padding: 10,
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  discountPrice: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.error,
  },
  oldPrice: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    textDecorationLine: "line-through",
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
