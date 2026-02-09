import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, getImageUrl } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile, getAccessToken } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [editingShipping, setEditingShipping] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [loadingShipping, setLoadingShipping] = useState(true);
  const [shipping, setShipping] = useState<ShippingAddress>({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [shippingDraft, setShippingDraft] = useState<ShippingAddress>({ ...shipping });

  useEffect(() => {
    loadShipping();
  }, []);

  async function loadShipping() {
    try {
      const data = await apiFetch("/api/auth/shipping");
      setShipping(data);
      setShippingDraft(data);
    } catch {
    } finally {
      setLoadingShipping(false);
    }
  }

  async function handlePickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      setUploadingImage(true);

      const formData = new FormData();
      const file = new File(result.assets[0].uri);
      formData.append("image", file);

      const token = await getAccessToken();
      const baseUrl = getApiUrl();
      const res = await fetch(new URL("/api/auth/profile-image", baseUrl).toString(), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(data.message || "Upload failed");
      }

      const meUrl = new URL("/api/auth/me", baseUrl).toString();
      const meRes = await fetch(meUrl, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (meRes.ok) {
        const freshUser = await meRes.json();
        await updateProfile({ name: freshUser.name, phone: freshUser.phone || "" });
      }

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() });
      setEditing(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveShipping() {
    if (!shippingDraft.fullName.trim() || !shippingDraft.addressLine1.trim() || !shippingDraft.city.trim() || !shippingDraft.state.trim() || !shippingDraft.pincode.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    setSavingShipping(true);
    try {
      const data = await apiFetch("/api/auth/shipping", {
        method: "PUT",
        body: JSON.stringify(shippingDraft),
      });
      setShipping(data);
      setShippingDraft(data);
      setEditingShipping(false);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSavingShipping(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const hasShipping = shipping.addressLine1.trim().length > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 67 : insets.top + 8, paddingBottom: 100 }}
    >
      <Text style={styles.title}>Profile</Text>

      <View style={styles.avatarSection}>
        <Pressable onPress={handlePickImage} disabled={uploadingImage} style={styles.avatarWrapper}>
          {user?.profileImage ? (
            <Image
              source={{ uri: getImageUrl(user.profileImage) }}
              style={styles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={Colors.white} />
            </View>
          )}
          <View style={styles.cameraBadge}>
            {uploadingImage ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Ionicons name="camera" size={14} color={Colors.white} />
            )}
          </View>
        </Pressable>
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          {!editing && (
            <Pressable onPress={() => setEditing(true)}>
              <Ionicons name="create-outline" size={22} color={Colors.primary} />
            </Pressable>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textLight}
            />
          ) : (
            <Text style={styles.value}>{user?.name}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{user?.phone || "Not set"}</Text>
          )}
        </View>

        {editing && (
          <View style={styles.editActions}>
            <Pressable
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={() => {
                setEditing(false);
                setName(user?.name || "");
                setPhone(user?.phone || "");
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.saveBtn]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Shipping Address</Text>
          </View>
          {!editingShipping && (
            <Pressable onPress={() => { setShippingDraft({ ...shipping }); setEditingShipping(true); }}>
              <Ionicons name={hasShipping ? "create-outline" : "add-circle-outline"} size={22} color={Colors.primary} />
            </Pressable>
          )}
        </View>

        {loadingShipping ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : editingShipping ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Full Name *"
              placeholderTextColor={Colors.textLight}
              value={shippingDraft.fullName}
              onChangeText={(t) => setShippingDraft({ ...shippingDraft, fullName: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={Colors.textLight}
              value={shippingDraft.phone}
              onChangeText={(t) => setShippingDraft({ ...shippingDraft, phone: t })}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Address Line 1 *"
              placeholderTextColor={Colors.textLight}
              value={shippingDraft.addressLine1}
              onChangeText={(t) => setShippingDraft({ ...shippingDraft, addressLine1: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Address Line 2"
              placeholderTextColor={Colors.textLight}
              value={shippingDraft.addressLine2}
              onChangeText={(t) => setShippingDraft({ ...shippingDraft, addressLine2: t })}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="City *"
                placeholderTextColor={Colors.textLight}
                value={shippingDraft.city}
                onChangeText={(t) => setShippingDraft({ ...shippingDraft, city: t })}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="State *"
                placeholderTextColor={Colors.textLight}
                value={shippingDraft.state}
                onChangeText={(t) => setShippingDraft({ ...shippingDraft, state: t })}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Pincode *"
                placeholderTextColor={Colors.textLight}
                value={shippingDraft.pincode}
                onChangeText={(t) => setShippingDraft({ ...shippingDraft, pincode: t })}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Country"
                placeholderTextColor={Colors.textLight}
                value={shippingDraft.country}
                onChangeText={(t) => setShippingDraft({ ...shippingDraft, country: t })}
              />
            </View>
            <View style={styles.editActions}>
              <Pressable
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => { setEditingShipping(false); setShippingDraft({ ...shipping }); }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.saveBtn]} onPress={handleSaveShipping} disabled={savingShipping}>
                {savingShipping ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.saveText}>Save Address</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : hasShipping ? (
          <View style={styles.addressDisplay}>
            <Text style={styles.addressName}>{shipping.fullName}</Text>
            <Text style={styles.addressLine}>{shipping.addressLine1}</Text>
            {shipping.addressLine2 ? <Text style={styles.addressLine}>{shipping.addressLine2}</Text> : null}
            <Text style={styles.addressLine}>{shipping.city}, {shipping.state} {shipping.pincode}</Text>
            {shipping.phone ? <Text style={styles.addressPhone}>{shipping.phone}</Text> : null}
          </View>
        ) : (
          <Text style={styles.noAddress}>No shipping address saved. Add one for faster checkout.</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.9 }]}
        onPress={() => router.push("/support" as any)}
      >
        <Ionicons name="chatbubbles-outline" size={22} color={Colors.primary} />
        <Text style={styles.menuText}>Help & Support</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.9 }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    marginBottom: 20,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarWrapper: {
    position: "relative" as const,
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  cameraBadge: {
    position: "absolute" as const,
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.background,
  },
  userName: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  input: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceAlt,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: Colors.surfaceAlt,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  saveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  addressDisplay: {
    gap: 2,
  },
  addressName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  addressLine: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  addressPhone: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 4,
  },
  noAddress: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textLight,
    fontStyle: "italic" as const,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.error,
  },
});
