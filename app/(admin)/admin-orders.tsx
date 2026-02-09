import React from "react";
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
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";

const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const statusColors: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  shipped: "#8B5CF6",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

export default function AdminOrders() {
  const insets = useSafeAreaInsets();

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
          renderItem={({ item }) => (
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
                    {prod.quantity}x {prod.title} - ${(prod.price * prod.quantity).toFixed(2)}
                  </Text>
                ))}
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.date}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </Text>
                <Text style={styles.total}>${item.totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          )}
        />
      )}
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
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10 },
  date: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textLight },
  total: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#8B5CF6" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
});
