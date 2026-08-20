import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Tool = "story" | "prompt" | "script";
const TOOLS: { key: Tool; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; post: string }[] = [
  { key: "story", label: "Story", icon: "book-open-variant", post: "Post to Stories" },
  { key: "prompt", label: "Prompt", icon: "lightbulb-on", post: "Post to Prompts" },
  { key: "script", label: "Script", icon: "script-text", post: "Post to Scripts" },
];
const GENRES = ["Fantasy", "Mystery", "Romance", "Sci-Fi", "Horror", "Adventure", "Drama", "Comedy"];
const TONES = ["Whimsical", "Dark", "Adventurous", "Romantic", "Humorous"];
const LENGTHS = [
  { key: "short", label: "Short" },
  { key: "medium", label: "Medium" },
];

export default function GenoScribe() {
  const params = useLocalSearchParams<{ tool?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tool, setTool] = useState<Tool>(params.tool === "prompt" || params.tool === "script" ? params.tool : "story");
  const [topic, setTopic] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState("short");
  const [generating, setGenerating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hasResult, setHasResult] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const meta = TOOLS.find((t) => t.key === tool)!;

  const switchTool = (t: Tool) => {
    setTool(t);
    setHasResult(false);
    setTitle("");
    setBody("");
    setError("");
  };

  const generate = async () => {
    if (!topic.trim() || generating) return;
    setError("");
    setGenerating(true);
    try {
      const res = await api.anvilGeno({ tool, topic: topic.trim(), tone, genre, length });
      setTitle(res.title);
      setBody(res.text);
      setHasResult(true);
    } catch (e: any) {
      setError(e?.message ?? "GenoScribe couldn't generate right now.");
    } finally {
      setGenerating(false);
    }
  };

  const post = async () => {
    setError("");
    if (!body.trim()) return;
    setPosting(true);
    try {
      if (tool === "prompt") {
        await api.anvilAddPrompt(body.trim());
        router.replace("/anvil/prompts");
      } else {
        const work = await api.anvilCreate({
          title: title.trim() || topic.trim().slice(0, 60),
          kind: tool,
          category: GENRES.includes(genre) ? genre : "General",
          body: body.trim(),
          open_cowriting: false,
        });
        router.replace(`/anvil/work/${work.id}`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post that. Try again.");
      setPosting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="geno-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>GenoScribe</Text>
          <Eyebrow>AI writing studio</Eyebrow>
        </View>
        <MaterialCommunityIcons name="auto-fix" size={22} color={colors.brandSecondary} />
      </View>

      {/* 3 divisions */}
      <View style={styles.tools}>
        {TOOLS.map((t) => (
          <Pressable key={t.key} testID={`geno-tool-${t.key}`} onPress={() => switchTool(t.key)} style={[styles.tool, { backgroundColor: tool === t.key ? colors.brand : colors.surfaceSecondary, borderColor: tool === t.key ? colors.brand : colors.border }]}>
            <MaterialCommunityIcons name={t.icon} size={18} color={tool === t.key ? colors.onBrandPrimary : colors.brand} />
            <Text style={[styles.toolText, { color: tool === t.key ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Eyebrow>{tool === "prompt" ? "What's the prompt about?" : `What's your ${tool} about?`}</Eyebrow>
        <TextInput
          testID="geno-topic"
          value={topic}
          onChangeText={setTopic}
          placeholder={tool === "prompt" ? "e.g. forgotten automatons" : "Describe your idea in a sentence or two…"}
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        />

        <Eyebrow style={{ marginTop: spacing.lg }}>Genre (optional)</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {GENRES.map((g) => (
            <Pressable key={g} testID={`geno-genre-${g}`} onPress={() => setGenre(genre === g ? "" : g)} style={[styles.chip, { backgroundColor: genre === g ? colors.brand : colors.surfaceSecondary, borderColor: genre === g ? colors.brand : colors.border }]}>
              <Text style={[styles.chipText, { color: genre === g ? colors.onBrandPrimary : colors.onSurface }]}>{g}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Eyebrow style={{ marginTop: spacing.md }}>Tone (optional)</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TONES.map((t) => (
            <Pressable key={t} testID={`geno-tone-${t}`} onPress={() => setTone(tone === t ? "" : t)} style={[styles.chip, { backgroundColor: tone === t ? colors.brand : colors.surfaceSecondary, borderColor: tone === t ? colors.brand : colors.border }]}>
              <Text style={[styles.chipText, { color: tone === t ? colors.onBrandPrimary : colors.onSurface }]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {tool !== "prompt" ? (
          <>
            <Eyebrow style={{ marginTop: spacing.md }}>Length</Eyebrow>
            <View style={styles.lenRow}>
              {LENGTHS.map((l) => (
                <Pressable key={l.key} testID={`geno-len-${l.key}`} onPress={() => setLength(l.key)} style={[styles.chip, { backgroundColor: length === l.key ? colors.brand : colors.surfaceSecondary, borderColor: length === l.key ? colors.brand : colors.border }]}>
                  <Text style={[styles.chipText, { color: length === l.key ? colors.onBrandPrimary : colors.onSurface }]}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <ForgeButton
          label={hasResult ? "Regenerate" : "Generate"}
          fullWidth
          size="lg"
          loading={generating}
          onPress={generate}
          testID="geno-generate"
          style={{ marginTop: spacing.lg }}
          icon={<MaterialCommunityIcons name="auto-fix" size={16} color={colors.onBrandPrimary} />}
        />

        {error ? <Text testID="geno-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        {hasResult ? (
          <View style={[styles.output, { borderColor: colors.brandSecondary, backgroundColor: colors.surfaceSecondary }]}>
            <Eyebrow style={{ marginBottom: spacing.sm }}>GenoScribe wrote · edit before posting</Eyebrow>
            {tool !== "prompt" ? (
              <TextInput
                testID="geno-title"
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={colors.muted}
                style={[styles.titleInput, { color: colors.onSurface, borderColor: colors.border }]}
              />
            ) : null}
            <TextInput
              testID="geno-output"
              value={body}
              onChangeText={setBody}
              multiline
              style={[styles.outputText, { color: colors.onSurface }]}
            />
            <ForgeButton
              label={meta.post}
              fullWidth
              loading={posting}
              onPress={post}
              testID="geno-post"
              style={{ marginTop: spacing.md }}
              icon={<MaterialCommunityIcons name="publish" size={16} color={colors.onBrandPrimary} />}
            />
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
  tools: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tool: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1 },
  toolText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  body: { padding: spacing.lg, paddingTop: 0 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.body, fontSize: 16, marginTop: spacing.sm },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  lenRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  output: { borderWidth: 1.5, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.lg },
  titleInput: { fontFamily: fonts.display, fontSize: 20, borderBottomWidth: 1, paddingBottom: spacing.sm, marginBottom: spacing.sm },
  outputText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, minHeight: 120, textAlignVertical: "top" },
});
