import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const WILL_LOSE = [
  "Your profile, friends and messages",
  "Posts, articles, listings and reviews you created",
  "Vault items, creations and saved collections",
  "Wallet balance, orders, bookings and job activity",
];

export default function DeleteAccount() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canDelete = password.trim().length > 0 && confirm.trim().toUpperCase() === "DELETE";

  const del = async () => {
    if (!canDelete || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteAccount(password);
      // Account is gone — clear the session and return to the auth gate.
      await signOut();
      router.replace("/(auth)/login");
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setError("That password is incorrect. Please try again.");
      } else {
        setError((e as Error)?.message || "Couldn't delete your account. Please try again.");
      }
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="delete-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Delete Account</Text>
          <Eyebrow>This action is permanent</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={[styles.warnCard, { backgroundColor: `${colors.error}14`, borderColor: `${colors.error}55` }]}>
          <MaterialCommunityIcons name="alert-octagon-outline" size={22} color={colors.error} />
          <Text style={[styles.warnText, { color: colors.onSurface }]}>
            Deleting your account is permanent and cannot be undone. You will lose:
          </Text>
        </View>

        <View style={{ marginTop: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
          {WILL_LOSE.map((w) => (
            <View key={w} style={styles.bullet}>
              <MaterialCommunityIcons name="circle-small" size={20} color={colors.muted} />
              <Text style={[styles.bulletText, { color: colors.muted }]}>{w}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Confirm your password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Current password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          style={inputStyle}
          testID="delete-password"
        />

        <Text style={[styles.label, { color: colors.onSurface }]}>Type DELETE to confirm</Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="DELETE"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={inputStyle}
          testID="delete-confirm"
        />

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <Pressable
          onPress={del}
          disabled={!canDelete || busy}
          style={[styles.deleteBtn, { backgroundColor: canDelete ? colors.error : colors.surfaceTertiary }]}
          testID="delete-confirm-btn"
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={canDelete ? "#FFFFFF" : colors.muted} />
          <Text style={[styles.deleteText, { color: canDelete ? "#FFFFFF" : colors.muted }]}>
            {busy ? "Deleting…" : "Permanently delete my account"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancelBtn} testID="delete-cancel">
          <Text style={[styles.cancelText, { color: colors.brand }]}>Cancel</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  warnCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, marginTop: spacing.md },
  warnText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14.5, lineHeight: 21 },
  bullet: { flexDirection: "row", alignItems: "flex-start" },
  bulletText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: radius.md, marginTop: spacing.xl },
  deleteText: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
  cancelBtn: { alignItems: "center", justifyContent: "center", height: 48, marginTop: spacing.sm },
  cancelText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
