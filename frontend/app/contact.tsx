import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function ContactUs() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [username, setUsername] = useState(user?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = username.trim() && emailOk && subject.trim() && message.trim();

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true); setError("");
    try {
      await api.contactUs({ username: username.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
      setSent(true);
    } catch (e: any) { setError(e?.message || "Couldn't send. Please try again."); }
    finally { setSending(false); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="contact-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Contact Us</Text>
          <Eyebrow>We&apos;d love to hear from you</Eyebrow>
        </View>
      </View>

      {sent ? (
        <View style={styles.confirmWrap}>
          <View style={[styles.confirmCircle, { backgroundColor: `${colors.brand}22` }]}>
            <MaterialCommunityIcons name="check-circle" size={52} color={colors.brand} />
          </View>
          <Text style={[styles.confirmTitle, { color: colors.onSurface }]}>Message Sent</Text>
          <Text style={[styles.confirmSub, { color: colors.muted }]}>Thanks for reaching out — we&apos;ve received your message and will get back to you soon.</Text>
          <Pressable onPress={() => router.back()} style={[styles.sendBtn, { backgroundColor: colors.brand, minWidth: 200 }]} testID="contact-done">
            <Text style={[styles.sendText, { color: colors.onBrandPrimary }]}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: colors.muted }]}>Have a question, idea, or issue? Send us a note and we&apos;ll reply by email.</Text>

          <Text style={[styles.label, { color: colors.onSurface }]}>Username</Text>
          <TextInput value={username} onChangeText={setUsername} placeholder="Your name" placeholderTextColor={colors.muted} style={inputStyle} testID="contact-username" />

          <Text style={[styles.label, { color: colors.onSurface }]}>Email Address</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={inputStyle} testID="contact-email" />

          <Text style={[styles.label, { color: colors.onSurface }]}>Subject</Text>
          <TextInput value={subject} onChangeText={setSubject} placeholder="What&apos;s this about?" placeholderTextColor={colors.muted} style={inputStyle} testID="contact-subject" />

          <Text style={[styles.label, { color: colors.onSurface }]}>Message</Text>
          <TextInput value={message} onChangeText={setMessage} placeholder="Tell us more…" placeholderTextColor={colors.muted} multiline style={[inputStyle, { minHeight: 130, textAlignVertical: "top", paddingTop: spacing.md }]} testID="contact-message" />

          {error ? <Text style={[styles.error, { color: "#E53E3E" }]}>{error}</Text> : null}

          <Pressable onPress={send} disabled={!canSend || sending} style={[styles.sendBtn, { backgroundColor: canSend ? colors.brand : colors.surfaceTertiary }]} testID="contact-send">
            <MaterialCommunityIcons name="send" size={18} color={canSend ? colors.onBrandPrimary : colors.muted} />
            <Text style={[styles.sendText, { color: canSend ? colors.onBrandPrimary : colors.muted }]}>{sending ? "Sending…" : "Send message"}</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: radius.md, marginTop: spacing.xl },
  sendText: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  confirmWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  confirmCircle: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  confirmTitle: { fontFamily: fonts.display, fontSize: 24 },
  confirmSub: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 320 },
});
