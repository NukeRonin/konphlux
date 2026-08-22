import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { authenticateBiometric, biometricAvailable } from "@/src/utils/biometric";
import { isTreasuryUnlocked, markTreasuryUnlocked } from "@/src/utils/treasuryLock";

type Step = "loading" | "biometric" | "bio-failed" | "bio-unavailable" | "pin" | "unlocked";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function TreasuryGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("loading");
  const [method, setMethod] = useState("none");
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const unlock = useCallback(() => { markTreasuryUnlocked(); setStep("unlocked"); }, []);

  const runBiometric = useCallback(async (m: string, hp: boolean) => {
    setError("");
    const avail = await biometricAvailable();
    if (!avail) {
      if (m === "both" && hp) { setNote("Biometrics aren't available here — enter your PIN to continue."); setStep("pin"); }
      else { setStep("bio-unavailable"); }
      return;
    }
    const ok = await authenticateBiometric();
    if (ok) { if (m === "both") setStep("pin"); else unlock(); }
    else setStep("bio-failed");
  }, [unlock]);

  const begin = useCallback(async () => {
    setPin(""); setError(""); setNote("");
    try {
      const s = await api.treasurySecurity();
      setMethod(s.method); setHasPin(s.has_pin);
      if (s.method === "none") { setStep("unlocked"); return; }
      if (isTreasuryUnlocked()) { setStep("unlocked"); return; }
      if (s.method === "biometric" || s.method === "both") { setStep("biometric"); runBiometric(s.method, s.has_pin); }
      else setStep("pin");
    } catch { setStep("unlocked"); /* fail open on settings error — API still auth-guarded */ }
  }, [runBiometric]);

  useFocusEffect(useCallback(() => { begin(); }, [begin]));

  const submitPin = useCallback(async (value: string) => {
    try { await api.treasuryVerifyPin(value); unlock(); }
    catch (e: any) { setError(e?.message || "Incorrect PIN"); setPin(""); }
  }, [unlock]);

  const onKey = (k: string) => {
    setError("");
    if (k === "del") { setPin((p) => p.slice(0, -1)); return; }
    if (k === "") return;
    setPin((p) => (p.length >= 6 ? p : p + k));
  };

  if (step === "unlocked") return <>{children}</>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.center}>
        {step === "loading" ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <>
            <View style={[styles.lockCircle, { backgroundColor: `${colors.brand}22` }]}>
              <MaterialCommunityIcons name={step === "pin" ? "form-textbox-password" : "fingerprint"} size={38} color={colors.brand} />
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>Treasury is locked</Text>

            {step === "biometric" ? (
              <>
                <Text style={[styles.sub, { color: colors.muted }]}>Authenticating…</Text>
                <Pressable onPress={() => runBiometric(method, hasPin)} style={[styles.btn, { backgroundColor: colors.brand }]} testID="gate-biometric">
                  <MaterialCommunityIcons name="fingerprint" size={18} color={colors.onBrandPrimary} />
                  <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>Use biometrics</Text>
                </Pressable>
              </>
            ) : null}

            {step === "bio-failed" ? (
              <>
                <Text style={[styles.sub, { color: colors.muted }]}>Biometric check didn&apos;t pass.</Text>
                <Pressable onPress={() => { setStep("biometric"); runBiometric(method, hasPin); }} style={[styles.btn, { backgroundColor: colors.brand }]} testID="gate-retry-bio">
                  <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>Try again</Text>
                </Pressable>
                {hasPin ? (
                  <Pressable onPress={() => setStep("pin")} style={styles.linkBtn} testID="gate-use-pin">
                    <Text style={[styles.linkText, { color: colors.brand }]}>Use PIN instead</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {step === "bio-unavailable" ? (
              <>
                <Text style={[styles.sub, { color: colors.muted }]}>Biometrics can&apos;t be verified in this preview. On a real device build they&apos;ll work as expected.</Text>
                <Pressable onPress={unlock} style={[styles.btn, { backgroundColor: colors.brand }]} testID="gate-continue">
                  <Text style={[styles.btnText, { color: colors.onBrandPrimary }]}>Continue</Text>
                </Pressable>
              </>
            ) : null}

            {step === "pin" ? (
              <>
                {note ? <Text style={[styles.sub, { color: colors.muted }]}>{note}</Text> : <Text style={[styles.sub, { color: colors.muted }]}>Enter your PIN</Text>}
                <View style={styles.dots}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={[styles.dot, { borderColor: colors.border, backgroundColor: i < pin.length ? colors.brand : "transparent" }]} />
                  ))}
                </View>
                {error ? <Text style={[styles.error, { color: "#E53E3E" }]}>{error}</Text> : null}
                <View style={styles.pad}>
                  {KEYS.map((k, idx) => (
                    <Pressable key={idx} onPress={() => onKey(k)} disabled={k === ""} style={[styles.key, k === "" && { opacity: 0 }, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID={`gate-key-${k || "blank"}`}>
                      {k === "del" ? <MaterialCommunityIcons name="backspace-outline" size={22} color={colors.onSurface} /> : <Text style={[styles.keyText, { color: colors.onSurface }]}>{k}</Text>}
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => submitPin(pin)} disabled={pin.length < 4} style={[styles.btn, { backgroundColor: pin.length >= 4 ? colors.brand : colors.surfaceTertiary }]} testID="gate-pin-submit">
                  <Text style={[styles.btnText, { color: pin.length >= 4 ? colors.onBrandPrimary : colors.muted }]}>Unlock</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  lockCircle: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 22 },
  sub: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: spacing.sm, lineHeight: 20, maxWidth: 300 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, minWidth: 200, paddingHorizontal: spacing.xl, borderRadius: radius.md, marginTop: spacing.lg },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  linkBtn: { marginTop: spacing.md, padding: spacing.sm },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  dots: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.md, marginTop: spacing.xl, maxWidth: 260 },
  key: { width: 72, height: 60, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: fonts.display, fontSize: 24 },
});
