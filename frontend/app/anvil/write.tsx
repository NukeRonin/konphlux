import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATEGORIES = ["General", "Fantasy", "Mystery", "Romance", "Sci-Fi", "Horror", "Adventure", "Drama", "Comedy", "Poetry"];
const ASSISTS: { mode: string; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { mode: "idea", label: "Ideas", icon: "lightbulb-on" },
  { mode: "continue", label: "Continue", icon: "auto-fix" },
  { mode: "improve", label: "Improve", icon: "star-four-points" },
];

export default function Write() {
  const params = useLocalSearchParams<{ kind?: string; prompt?: string; category?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<"story" | "script">(params.kind === "script" ? "script" : "story");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(params.category && CATEGORIES.includes(params.category) ? params.category : "General");
  const [body, setBody] = useState(params.prompt ? `${params.prompt}\n\n` : "");
  const [openCowriting, setOpenCowriting] = useState(false);
  const [assistMode, setAssistMode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const assist = async (mode: string) => {
    if (assistMode) return;
    setError("");
    setAssistMode(mode);
    try {
      const res = await api.anvilAssist({ mode, kind, title, text: body });
      setBody((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${res.text}` : res.text));
    } catch (e: any) {
      setError(e?.message ?? "GenoScribe couldn't help right now.");
    } finally {
      setAssistMode(null);
    }
  };

  const submit = async () => {
    setError("");
    if (title.trim().length < 2) return setError("Give your work a title.");
    if (!body.trim()) return setError("Write something first — or ask GenoScribe for a hand.");
    setBusy(true);
    try {
      const work = await api.anvilCreate({ title: title.trim(), kind, category, body: body.trim(), open_cowriting: openCowriting });
      router.replace(`/anvil/work/${work.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't publish your work.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="write-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Write & Submit</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        {/* Kind */}
        <View style={styles.toggleRow}>
          {(["story", "script"] as const).map((k) => (
            <Pressable key={k} testID={`write-kind-${k}`} onPress={() => setKind(k)} style={[styles.toggle, { backgroundColor: kind === k ? colors.brand : colors.surfaceSecondary, borderColor: kind === k ? colors.brand : colors.border }]}>
              <MaterialCommunityIcons name={k === "script" ? "script-text" : "book-open-variant"} size={16} color={kind === k ? colors.onBrandPrimary : colors.brand} />
              <Text style={[styles.toggleText, { color: kind === k ? colors.onBrandPrimary : colors.onSurface }]}>{k === "script" ? "Script" : "Story"}</Text>
            </Pressable>
          ))}
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>Title</Eyebrow>
        <TextInput testID="write-title" value={title} onChangeText={setTitle} placeholder="Name your work" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} maxLength={160} />

        <Eyebrow style={{ marginTop: spacing.lg }}>Category</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`write-cat-${c}`} onPress={() => setCategory(c)} style={[styles.chip, { backgroundColor: category === c ? colors.brand : colors.surfaceSecondary, borderColor: category === c ? colors.brand : colors.border }]}>
              <Text style={[styles.chipText, { color: category === c ? colors.onBrandPrimary : colors.onSurface }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.bodyHead}>
          <Eyebrow>Your writing</Eyebrow>
          <View style={styles.assistRow}>
            {ASSISTS.map((a) => (
              <Pressable key={a.mode} testID={`assist-${a.mode}`} onPress={() => assist(a.mode)} disabled={!!assistMode} style={[styles.assistChip, { backgroundColor: colors.surfaceTertiary, opacity: assistMode && assistMode !== a.mode ? 0.5 : 1 }]}>
                <MaterialCommunityIcons name={assistMode === a.mode ? "loading" : a.icon} size={13} color={colors.brandSecondary} />
                <Text style={[styles.assistText, { color: colors.brand }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={[styles.genoHint, { color: colors.muted }]}>AI assist</Text>
        <TextInput testID="write-body" value={body} onChangeText={setBody} placeholder="Once upon a foggy evening…" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />

        <View style={[styles.cowriteRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cowriteTitle, { color: colors.onSurface }]}>Open for co-writing</Text>
            <Text style={[styles.cowriteSub, { color: colors.muted }]}>Let others add passages to your work.</Text>
          </View>
          <Switch testID="write-cowriting" value={openCowriting} onValueChange={setOpenCowriting} trackColor={{ true: colors.brand, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
        </View>

        {error ? <Text testID="write-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton label="Publish" fullWidth size="lg" loading={busy} onPress={submit} testID="write-submit" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
  body: { padding: spacing.lg },
  toggleRow: { flexDirection: "row", gap: spacing.sm },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1 },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.body, fontSize: 16, marginTop: spacing.sm },
  multiline: { minHeight: 200, textAlignVertical: "top" },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  bodyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  assistRow: { flexDirection: "row", gap: 6 },
  assistChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  assistText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  genoHint: { fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  cowriteRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  cowriteTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  cowriteSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
