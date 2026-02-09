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
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

export default function AdminMore() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [activeSection, setActiveSection] = useState<"users" | "banners" | null>(null);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [bannerLink, setBannerLink] = useState("");
  const [bannerActive, setBannerActive] = useState(true);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch("/api/admin/users"),
    enabled: activeSection === "users",
  });

  const bannersQuery = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: () => apiFetch("/api/admin/banners"),
    enabled: activeSection === "banners",
  });

  const saveBannerMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingBannerId) {
        return apiFetch(`/api/admin/banners/${editingBannerId}`, { method: "PUT", body: JSON.stringify(data) });
      }
      return apiFetch("/api/admin/banners", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      closeBannerModal();
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const deleteBannerMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/banners/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });

  function openNewBanner() {
    setEditingBannerId(null);
    setBannerTitle("");
    setBannerImage("");
    setBannerLink("");
    setBannerActive(true);
    setShowBannerModal(true);
  }

  function openEditBanner(banner: any) {
    setEditingBannerId(banner.id);
    setBannerTitle(banner.title);
    setBannerImage(banner.image || "");
    setBannerLink(banner.link || "");
    setBannerActive(banner.isActive);
    setShowBannerModal(true);
  }

  function closeBannerModal() {
    setShowBannerModal(false);
    setEditingBannerId(null);
  }

  function handleSaveBanner() {
    if (!bannerTitle.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    saveBannerMutation.mutate({ title: bannerTitle.trim(), image: bannerImage.trim(), link: bannerLink.trim(), isActive: bannerActive });
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (!activeSection) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 67 : insets.top + 8, paddingBottom: 100 }}
      >
        <Text style={styles.pageTitle}>More</Text>

        <Pressable style={styles.menuCard} onPress={() => setActiveSection("users")}>
          <View style={[styles.menuIcon, { backgroundColor: "#3B82F6" }]}>
            <Ionicons name="people" size={22} color={Colors.white} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>User Management</Text>
            <Text style={styles.menuDesc}>View registered users</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
        </Pressable>

        <Pressable style={styles.menuCard} onPress={() => setActiveSection("banners")}>
          <View style={[styles.menuIcon, { backgroundColor: "#F59E0B" }]}>
            <Ionicons name="megaphone" size={22} color={Colors.white} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Banner Management</Text>
            <Text style={styles.menuDesc}>Manage promotional banners</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
        </Pressable>

        <Pressable style={styles.menuCard} onPress={() => router.push("/admin-tickets" as any)}>
          <View style={[styles.menuIcon, { backgroundColor: "#16A34A" }]}>
            <Ionicons name="chatbubbles" size={22} color={Colors.white} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Support Tickets</Text>
            <Text style={styles.menuDesc}>Manage customer tickets</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
        </Pressable>

        <Pressable style={styles.menuCard} onPress={() => router.push("/(customer)")}>
          <View style={[styles.menuIcon, { backgroundColor: Colors.primary }]}>
            <Ionicons name="storefront" size={22} color={Colors.white} />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>View Store</Text>
            <Text style={styles.menuDesc}>Switch to customer view</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
        </Pressable>

        <Pressable style={styles.logoutCard} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (activeSection === "users") {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
          <Pressable onPress={() => setActiveSection(null)}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Users</Text>
          <View style={{ width: 24 }} />
        </View>
        {usersQuery.isLoading ? (
          <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={usersQuery.data || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Ionicons name="person" size={20} color={Colors.white} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: item.role === "admin" ? "#8B5CF6" : "#3B82F6" }]}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Pressable onPress={() => setActiveSection(null)}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Banners</Text>
        <Pressable style={styles.addBtn} onPress={openNewBanner}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </Pressable>
      </View>
      {bannersQuery.isLoading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={bannersQuery.data || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No banners yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.bannerCard}>
              <View style={styles.bannerRow}>
                <View style={styles.bannerInfo}>
                  <Text style={styles.bannerTitle}>{item.title}</Text>
                  <Text style={styles.bannerMeta}>{item.isActive ? "Active" : "Inactive"}</Text>
                </View>
                <View style={styles.bannerActions}>
                  <Pressable onPress={() => openEditBanner(item)}>
                    <Ionicons name="create-outline" size={22} color="#8B5CF6" />
                  </Pressable>
                  <Pressable onPress={() => {
                    Alert.alert("Delete Banner", "Are you sure?", [
                      { text: "Cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteBannerMutation.mutate(item.id) },
                    ]);
                  }}>
                    <Ionicons name="trash-outline" size={22} color={Colors.error} />
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={showBannerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingBannerId ? "Edit Banner" : "New Banner"}</Text>
              <Pressable onPress={closeBannerModal}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>
            <View style={styles.modalForm}>
              <TextInput style={styles.modalInput} placeholder="Banner Title *" value={bannerTitle} onChangeText={setBannerTitle} placeholderTextColor={Colors.textLight} />
              <TextInput style={styles.modalInput} placeholder="Image URL" value={bannerImage} onChangeText={setBannerImage} placeholderTextColor={Colors.textLight} />
              <TextInput style={styles.modalInput} placeholder="Link URL" value={bannerLink} onChangeText={setBannerLink} placeholderTextColor={Colors.textLight} />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch value={bannerActive} onValueChange={setBannerActive} trackColor={{ true: "#8B5CF6" }} />
              </View>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
                onPress={handleSaveBanner}
                disabled={saveBannerMutation.isPending}
              >
                {saveBannerMutation.isPending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>{editingBannerId ? "Update" : "Create"}</Text>
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
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 20 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 20 },
  menuCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderLight },
  menuIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  menuInfo: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  menuDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  logoutCard: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#FEE2E2" },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.error },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#8B5CF6", justifyContent: "center", alignItems: "center" },
  list: { paddingBottom: 100, gap: 10 },
  userCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, gap: 12, borderWidth: 1, borderColor: Colors.borderLight },
  userAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#3B82F6", justifyContent: "center", alignItems: "center" },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.white, textTransform: "capitalize" as const },
  bannerCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bannerInfo: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  bannerMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  bannerActions: { flexDirection: "row", gap: 14 },
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
});
