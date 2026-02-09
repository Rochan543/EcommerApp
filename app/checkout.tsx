import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { formatINR } from "@/lib/format";
import Colors from "@/constants/colors";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";

let WebView: any = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

interface AddressForm {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const isBuyNow = params.buyNow === "true";

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [address, setAddress] = useState<AddressForm>({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [buyNowQty, setBuyNowQty] = useState(
    params.quantity ? parseInt(params.quantity as string, 10) : 1
  );
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [addressLoaded, setAddressLoaded] = useState(false);

  useEffect(() => {
    loadSavedAddress();
  }, []);

  async function loadSavedAddress() {
    try {
      const saved = await apiFetch("/api/auth/shipping");
      if (saved && saved.addressLine1) {
        setAddress({
          fullName: saved.fullName || "",
          phone: saved.phone || "",
          addressLine1: saved.addressLine1 || "",
          addressLine2: saved.addressLine2 || "",
          city: saved.city || "",
          state: saved.state || "",
          pincode: saved.pincode || "",
        });
      }
    } catch {
    } finally {
      setAddressLoaded(true);
    }
  }

  const cartQuery = useQuery({
    queryKey: ["cart"],
    queryFn: () => apiFetch("/api/cart"),
    enabled: !isBuyNow,
  });

  const buyNowProduct = isBuyNow
    ? {
        productId: params.productId as string,
        title: params.productTitle as string,
        price: parseFloat(params.productPrice as string),
        quantity: buyNowQty,
      }
    : null;

  const cartItems = cartQuery.data || [];

  const orderItems = isBuyNow
    ? [{ ...buyNowProduct!, ...(params.size ? { size: params.size as string } : {}) }]
    : cartItems.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.product?.discountPrice || item.product?.price || 0,
        title: item.product?.title || "Product",
        ...(item.size ? { size: item.size } : {}),
      }));

  const total = orderItems.reduce(
    (sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );

  const displayItems = isBuyNow
    ? [{ id: "buynow", quantity: buyNowQty, product: { title: params.productTitle, price: buyNowProduct?.price } }]
    : cartItems;

  const validateAddress = () => {
    if (!address.fullName.trim()) return "Full name is required";
    if (!address.phone.trim()) return "Phone number is required";
    if (!address.addressLine1.trim()) return "Address is required";
    if (!address.city.trim()) return "City is required";
    if (!address.state.trim()) return "State is required";
    if (!address.pincode.trim()) return "Pincode is required";
    return null;
  };

  const orderMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      if (!isBuyNow) {
        queryClient.invalidateQueries({ queryKey: ["cart"] });
      }
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Order Placed", "Your order has been placed successfully!", [
        { text: "OK", onPress: () => router.replace("/(customer)/orders") },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message);
    },
  });

  const buildRazorpayHtml = (paymentOrder: any) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
  <style>
    body { margin: 0; padding: 40px 20px; font-family: -apple-system, sans-serif; background: ${Colors.background}; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; box-sizing: border-box; }
    .loading { text-align: center; color: ${Colors.textSecondary}; font-size: 16px; }
    .spinner { width: 40px; height: 40px; border: 4px solid ${Colors.border}; border-top-color: ${Colors.primary}; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading"><div class="spinner"></div><p>Connecting to payment gateway...</p></div>
  <script>
    var options = {
      key: "${paymentOrder.keyId}",
      amount: ${paymentOrder.amount},
      currency: "${paymentOrder.currency}",
      name: "ShopEase",
      description: "Order Payment",
      order_id: "${paymentOrder.orderId}",
      handler: function(response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "payment_success", razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }));
      },
      modal: { ondismiss: function() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "payment_cancelled" })); } },
      prefill: { name: "${address.fullName}", contact: "${address.phone}" },
      theme: { color: "${Colors.primary}" }
    };
    var rzp = new Razorpay(options);
    rzp.on("payment.failed", function(response) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: "payment_failed", error: response.error.description })); });
    setTimeout(function() { rzp.open(); }, 500);
  <\/script>
