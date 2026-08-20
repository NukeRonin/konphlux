import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const EXAMPLES = [
  "My bicycle chain keeps slipping",
  "A dripping kitchen tap",
  "Laptop won't hold a charge",
  "Squeaky door hinge",
];

export default function RepairGuy() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [problem, setProblem] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ask = async () => {
    const p = problem.trim();
    if (p.length < 3) {
      setError("Describe the problem so Repair Guy can help.");
      return;
    }
    setBusy(true);
    setError("");
    setSteps("");
    try {
      const res = await api.bbRepair(p);
      setSteps(res.steps);
    } catch {
      setError("Repair Guy is busy at the workbench. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} onPress={() => router.back()} testID="repair-back" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Repair Guy</Text>
          <Eyebrow>Fix it yourself</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <View style={[styles.intro, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="wrench" size={22} color={colors.brand} />
          <Text style={[styles.introText, { color: colors.onSurface }]}>Describe what&apos;s broken and I&apos;ll walk you through fixing it, step by step.</Text>
        </View>

        <TextInput
          testID="repair-input"
          value={problem}
          onChangeText={setProblem}
          placeholder="What needs fixing?"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
        />

        <View style={styles.exRow}>
          {EXAMPLES.map((e) => (
            <Text key={e} testID={`ex-${e}`} onPress={() => setProblem(e)} style={[styles.exChip, { backgroundColor: colors.surfaceTertiary, color: colors.brand }]}>
              {e}
            </Text>
          ))}
        </View>

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label="Get repair steps" fullWidth loading={busy} onPress={ask} testID="repair-ask" style={{ marginTop: spacing.md }} />

        {steps ? (
          <View style={[styles.result, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.resultHead}>
              <MaterialCommunityIcons name="clipboard-list" size={18} color={colors.brand} />
              <Text style={[styles.resultTitle, { color: colors.onSurface }]}>Repair Guy says</Text>
            </View>
            <Text style={[styles.resultText, { color: colors.onSurface }]}>{steps}</Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  intro: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
  introText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 96, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  exRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  exChip: { fontFamily: fonts.bodyMedium, fontSize: 12, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6, overflow: "hidden" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.sm },
  result: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  resultText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
});
