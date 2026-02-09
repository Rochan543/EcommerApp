import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  FlatList,
  KeyboardAvoidingView,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import Colors from "@/constants/colors";

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
}

const ticketCategories = ["General", "Order Issue", "Shipping", "Returns", "Payment", "Account"];

const statusColors: Record<string, string> = {
  open: "#F59E0B",
  "in-progress": "#3B82F6",
  resolved: "#16A34A",
  closed: "#6B7280",
};

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"chat" | "tickets">("chat");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "1", text: "Hi! I'm your ShopEase assistant. How can I help you today?", isUser: false },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<FlatList>(null);

  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketCategory, setTicketCategory] = useState("General");
  const [ticketOrderId, setTicketOrderId] = useState("");

  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editCategory, setEditCategory] = useState("General");

  const ticketsQuery = useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiFetch("/api/tickets"),
    refetchInterval: 10000,
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/api/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setShowTicketForm(false);
      setTicketSubject("");
      setTicketMessage("");
      setTicketCategory("General");
      setTicketOrderId("");
      Alert.alert("Ticket Created", "We'll get back to you soon!");
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  const editTicketMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/api/tickets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setEditingTicket(null);
      Alert.alert("Updated", "Ticket updated successfully");
    },
    onError: (err: any) => Alert.alert("Error", err.message),
  });

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      isUser: true,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    const input = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await apiFetch("/api/chatbot", {
        method: "POST",
        body: JSON.stringify({ message: input }),
      });
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: res.reply || "Sorry, I couldn't process that. Please try again.",
        isUser: false,
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: "Something went wrong. Please try again.", isUser: false },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleSubmitTicket() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert("Error", "Subject and message are required");
      return;
    }
    createTicketMutation.mutate({
      subject: ticketSubject.trim(),
      message: ticketMessage.trim(),
      category: ticketCategory,
      orderId: ticketOrderId.trim() || undefined,
    });
  }

  function openEditTicket(ticket: any) {
    setEditingTicket(ticket);
    setEditSubject(ticket.subject);
    setEditMessage(ticket.message);
    setEditCategory(ticket.category || "General");
  }

  function handleEditTicket() {
    if (!editSubject.trim() || !editMessage.trim()) {
      Alert.alert("Error", "Subject and message are required");
      return;
    }
    editTicketMutation.mutate({
      id: editingTicket.id,
      data: {
        subject: editSubject.trim(),
        message: editMessage.trim(),
        category: editCategory,
      },
    });
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "chat" && styles.tabActive]}
          onPress={() => setTab("chat")}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={tab === "chat" ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, tab === "chat" && styles.tabTextActive]}>Chat</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "tickets" && styles.tabActive]}
          onPress={() => setTab("tickets")}
        >
          <Ionicons name="document-text-outline" size={18} color={tab === "tickets" ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.tabText, tab === "tickets" && styles.tabTextActive]}>Tickets</Text>
        </Pressable>
      </View>

      {tab === "chat" ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={chatScrollRef}
            data={chatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View style={[styles.chatBubble, item.isUser ? styles.userBubble : styles.botBubble]}>
                {!item.isUser && (
                  <View style={styles.botIcon}>
                    <Ionicons name="headset" size={14} color={Colors.white} />
                  </View>
                )}
                <View style={[styles.bubbleContent, item.isUser ? styles.userBubbleContent : styles.botBubbleContent]}>
                  <Text style={[styles.bubbleText, item.isUser && styles.userBubbleText]}>{item.text}</Text>
                </View>
              </View>
            )}
            ListFooterComponent={
              chatLoading ? (
                <View style={[styles.chatBubble, styles.botBubble]}>
                  <View style={styles.botIcon}>
                    <Ionicons name="headset" size={14} color={Colors.white} />
                  </View>
                  <View style={[styles.bubbleContent, styles.botBubbleContent]}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                </View>
              ) : null
            }
          />

          <View style={styles.chatQuickActions}>
            <Pressable style={styles.quickAction} onPress={() => { setTab("tickets"); setShowTicketForm(true); }}>
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.quickActionText}>Create Ticket</Text>
            </Pressable>
          </View>

          <View style={[styles.chatInputBar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8 }]}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type your message..."
              placeholderTextColor={Colors.textLight}
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendChat}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={sendChat} disabled={chatLoading || !chatInput.trim()}>
              <Ionicons name="send" size={20} color={chatInput.trim() ? Colors.primary : Colors.textLight} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.ticketHeader}>
            <Text style={styles.ticketHeaderText}>Your Tickets</Text>
            <Pressable style={styles.newTicketBtn} onPress={() => setShowTicketForm(true)}>
              <Ionicons name="add" size={20} color={Colors.white} />
              <Text style={styles.newTicketBtnText}>New Ticket</Text>
            </Pressable>
          </View>

          {ticketsQuery.isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={ticketsQuery.data || []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.ticketList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="document-text-outline" size={48} color={Colors.textLight} />
                  <Text style={styles.emptyText}>No support tickets yet</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.ticketCard}>
                  <View style={styles.ticketCardHeader}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>{item.subject}</Text>
                    <View style={[styles.ticketStatus, { backgroundColor: statusColors[item.status] || Colors.textSecondary }]}>
                      <Text style={styles.ticketStatusText}>{item.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.ticketCategory}>{item.category}</Text>
                  <Text style={styles.ticketMessage} numberOfLines={2}>{item.message}</Text>
                  {item.adminReply && (
                    <View style={styles.replySection}>
                      <View style={styles.replyHeader}>
                        <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
                        <Text style={styles.replyLabel}>Admin Reply</Text>
                      </View>
                      <Text style={styles.replyText}>{item.adminReply}</Text>
                    </View>
                  )}
                  <View style={styles.ticketFooter}>
                    <Text style={styles.ticketDate}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                    </Text>
                    {item.status === "open" && (
                      <Pressable style={styles.editBtn} onPress={() => openEditTicket(item)}>
                        <Ionicons name="create-outline" size={16} color={Colors.primary} />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
            />
          )}

          <Modal visible={showTicketForm} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Support Ticket</Text>
                  <Pressable onPress={() => setShowTicketForm(false)}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                  <Text style={styles.formLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {ticketCategories.map((cat) => (
                      <Pressable
                        key={cat}
                        style={[styles.categoryChip, ticketCategory === cat && styles.categoryChipActive]}
                        onPress={() => setTicketCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, ticketCategory === cat && styles.categoryChipTextActive]}>
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.formLabel}>Subject</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Brief description of your issue"
                    placeholderTextColor={Colors.textLight}
                    value={ticketSubject}
                    onChangeText={setTicketSubject}
                  />

                  <Text style={styles.formLabel}>Message</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    placeholder="Describe your issue in detail..."
                    placeholderTextColor={Colors.textLight}
                    value={ticketMessage}
                    onChangeText={setTicketMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <Text style={styles.formLabel}>Order ID (Optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Related order ID"
                    placeholderTextColor={Colors.textLight}
                    value={ticketOrderId}
                    onChangeText={setTicketOrderId}
                  />

                  <Pressable
                    style={[styles.submitBtn, createTicketMutation.isPending && { opacity: 0.7 }]}
                    onPress={handleSubmitTicket}
                    disabled={createTicketMutation.isPending}
                  >
                    {createTicketMutation.isPending ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Ticket</Text>
                    )}
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>

          <Modal visible={!!editingTicket} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Ticket</Text>
                  <Pressable onPress={() => setEditingTicket(null)}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                  <Text style={styles.formLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                    {ticketCategories.map((cat) => (
                      <Pressable
                        key={cat}
                        style={[styles.categoryChip, editCategory === cat && styles.categoryChipActive]}
                        onPress={() => setEditCategory(cat)}
                      >
                        <Text style={[styles.categoryChipText, editCategory === cat && styles.categoryChipTextActive]}>
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.formLabel}>Subject</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Brief description of your issue"
                    placeholderTextColor={Colors.textLight}
                    value={editSubject}
                    onChangeText={setEditSubject}
                  />

                  <Text style={styles.formLabel}>Message</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    placeholder="Describe your issue in detail..."
                    placeholderTextColor={Colors.textLight}
                    value={editMessage}
                    onChangeText={setEditMessage}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />

                  <Pressable
                    style={[styles.submitBtn, editTicketMutation.isPending && { opacity: 0.7 }]}
                    onPress={handleEditTicket}
                    disabled={editTicketMutation.isPending}
                  >
                    {editTicketMutation.isPending ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <Text style={styles.submitBtnText}>Update Ticket</Text>
                    )}
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      )}
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
  tabs: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: { backgroundColor: Colors.surface },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  chatList: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chatBubble: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  userBubble: { justifyContent: "flex-end" },
  botBubble: { justifyContent: "flex-start" },
  botIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  bubbleContent: { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubbleContent: { backgroundColor: Colors.primary, borderBottomRightRadius: 4, marginLeft: "auto" },
  botBubbleContent: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text, lineHeight: 20 },
  userBubbleText: { color: Colors.white },
  chatQuickActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  quickActionText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  ticketHeaderText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  newTicketBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newTicketBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.white },
  ticketList: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
  ticketCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  ticketCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ticketSubject: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text, marginRight: 8 },
  ticketStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ticketStatusText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.white, textTransform: "capitalize" as const },
  ticketCategory: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  ticketMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  replySection: {
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  replyLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.primary },
  replyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text, lineHeight: 20 },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textLight },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  editBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.primary },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.textSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.text },
  modalBody: { padding: 20, gap: 16 },
  formLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.text, marginBottom: 6, marginTop: 12 },
  formInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTextArea: { minHeight: 100, textAlignVertical: "top" as const },
  categoryScroll: { marginBottom: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    backgroundColor: Colors.surface,
  },
  categoryChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
});
