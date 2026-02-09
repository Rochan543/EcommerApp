import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";

const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
const statusColors: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  processing: "#8B5CF6",
  shipped: "#8B5CF6",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

const defaultSteps = ["Ordered", "Packed", "Shipped", "Out for Delivery", "Delivered"];

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showTracking, setShowTracking] = useState(false);

  const query = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: () => apiFetch("/api/admin/orders"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/api/admin/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const updateTrackingMutation = useMutation({
    mutationFn: ({ id, trackingSteps }: { id: string; trackingSteps: any[] }) =>
      apiFetch(`/api/admin/orders/${id}/tracking`, { method: "PUT", body: JSON.stringify({ trackingSteps }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      setShowTracking(false);
      setSelectedOrder(null);
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  function changeStatus(orderId: string, currentStatus: string) {
    const nextStatuses = statuses.filter((s) => s !== currentStatus);
    Alert.alert(
      "Update Status",
      "Select new status:",
      [
        ...nextStatuses.map((s) => ({
          text: s.charAt(0).toUpperCase() + s.slice(1),
          onPress: () => updateStatusMutation.mutate({ id: orderId, status: s }),
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  function openTracking(order: any) {
    setSelectedOrder(order);
    setShowTracking(true);
  }

  function toggleStep(stepIndex: number) {
    if (!selectedOrder) return;
    const steps = [...(selectedOrder.trackingSteps || [])];
    if (!steps.length) {
      defaultSteps.forEach((s, i) => {
        steps.push({ step: s, completed: i === 0, completedAt: i === 0 ? new Date().toISOString() : undefined });
      });
    }

    const step = steps[stepIndex];
    if (step.completed) {
      for (let i = stepIndex; i < steps.length; i++) {
        steps[i] = { ...steps[i], completed: false, completedAt: undefined };
      }
    } else {
      for (let i = 0; i <= stepIndex; i++) {
        if (!steps[i].completed) {
          steps[i] = { ...steps[i], completed: true, completedAt: new Date().toISOString() };
        }
      }
    }

    setSelectedOrder({ ...selectedOrder, trackingSteps: steps });
  }

  function saveTracking() {
    if (!selectedOrder) return;
    updateTrackingMutation.mutate({
      id: selectedOrder.id,
      trackingSteps: selectedOrder.trackingSteps || [],
    });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <Text style={styles.title}>Orders</Text>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={query.data || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => query.refetch()} tintColor="#8B5CF6" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const steps = item.trackingSteps || [];
            const completedCount = steps.filter((s: any) => s.completed).length;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
                    <Text style={styles.customerName}>{item.userName}</Text>
                  </View>
                  <Pressable
                    style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || Colors.textSecondary }]}
                    onPress={() => changeStatus(item.id, item.status)}
                  >
                    <Text style={styles.statusText}>{item.status}</Text>
                    <Ionicons name="chevron-down" size={12} color={Colors.white} />
                  </Pressable>
                </View>
                <View style={styles.itemsList}>
                  {(item.items as any[]).map((prod: any, i: number) => (
                    <Text key={i} style={styles.itemText} numberOfLines={1}>
                      {prod.quantity}x {prod.title} - {formatINR(prod.price * prod.quantity)}
                    </Text>
                  ))}
                </View>

                {steps.length > 0 && (
                  <View style={styles.trackingPreview}>
                    <View style={styles.trackingBar}>
                      <View
                        style={[
                          styles.trackingBarFill,
                          { width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.trackingLabel}>{completedCount}/{steps.length} steps</Text>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.date}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                  </Text>
                  <View style={styles.footerActions}>
                    <Pressable style={styles.trackBtn} onPress={() => openTracking(item)}>
                      <Ionicons name="navigate-outline" size={14} color="#8B5CF6" />
                      <Text style={styles.trackBtnText}>Track</Text>
                    </Pressable>
                    <Text style={styles.total}>{formatINR(item.totalAmount)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={showTracking} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Update Tracking #{selectedOrder?.id?.slice(0, 8)}
              </Text>
              <Pressable onPress={() => { setShowTracking(false); setSelectedOrder(null); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {(selectedOrder?.trackingSteps || defaultSteps.map((s, i) => ({ step: s, completed: i === 0 }))).map((step: any, index: number) => (
                <Pressable
                  key={index}
                  style={styles.trackingStep}
                  onPress={() => toggleStep(index)}
                >
                  <View style={[styles.stepCheckbox, step.completed && styles.stepCheckboxActive]}>
                    {step.completed && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={[styles.stepName, step.completed && styles.stepNameDone]}>{step.step}</Text>
                    {step.completedAt && (
                      <Text style={styles.stepDate}>
                        {new Date(step.completedAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.saveTrackingBtn, updateTrackingMutation.isPending && { opacity: 0.7 }]}
                onPress={saveTracking}
                disabled={updateTrackingMutation.isPending}
              >
                {updateTrackingMutation.isPending ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.saveTrackingText}>Save Tracking</Text>
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
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", color: Colors.text },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: Colors.borderLight },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  customerName: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.white, textTransform: "capitalize" as const },
  itemsList: { gap: 3 },
  itemText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  trackingPreview: { flexDirection: "row", alignItems: "center", gap: 8 },
  trackingBar: { flex: 1, height: 4, backgroundColor: Colors.surfaceAlt, borderRadius: 2, overflow: "hidden" },
  trackingBarFill: { height: "100%", backgroundColor: "#8B5CF6", borderRadius: 2 },
  trackingLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10 },
  date: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textLight },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  trackBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#F3F0FF" },
  trackBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#8B5CF6" },
  total: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#8B5CF6" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: Colors.text },
  modalBody: { padding: 20 },
  trackingStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  stepCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCheckboxActive: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  stepInfo: { flex: 1 },
  stepName: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  stepNameDone: { color: Colors.text, fontFamily: "Inter_600SemiBold" },
  stepDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight, marginTop: 2 },
  modalActions: { paddingHorizontal: 20, paddingTop: 12 },
  saveTrackingBtn: { backgroundColor: "#8B5CF6", borderRadius: 12, height: 48, justifyContent: "center", alignItems: "center" },
  saveTrackingText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
