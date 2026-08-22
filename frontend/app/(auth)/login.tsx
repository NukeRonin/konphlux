import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { BrassText, Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Gear } from "@/src/components/Gear";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export function AuthField({
  icon,
  ...props
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
} & React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.field, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.brand} />
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.onSurface }]}
        {...props}
      />
    </View>
  );
}

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password, remember);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't sign in. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <Gear size={280} opacity={0.06} style={{ right: -90, top: insets.top - 20 }} />
      <Gear size={160} opacity={0.06} reverse style={{ left: -50, top: insets.top + 220 }} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxxl }]}
        bottomOffset={40}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={colors.brassGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.badge, { borderColor: colors.brandSecondary }]}
        >
          <MaterialCommunityIcons name="cog" size={36} color={colors.onBrandPrimary} />
        </LinearGradient>
        <Eyebrow style={{ marginTop: spacing.xl }}>Welcome to</Eyebrow>
        <BrassText size={44}>Konphlux</BrassText>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Enter with your Konphlux ID to reach every district.
        </Text>

        <View style={styles.form}>
          <AuthField
            icon="email-outline"
            placeholder="Email"
            testID="login-email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AuthField
            icon="lock-outline"
            placeholder="Password"
            testID="login-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text testID="login-error" style={[styles.error, { color: colors.error }]}>
              {error}
            </Text>
          ) : null}
          <View style={styles.rememberRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rememberLabel, { color: colors.onSurface }]}>Stay Signed In</Text>
              <Text style={[styles.rememberHint, { color: colors.muted }]}>Keep me logged in on this device</Text>
            </View>
            <Switch
              testID="login-remember"
              value={remember}
              onValueChange={setRemember}
              trackColor={{ true: colors.brand, false: colors.borderStrong }}
              thumbColor={colors.surface}
            />
          </View>
          <ForgeButton
            label="Enter"
            fullWidth
            size="lg"
            loading={busy}
            onPress={submit}
            testID="login-submit"
            style={{ marginTop: spacing.sm }}
          />
        </View>

        <Pressable style={styles.footer} testID="go-register" onPress={() => router.push("/(auth)/register")}>
          <Text style={[styles.footerText, { color: colors.muted }]}>New to Konphlux? </Text>
          <Text style={[styles.footerLink, { color: colors.brand }]}>Forge your ID</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, alignItems: "flex-start" },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  form: { alignSelf: "stretch", marginTop: spacing.xxl, gap: spacing.md },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 54,
  },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  rememberLabel: { fontFamily: fonts.bodyBold, fontSize: 15 },
  rememberHint: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  footer: { flexDirection: "row", alignItems: "center", alignSelf: "center", marginTop: spacing.xxl },
  footerText: { fontFamily: fonts.body, fontSize: 14 },
  footerLink: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