</body>
</html>`;
  };

  const openRazorpayWeb = (paymentOrder: any) => {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        const options = {
          key: paymentOrder.keyId,
          amount: paymentOrder.amount,
          currency: paymentOrder.currency,
          name: "ShopEase",
          description: "Order Payment",
          order_id: paymentOrder.orderId,
          handler: async (response: any) => {
            try {
              const verifyRes = await apiFetch("/api/payment/verify", {
                method: "POST",
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              if (verifyRes.verified) {
                orderMutation.mutate({
                  items: orderItems,
                  totalAmount: total,
                  paymentMethod,
                  paymentStatus: "paid",
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  shippingAddress: address,
                  skipCartClear: isBuyNow,
                });
              } else {
                Alert.alert("Payment Failed", "Payment verification failed.");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
            resolve();
          },
          modal: {
            ondismiss: () => { resolve(); },
          },
          prefill: {
            name: address.fullName,
            contact: address.phone,
          },
          theme: { color: Colors.primary },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          Alert.alert("Payment Failed", response.error.description || "Payment was not completed.");
          resolve();
        });
        rzp.open();
      };
      script.onerror = () => reject(new Error("Failed to load payment gateway"));
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async () => {
    const addrError = validateAddress();
    if (addrError) {
      Alert.alert("Missing Info", addrError);
      return;
    }

    if (orderItems.length === 0) {
      Alert.alert("Error", "No items to order");
      return;
    }

    if (paymentMethod === "cod") {
      orderMutation.mutate({
        items: orderItems,
        totalAmount: total,
        paymentMethod: "cod",
        paymentStatus: "pending",
        shippingAddress: address,
        skipCartClear: isBuyNow,
      });
    } else {
      setIsProcessingPayment(true);
      try {
        const paymentOrder = await apiFetch("/api/payment/create-order", {
          method: "POST",
          body: JSON.stringify({ amount: total }),
        });

        if (Platform.OS === "web") {
          await openRazorpayWeb(paymentOrder);
        } else {
          const html = buildRazorpayHtml(paymentOrder);
          setRazorpayHtml(html);
          setShowRazorpay(true);
        }
      } catch (err: any) {
        Alert.alert("Payment Error", err.message || "Could not initiate payment");
      } finally {
        setIsProcessingPayment(false);
      }
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "payment_success") {
        setShowRazorpay(false);
        setIsProcessingPayment(true);

        const verifyRes = await apiFetch("/api/payment/verify", {
          method: "POST",
          body: JSON.stringify({
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          }),
        });

        if (verifyRes.verified) {
          orderMutation.mutate({
            items: orderItems,
            totalAmount: total,
            paymentMethod,
            paymentStatus: "paid",
            razorpayOrderId: data.razorpay_order_id,
            razorpayPaymentId: data.razorpay_payment_id,
            shippingAddress: address,
            skipCartClear: isBuyNow,
          });
        } else {
          Alert.alert("Payment Failed", "Payment verification failed. Please try again.");
        }
        setIsProcessingPayment(false);
      } else if (data.type === "payment_failed") {
        setShowRazorpay(false);
        Alert.alert("Payment Failed", data.error || "Payment was not completed.");
      } else if (data.type === "payment_cancelled") {
        setShowRazorpay(false);
      }
    } catch (e) {
      setShowRazorpay(false);
    }
  };

  if (!isBuyNow && cartQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const paymentMethods = [
    { id: "cod", label: "Cash on Delivery", icon: "cash-outline" as const, iconSet: "ionicons" },
    { id: "gpay", label: "Google Pay (UPI)", icon: "google", iconSet: "fa5" },
    { id: "phonepe", label: "PhonePe (UPI)", icon: "mobile-alt", iconSet: "fa5" },
    { id: "debit_card", label: "Debit Card", icon: "card-outline" as const, iconSet: "ionicons" },
    { id: "credit_card", label: "Credit Card", icon: "card" as const, iconSet: "ionicons" },
  ];

  const isOnlinePayment = paymentMethod !== "cod";

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            {displayItems.map((item: any, index: number) => {
              const itemPrice = isBuyNow ? buyNowProduct!.price : (item.product?.discountPrice || item.product?.price || 0);
              const itemQty = isBuyNow ? buyNowQty : item.quantity;
              return (
                <View key={item.id || index} style={styles.itemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {itemQty}x {isBuyNow ? params.productTitle : item.product?.title}
                    </Text>
                    {(isBuyNow ? params.size : item.size) ? (
                      <Text style={styles.itemSize}>Size: {isBuyNow ? params.size : item.size}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemPrice}>
                    {formatINR(itemPrice * itemQty)}
                  </Text>
                </View>
              );
            })}
            {isBuyNow && (
              <View style={styles.qtyRow}>
                <Text style={styles.qtyLabel}>Quantity</Text>
                <View style={styles.qtySelector}>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => setBuyNowQty(Math.max(1, buyNowQty - 1))}
                  >
                    <Ionicons name="remove" size={18} color={Colors.text} />
                  </Pressable>
                  <Text style={styles.qtyText}>{buyNowQty}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    onPress={() => setBuyNowQty(buyNowQty + 1)}
                  >
                    <Ionicons name="add" size={18} color={Colors.text} />
                  </Pressable>
                </View>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>{formatINR(total)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.shippingHeader}>
              <Text style={styles.sectionTitle}>Shipping Address</Text>
              {addressLoaded && address.addressLine1 ? (
                <View style={styles.autoFillBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                  <Text style={styles.autoFillText}>Auto-filled</Text>
                </View>
              ) : null}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={Colors.textLight}
              value={address.fullName}
              onChangeText={(t) => setAddress({ ...address, fullName: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor={Colors.textLight}
              keyboardType="phone-pad"
              value={address.phone}
              onChangeText={(t) => setAddress({ ...address, phone: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Address Line 1"
              placeholderTextColor={Colors.textLight}
              value={address.addressLine1}
              onChangeText={(t) => setAddress({ ...address, addressLine1: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Address Line 2 (Optional)"
              placeholderTextColor={Colors.textLight}
              value={address.addressLine2}
              onChangeText={(t) => setAddress({ ...address, addressLine2: t })}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="City"
                placeholderTextColor={Colors.textLight}
                value={address.city}
                onChangeText={(t) => setAddress({ ...address, city: t })}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="State"
                placeholderTextColor={Colors.textLight}
                value={address.state}
                onChangeText={(t) => setAddress({ ...address, state: t })}
              />
            </View>
            <TextInput
              style={[styles.input, { width: "50%" }]}
              placeholder="Pincode"
              placeholderTextColor={Colors.textLight}
              keyboardType="number-pad"
              value={address.pincode}
              onChangeText={(t) => setAddress({ ...address, pincode: t })}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            {paymentMethods.map((method) => (
              <Pressable
                key={method.id}
                style={[styles.paymentOption, paymentMethod === method.id && styles.paymentOptionActive]}
                onPress={() => setPaymentMethod(method.id)}
              >
                {method.iconSet === "fa5" ? (
                  <FontAwesome5
                    name={method.icon}
                    size={20}
                    color={paymentMethod === method.id ? Colors.primary : Colors.textSecondary}
                  />
                ) : (
                  <Ionicons
                    name={method.icon as any}
                    size={22}
                    color={paymentMethod === method.id ? Colors.primary : Colors.textSecondary}
                  />
                )}
                <Text
                  style={[
                    styles.paymentLabel,
                    paymentMethod === method.id && styles.paymentLabelActive,
                  ]}
                >
                  {method.label}
                </Text>
                <Ionicons
                  name={paymentMethod === method.id ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={paymentMethod === method.id ? Colors.primary : Colors.textLight}
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.placeOrderBtn, pressed && { opacity: 0.9 }]}
          onPress={handlePlaceOrder}
          disabled={orderMutation.isPending || isProcessingPayment}
        >
          {orderMutation.isPending || isProcessingPayment ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.placeOrderText}>
              {isOnlinePayment ? `Pay ${formatINR(total)}` : `Place Order - ${formatINR(total)}`}
            </Text>
          )}
        </Pressable>
      </View>

      {Platform.OS !== "web" && (
        <Modal visible={showRazorpay} animationType="slide" onRequestClose={() => setShowRazorpay(false)}>
          <View style={[styles.webviewContainer, { paddingTop: insets.top }]}>
            <View style={styles.webviewHeader}>
              <Pressable onPress={() => setShowRazorpay(false)} style={styles.webviewClose}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </Pressable>
              <Text style={styles.webviewTitle}>Payment</Text>
              <View style={{ width: 40 }} />
            </View>
            {razorpayHtml && WebView ? (
              <WebView
                source={{ html: razorpayHtml }}
                onMessage={handleWebViewMessage}
                javaScriptEnabled
                domStorageEnabled
                style={{ flex: 1 }}
                originWhitelist={["*"]}
              />
            ) : null}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  shippingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  autoFillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  autoFillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  itemSize: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.primary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  qtyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  qtyLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  qtySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 8,
    gap: 10,
    paddingHorizontal: 4,
    height: 36,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    minWidth: 16,
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  input: {
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
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: "#F0FDF4",
  },
  paymentLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  paymentLabelActive: {
    color: Colors.text,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 20,
  },
  placeOrderBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  placeOrderText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  webviewClose: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  webviewTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
});
