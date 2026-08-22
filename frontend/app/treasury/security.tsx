import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { biometricAvailable } from "@/src/utils/biometric";
import { lockTreasury } from "@/src/utils/treasuryLock";

type Method = "none" | "pin" | "biometric" | "both";
const OPTIONS: { key: Method; label: string; desc: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { key: "none", label: "Neither", desc: "Open Treasury without extra checks", icon: "lock-open-variant-outline" },
  { key: "pin", label: "PIN only", desc: "Require a 4–6 digit PIN", icon: "form-textbox-password" },
  { key: "biometric", label: "Biometrics only", desc: "Face ID / fingerprint", icon: "fingerprint" },
  { key: "both", label: "PIN + Biometrics", desc: "Require both to unlock", icon: "shield-lock" },
];

export default function TreasurySecurity() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<Method>("none");
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [bioOk, setBioOk] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.treasurySecurity();
        setMethod(s.method as Method); setHasPin(s.has_pin);
      } catch { /* ignore */ }
      setBioOk(await biometricAvailable());
      setLoading(false);
    })();
  }, []);

  const needsPin = method === "pin" || method === "both";
  const needsNewPin = needsPin && !hasPin; // must set a PIN if none exists yet

  const save = async () => {
    if (saving) return;
    let pinToSend: string | undefined;
    if (needsPin && (pin || needsNewPin)) {
      if (!/^\d{4,6}$/.test(pin)) { Alert.alert("Invalid PIN", "Enter a 4–6 digit PIN."); return; }
      if (pin !== confirm) { Alert.alert("PINs don't match", "Please re-enter the same PIN."); return; }
      pinToSend = pin;
    }
    setSaving(true);
    try {
      const res = await api.treasurySetSecurity(method, pinToSend);
      setHasPin(res.has_pin); setPin(""); setConfirm("");
      lockTreasury(); // force re-verify next time Treasury opens
      Alert.alert("Saved", method === "none" ? "Treasury will open without extra checks." : "Treasury will now ask for verification each time it's opened.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) { Alert.alert("Couldn't save", e?.message || "Try again."); }
    finally { setSaving(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="sec-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Security Settings</Text>
          <Eyebrow>Treasury access</Eyebrow>
        </View>
      </View>

      {loading ? (
        <Loading label="Loading…" />
      ) : (
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: colors.muted }]}>Choose how Treasury should be unlocked. When enabled, you&apos;ll be asked to verify every time you open the district.</Text>

          {OPTIONS.map((o) => {
            const on = method === o.key;
            return (
              <Pressable key={o.key} onPress={() => setMethod(o.key)} style={[styles.option, { backgroundColor: colors.surfaceSecondary, borderColor: on ? colors.brand : colors.border }]} testID={`sec-opt-${o.key}`}>
                <View style={[styles.optIcon, { backgroundColor: `${colors.brand}22` }]}>
                  <MaterialCommunityIcons name={o.icon} size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optLabel, { color: colors.onSurface }]}>{o.label}</Text>
                  <Text style={[styles.optDesc, { color: colors.muted }]}>{o.desc}</Text>
                </View>
                <MaterialCommunityIcons name={on ? "radiobox-marked" : "radiobox-blank"} size={22} color={on ? colors.brand : colors.muted} />
              </Pressable>
            );
          })}

          {(method === "biometric" || method === "both") && !bioOk ? (
            <View style={[styles.warn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.muted} />
              <Text style={[styles.warnText, { color: colors.muted }]}>No biometrics detected on this device/preview. It works on a real device build; {method === "both" ? "your PIN still applies here." : "consider PIN too."}</Text>
            </View>
          ) : null}

          {needsPin ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={[styles.label, { color: colors.onSurface }]}>{hasPin ? "Change PIN (leave blank to keep current)" : "Set a PIN"}</Text>
              <TextInput value={pin} onChangeText={(t) => setPin(t.replace(/[^\d]/g, "").slice(0, 6))} placeholder="4–6 digits" placeholderTextColor={colors.muted} keyboardType="number-pad" secureTextEntry style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="sec-pin" />
              <TextInput value={confirm} onChangeText={(t) => setConfirm(t.replace(/[^\d]/g, "").slice(0, 6))} placeholder="Confirm PIN" placeholderTextColor={colors.muted} keyboardType="number-pad" secureTextEntry style={[styles.input, { marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="sec-pin-confirm" />
            </View>
          ) : null}

          <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.brand }]} testID="sec-save">
            <Text style={[styles.saveText, { color: colors.onBrandPrimary }]}>{saving ? "Saving…" : "Save security settings"}</Text>
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
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, marginBottom: spacing.lg },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginBottom: spacing.sm },
  optIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  optLabel: { fontFamily: fonts.bodyBold, fontSize: 15 },
  optDesc: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  warn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  warnText: { fontFamily: fonts.body, fontSize: 12.5, flex: 1, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginBottom: spacing.sm },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 16, letterSpacing: 4 },
  saveBtn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
  saveText: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
});
