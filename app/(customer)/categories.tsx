import React from "react";
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
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const cardWidth = (width - 48 - 12) / 2;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/api/categories"),
  });

  const categories = query.data || [];

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Text style={styles.title}>Categories</Text>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={categories}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => query.refetch()} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="grid-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No categories yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              onPress={() =>
                router.push({ pathname: "/category/[id]", params: { id: item.id, name: item.name } })
              }
            >
              {item.image ? (
                <Image source={{ uri: getImageUrl(item.image) }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Ionicons name="folder-outline" size={36} color={Colors.primary} />
                </View>
              )}
              <Text style={styles.name}>{item.name}</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 12,
  },
  row: {
    gap: 12,
  },
  card: {
    width: cardWidth,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  image: {
    width: "100%",
    height: cardWidth * 0.75,
    backgroundColor: Colors.surfaceAlt,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    padding: 12,
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
