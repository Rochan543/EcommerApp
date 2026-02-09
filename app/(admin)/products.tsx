import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const productsQuery = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => apiFetch("/api/admin/products"),
  });

  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => apiFetch("/api/admin/categories"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingId) {
        return apiFetch(`/api/admin/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      }
      return apiFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeModal();
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function openNew() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setPrice("");
    setDiscountPrice("");
    setStock("");
    setCategoryId("");
    setImageUrl("");
    setIsActive(true);
    setShowModal(true);
  }

  function openEdit(product: any) {
    setEditingId(product.id);
    setTitle(product.title);
    setDescription(product.description || "");
    setPrice(String(product.price));
    setDiscountPrice(product.discountPrice ? String(product.discountPrice) : "");
    setStock(String(product.stock));
    setCategoryId(product.categoryId || "");
    setImageUrl(product.images?.[0] || "");
    setIsActive(product.isActive);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function handleSave() {
    if (!title.trim() || !price.trim()) {
      Alert.alert("Error", "Title and price are required");
      return;
    }
    const data: any = {
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      isActive,
      images: imageUrl.trim() ? [imageUrl.trim()] : [],
    };
    if (discountPrice.trim()) data.discountPrice = parseFloat(discountPrice);
    if (categoryId) data.categoryId = categoryId;
    saveMutation.mutate(data);
  }

  function handleDelete(id: string) {
    Alert.alert("Delete Product", "Are you sure?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  const products = productsQuery.data || [];
  const categories = categoriesQuery.data || [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Text style={styles.title}>Products</Text>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {productsQuery.isLoading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No products yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                {item.images?.length > 0 ? (
                  <Image source={{ uri: getImageUrl(item.images[0]) }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="image-outline" size={20} color={Colors.textLight} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{formatINR(item.price)}</Text>
                  <Text style={styles.cardMeta}>Stock: {item.stock} | {item.isActive ? "Active" : "Inactive"}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => openEdit(item)}>
                    <Ionicons name="create-outline" size={22} color="#8B5CF6" />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={22} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? "Edit Product" : "New Product"}</Text>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
              <TextInput style={styles.modalInput} placeholder="Product Title *" value={title} onChangeText={setTitle} placeholderTextColor={Colors.textLight} />
              <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description" value={description} onChangeText={setDescription} multiline placeholderTextColor={Colors.textLight} />
              <View style={styles.formRow}>
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="Price *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor={Colors.textLight} />
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="Discount Price" value={discountPrice} onChangeText={setDiscountPrice} keyboardType="decimal-pad" placeholderTextColor={Colors.textLight} />
              </View>
              <TextInput style={styles.modalInput} placeholder="Stock" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholderTextColor={Colors.textLight} />
              <TextInput style={styles.modalInput} placeholder="Image URL" value={imageUrl} onChangeText={setImageUrl} placeholderTextColor={Colors.textLight} />

              {categories.length > 0 && (
                <View style={styles.categoryPicker}>
                  <Text style={styles.pickerLabel}>Category:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    <Pressable
                      style={[styles.catChip, !categoryId && styles.catChipActive]}
                      onPress={() => setCategoryId("")}
                    >
                      <Text style={[styles.catChipText, !categoryId && styles.catChipTextActive]}>None</Text>
                    </Pressable>
                    {categories.map((cat: any) => (
                      <Pressable
                        key={cat.id}
                        style={[styles.catChip, categoryId === cat.id && styles.catChipActive]}
                        onPress={() => setCategoryId(cat.id)}
                      >
                        <Text style={[styles.catChipText, categoryId === cat.id && styles.catChipTextActive]}>{cat.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: "#8B5CF6" }} />
              </View>

              <Pressable
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
                onPress={handleSave}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? "Update" : "Create"} Product</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#8B5CF6", justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.borderLight },
  cardRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.surfaceAlt },
  thumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  cardPrice: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#8B5CF6" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  cardActions: { gap: 12, alignItems: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalForm: { padding: 20, gap: 14, paddingBottom: 40 },
  modalInput: { backgroundColor: Colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  formRow: { flexDirection: "row", gap: 12 },
  categoryPicker: { gap: 8 },
  pickerLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border },
  catChipActive: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  catChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  catChipTextActive: { color: Colors.white },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text },
  saveBtn: { backgroundColor: "#8B5CF6", borderRadius: 12, height: 48, justifyContent: "center", alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
