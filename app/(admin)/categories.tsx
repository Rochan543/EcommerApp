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
  Platform,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, getImageUrl } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as ImagePicker from "expo-image-picker";   // ✅ ADDED

export default function AdminCategories() {
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [isActive, setIsActive] = useState(true);
    // ✅ ADDED
async function pickImage() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission required", "Allow gallery access");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],   // ✅ FIXED
    quality: 0.7,
  });

  if (!result.canceled) {
    setImage(result.assets[0].uri);
  }
}



  const query = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => apiFetch("/api/admin/categories"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingId) {
        return apiFetch(`/api/admin/categories/${editingId}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return apiFetch("/api/admin/categories", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      closeModal();
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  function openNew() {
    setEditingId(null);
    setName("");
    setImage("");
    setIsActive(true);
    setShowModal(true);
  }

  function openEdit(cat: any) {
    setEditingId(cat.id);
    setName(cat.name);
    setImage(cat.image || "");
    setIsActive(cat.isActive);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    saveMutation.mutate({ name: name.trim(), image: image.trim(), isActive });
  }

  function handleDelete(id: string) {
    Alert.alert("Delete Category", "Are you sure?", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Text style={styles.title}>Categories</Text>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={query.data || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="folder-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No categories yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                {item.image ? (
                  <Image source={{ uri: getImageUrl(item.image) }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="folder-outline" size={22} color={Colors.textLight} />
                  </View>
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{item.isActive ? "Active" : "Inactive"}</Text>
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
              <Text style={styles.modalTitle}>{editingId ? "Edit Category" : "New Category"}</Text>
              <Pressable onPress={closeModal}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <View style={styles.modalForm}>
              <TextInput style={styles.modalInput} placeholder="Category Name *" value={name} onChangeText={setName} placeholderTextColor={Colors.textLight} />
              <TextInput style={styles.modalInput} placeholder="Image URL" value={image} onChangeText={setImage} placeholderTextColor={Colors.textLight} />
              {/* ✅ DEVICE UPLOAD BUTTON */}
              <Pressable style={styles.uploadBtn} onPress={pickImage}>
                <Ionicons name="image-outline" size={18} color={Colors.white} />
                <Text style={styles.uploadText}>Pick From Device</Text>
              </Pressable>
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
                  <Text style={styles.saveBtnText}>{editingId ? "Update" : "Create"}</Text>
                )}
              </Pressable>
            </View>
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
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.surfaceAlt },
  thumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  cardActions: { flexDirection: "row", gap: 14 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text },
  modalForm: { padding: 20, gap: 14, paddingBottom: 40 },
  modalInput: { backgroundColor: Colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  switchLabel: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text },
  saveBtn: { backgroundColor: "#8B5CF6", borderRadius: 12, height: 48, justifyContent: "center", alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  uploadBtn: {
  backgroundColor: "#8B5CF6",
  height: 44,
  borderRadius: 10,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
},

uploadText: {
  color: Colors.white,
  fontSize: 14,
  fontFamily: "Inter_500Medium",
},

});
