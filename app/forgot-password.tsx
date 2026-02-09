import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "@/lib/api";
import Colors from "@/constants/colors";

type Step = "email" | "otp" | "reset";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSendOtp() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      Alert.alert("OTP Sent", "Check your email for the verification code");
      setStep("otp");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otp.trim() || otp.length < 6) {
      Alert.alert("Error", "Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });
      if (res.verified) {
        setStep("reset");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), newPassword }),
      });
      Alert.alert("Success", "Your password has been reset successfully!", [
        { text: "Sign In", onPress: () => router.replace("/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  const stepTitle = step === "email" ? "Forgot Password" : step === "otp" ? "Verify OTP" : "New Password";
  const stepSubtitle =
    step === "email"
      ? "Enter your email to receive a verification code"
      : step === "otp"
      ? `We sent a 6-digit code to ${email}`
      : "Create a new password for your account";

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
      </Pressable>

      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons
            name={step === "email" ? "mail-outline" : step === "otp" ? "keypad-outline" : "lock-closed-outline"}
            size={36}
            color={Colors.white}
          />
        </View>
        <Text style={styles.title}>{stepTitle}</Text>
        <Text style={styles.subtitle}>{stepSubtitle}</Text>
      </View>

      <View style={styles.stepIndicator}>
        {(["email", "otp", "reset"] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <View style={[styles.stepDot, (step === s || (["email", "otp", "reset"].indexOf(step) > i)) && styles.stepDotActive]}>
              {["email", "otp", "reset"].indexOf(step) > i ? (
                <Ionicons name="checkmark" size={14} color={Colors.white} />
              ) : (
                <Text style={[styles.stepNum, (step === s) && styles.stepNumActive]}>{i + 1}</Text>
              )}
            </View>
            {i < 2 && (
              <View style={[styles.stepLine, ["email", "otp", "reset"].indexOf(step) > i && styles.stepLineActive]} />
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={styles.form}>
        {step === "email" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>
        )}

        {step === "otp" && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="keypad-outline" size={20} color={Colors.textSecondary} />
              <TextInput
                style={[styles.input, { letterSpacing: 8, fontSize: 22, fontFamily: "Inter_600SemiBold" }]}
                placeholder="000000"
                placeholderTextColor={Colors.textLight}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <Pressable onPress={handleSendOtp} disabled={loading}>
              <Text style={styles.resendText}>Didn't receive? Resend OTP</Text>
            </Pressable>
          </View>
        )}

        {step === "reset" && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Min 6 characters"
                  placeholderTextColor={Colors.textLight}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textSecondary} />
                </Pressable>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={Colors.textLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={step === "email" ? handleSendOtp : step === "otp" ? handleVerifyOtp : handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>
              {step === "email" ? "Send OTP" : step === "otp" ? "Verify" : "Reset Password"}
            </Text>
          )}
        </Pressable>

        <Pressable style={styles.backToLogin} onPress={() => router.replace("/login")}>
          <Ionicons name="arrow-back" size={16} color={Colors.primary} />
          <Text style={styles.backToLoginText}>Back to Sign In</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center", marginTop: 8 },
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 24 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSecondary, textAlign: "center" },
  stepIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 32, paddingHorizontal: 40 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  stepDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNum: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: Colors.textSecondary },
  stepNumActive: { color: Colors.white },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.primary },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.text },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    gap: 10,
    height: 52,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text, height: "100%" },
  resendText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.primary, marginTop: 4 },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.white },
  backToLogin: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
  },
  backToLoginText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.primary },
});
