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
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";

const ticketStatuses = ["open", "in-progress", "resolved", "closed"];
const statusColors: Record<string, string> = {
  open: "#F59E0B",
  "in-progress": "#3B82F6",
  resolved: "#16A34A",
  closed: "#6B7280",
};

export default function AdminTicketsScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("resolved");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "tickets"],
    queryFn: () => apiFetch("/api/admin/tickets"),
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, status, adminReply }: { id: string; status: string; adminReply: string }) =>
      apiFetch(`/api/admin/tickets/${id}`, { method: "PUT", body: JSON.stringify({ status, adminReply }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      setShowReply(false);
      setSelectedTicket(null);
      setReplyText("");
      Alert.alert("Success", "Ticket updated successfully");
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  function openReply(ticket: any) {
    setSelectedTicket(ticket);
    setReplyText(ticket.adminReply || "");
    setReplyStatus(ticket.status === "open" ? "in-progress" : ticket.status);
    setShowReply(true);
  }

  function handleReply() {
    if (!replyText.trim()) {
      Alert.alert("Error", "Please enter a reply");
      return;
    }
    updateTicketMutation.mutate({
      id: selectedTicket.id,
      status: replyStatus,
      adminReply: replyText.trim(),
    });
  }

  const tickets = query.data || [];
  const filteredTickets = filterStatus ? tickets.filter((t: any) => t.status === filterStatus) : tickets;

  const statusCounts = tickets.reduce((acc: Record<string, number>, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Support Tickets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        <Pressable
          style={[styles.filterChip, !filterStatus && styles.filterChipActive]}
          onPress={() => setFilterStatus(null)}
        >
          <Text style={[styles.filterChipText, !filterStatus && styles.filterChipTextActive]}>
            All ({tickets.length})
          </Text>
        </Pressable>
        {ticketStatuses.map((s) => (
          <Pressable
            key={s}
            style={[styles.filterChip, filterStatus === s && { backgroundColor: statusColors[s], borderColor: statusColors[s] }]}
            onPress={() => setFilterStatus(filterStatus === s ? null : s)}
          >
            <Text style={[styles.filterChipText, filterStatus === s && { color: Colors.white }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({statusCounts[s] || 0})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {query.isLoading ? (
        <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => query.refetch()} tintColor="#8B5CF6" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No tickets found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openReply(item)}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
                  <Text style={styles.ticketUser}>{item.userName} - {item.userEmail}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] || Colors.textSecondary }]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
                {item.orderId && (
                  <Text style={styles.orderRef}>Order: #{item.orderId.slice(0, 8)}</Text>
                )}
              </View>

              <Text style={styles.ticketMessage} numberOfLines={3}>{item.message}</Text>

              {item.adminReply && (
                <View style={styles.existingReply}>
                  <Text style={styles.existingReplyLabel}>Your Reply:</Text>
                  <Text style={styles.existingReplyText} numberOfLines={2}>{item.adminReply}</Text>
                </View>
              )}

              <View style={styles.cardFooter}>
                <Text style={styles.ticketDate}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                </Text>
                <View style={styles.replyIndicator}>
                  <Ionicons name="chatbubble-outline" size={14} color="#8B5CF6" />
                  <Text style={styles.replyIndicatorText}>Reply</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={showReply} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reply to Ticket</Text>
              <Pressable onPress={() => { setShowReply(false); setSelectedTicket(null); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedTicket && (
                <>
                  <View style={styles.ticketDetail}>
                    <Text style={styles.detailLabel}>From</Text>
                    <Text style={styles.detailValue}>{selectedTicket.userName} ({selectedTicket.userEmail})</Text>
                  </View>
                  <View style={styles.ticketDetail}>
                    <Text style={styles.detailLabel}>Subject</Text>
                    <Text style={styles.detailValue}>{selectedTicket.subject}</Text>
                  </View>
                  <View style={styles.ticketDetail}>
                    <Text style={styles.detailLabel}>Message</Text>
                    <Text style={styles.detailValue}>{selectedTicket.message}</Text>
                  </View>

                  <Text style={styles.replyFormLabel}>Update Status</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {ticketStatuses.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.statusChip, replyStatus === s && { backgroundColor: statusColors[s], borderColor: statusColors[s] }]}
                        onPress={() => setReplyStatus(s)}
                      >
                        <Text style={[styles.statusChipText, replyStatus === s && { color: Colors.white }]}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.replyFormLabel}>Your Reply</Text>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your response..."
                    placeholderTextColor={Colors.textLight}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <Pressable
                    style={[styles.sendReplyBtn, updateTicketMutation.isPending && { opacity: 0.7 }]}
                    onPress={handleReply}
                    disabled={updateTicketMutation.isPending}
                  >
                    {updateTicketMutation.isPending ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="send" size={18} color={Colors.white} />
                        <Text style={styles.sendReplyText}>Send Reply</Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  filterScroll: { maxHeight: 44, marginBottom: 12 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ticketSubject: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  ticketUser: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.white, textTransform: "capitalize" as const },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryTag: { backgroundColor: Colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  categoryText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  orderRef: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textLight },
  ticketMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  existingReply: { backgroundColor: "#F0FDF4", borderRadius: 8, padding: 10, gap: 4 },
  existingReplyLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  existingReplyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 8 },
  ticketDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight },
  replyIndicator: { flexDirection: "row", alignItems: "center", gap: 4 },
  replyIndicatorText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#8B5CF6" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
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
  ticketDetail: { marginBottom: 14 },
  detailLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  replyFormLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 8, marginTop: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: 8,
  },
  statusChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  replyInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
    textAlignVertical: "top" as const,
  },
  sendReplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8B5CF6",
    borderRadius: 12,
    height: 48,
    marginTop: 20,
    marginBottom: 20,
  },
  sendReplyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
