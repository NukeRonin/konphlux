import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATEGORIES = ["General", "Technology", "Life & Advice", "Craft & Making", "Food & Drink", "Arts", "Science", "Philosophy"];

export default function NewQuestion() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("General");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (title.trim().length < 5) {
      setError("Give your question a clear title (5+ characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const q = await api.afCreateQuestion(title.trim(), body.trim(), category);
      router.replace(`/answerfier/question/${q.id}`);
    } catch {
      setError("Couldn't post the question. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="nq-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Ask a Question</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Eyebrow>Category</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              testID={`nq-cat-${c}`}
              onPress={() => setCategory(c)}
              style={[styles.chip, { backgroundColor: category === c ? colors.brand : colors.surfaceSecondary, borderColor: category === c ? colors.brand : colors.border }]}
            >
              <Text style={[styles.chipText, { color: category === c ? colors.onBrandPrimary : colors.onSurface }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Eyebrow style={{ marginTop: spacing.lg }}>Question</Eyebrow>
        <TextInput
          testID="nq-title"
          value={title}
          onChangeText={setTitle}
          placeholder="What would you like to know?"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          maxLength={200}
        />

        <Eyebrow style={{ marginTop: spacing.lg }}>Details (optional)</Eyebrow>
        <TextInput
          testID="nq-body"
          value={body}
          onChangeText={setBody}
          placeholder="Add any context that will help people answer…"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        />

        {error ? <Text testID="nq-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton label="Post question" fullWidth size="lg" loading={busy} onPress={submit} testID="nq-submit" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
  body: { padding: spacing.lg, gap: spacing.sm },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
