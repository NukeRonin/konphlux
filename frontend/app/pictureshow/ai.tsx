import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Kind = "video" | "animation";

export default function PSAiStudio() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<Kind>(params.kind === "animation" ? "animation" : "video");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ storyboard: string; poster_path: string } | null>(null);

  const generate = async () => {
    if (prompt.trim().length < 3) return setError("Describe your idea first.");
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await api.psAiConcept({ prompt: prompt.trim(), kind, style: style.trim() });
      setResult({ storyboard: res.storyboard, poster_path: res.poster_path });
    } catch {
      setError("The projection engine sputtered. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const posterUrl = result?.poster_path ? fileUrl(result.poster_path) : "";

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psai-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>AI Concept Studio</Text>
          <Eyebrow>Poster keyframe + storyboard</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        {/* Kind toggle */}
        <View style={styles.tabs}>
          {(["video", "animation"] as Kind[]).map((k) => (
            <Pressable key={k} testID={`psai-kind-${k}`} onPress={() => { setKind(k); setResult(null); }} style={[styles.tab, { backgroundColor: kind === k ? colors.brand : colors.surfaceSecondary, borderColor: kind === k ? colors.brand : colors.border }]}>
              <MaterialCommunityIcons name={k === "video" ? "movie-filter" : "animation-play"} size={16} color={kind === k ? colors.onBrandPrimary : colors.brand} />
              <Text style={[styles.tabText, { color: kind === k ? colors.onBrandPrimary : colors.onSurface }]}>{k === "video" ? "AI Video" : "AI Animation"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.note, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.muted} />
          <Text style={[styles.noteText, { color: colors.muted }]}>Generates an AI poster keyframe and a written storyboard/script you can turn into a real {kind}.</Text>
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Your concept</Text>
        <TextInput testID="psai-prompt" value={prompt} onChangeText={setPrompt} placeholder={kind === "video" ? "e.g. an airship race through storm clouds" : "e.g. a clockwork owl learns to fly"} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

        <Text style={[styles.label, { color: colors.onSurface }]}>Style (optional)</Text>
        <TextInput testID="psai-style" value={style} onChangeText={setStyle} placeholder={kind === "video" ? "cinematic, noir, sepia…" : "hand-drawn, claymation, cel-shaded…"} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label={result ? "Regenerate" : "Generate concept"} fullWidth loading={busy} onPress={generate} testID="psai-generate" style={{ marginTop: spacing.md }} />
        {busy ? <Text style={[styles.working, { color: colors.muted }]}>Painting the keyframe… this can take a moment.</Text> : null}

        {result ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" transition={300} />
            ) : (
              <View style={[styles.posterFallback, { backgroundColor: colors.surfaceTertiary }]}>
                <MaterialCommunityIcons name="image-off-outline" size={28} color={colors.muted} />
                <Text style={[styles.noteText, { color: colors.muted }]}>Poster couldn&apos;t be generated, but your storyboard is ready.</Text>
              </View>
            )}
            <View style={[styles.storyCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.storyText, { color: colors.onSurface }]}>{result.storyboard}</Text>
            </View>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  note: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  working: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.sm },
  poster: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md },
  posterFallback: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg },
  storyCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  storyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
});
