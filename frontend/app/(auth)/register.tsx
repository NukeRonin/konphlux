import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import { useAuth } from "@/src/auth/AuthContext";
import { BrassText, Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Gear } from "@/src/components/Gear";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { AuthField, styles as loginStyles } from "./login";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError("Fill every field. Password needs 6+ characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signUp(email.trim(), password, name.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create your ID. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[loginStyles.screen, { backgroundColor: colors.surface }]}>
      <Gear size={260} opacity={0.06} style={{ left: -90, top: insets.top }} />
      <KeyboardAwareScrollView
        contentContainerStyle={[loginStyles.content, { paddingTop: insets.top + spacing.xxl }]}
        bottomOffset={40}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={colors.brassGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[loginStyles.badge, { borderColor: colors.brandSecondary }]}
        >
          <MaterialCommunityIcons name="card-account-details-outline" size={34} color={colors.onBrandPrimary} />
        </LinearGradient>
        <Eyebrow style={{ marginTop: spacing.xl }}>Forge your</Eyebrow>
        <BrassText size={40}>Konphlux ID</BrassText>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          One identity across every district — social, market, studio and more.
        </Text>

        <View style={loginStyles.form}>
          <AuthField
            icon="account-outline"
            placeholder="Display name"
            testID="register-name"
            value={name}
            onChangeText={setName}
          />
          <AuthField
            icon="email-outline"
            placeholder="Email"
            testID="register-email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <AuthField
            icon="lock-outline"
            placeholder="Password (6+ characters)"
            testID="register-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text testID="register-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <ForgeButton
            label="Forge my ID"
            fullWidth
            size="lg"
            loading={busy}
            onPress={submit}
            testID="register-submit"
            style={{ marginTop: spacing.sm }}
          />
        </View>

        <Pressable style={styles.footer} testID="go-login" onPress={() => router.push("/(auth)/login")}>
          <Text style={[styles.footerText, { color: colors.muted }]}>Already enrolled? </Text>
          <Text style={[styles.footerLink, { color: colors.brand }]}>Enter here</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#8B3A3A" },
  footer: { flexDirection: "row", alignItems: "center", alignSelf: "center", marginTop: spacing.xxl },
  footerText: { fontFamily: fonts.body, fontSize: 14 },
  footerLink: { fontFamily: fonts.bodyBold, fontSize: 14 },
  _r: { borderRadius: radius.md },
});
