import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Community } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function NewThread() {
  const { community } = useLocalSearchParams<{ community?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selected, setSelected] = useState<string | null>(community ?? null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const c = await api.rtCommunities();
        setCommunities(c);
        if (!selected && c.length > 0) setSelected(c[0].id);
      } catch {
        /* noop */
      }
    })();
  }, [selected]);

  const submit = async () => {
    if (!selected) {
      setError("Pick a community first.");
      return;
    }
    if (title.trim().length < 2 || !body.trim()) {
      setError("Add a title (2+ chars) and some words.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const t = await api.rtCreateThread(selected, title.trim(), body.trim());
      router.replace(`/roundtable/thread/${t.id}`);
    } catch {
      setError("Couldn't post the thread. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="nt-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Start a Thread</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Eyebrow>Community</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {communities.map((c) => (
            <Pressable
              key={c.id}
              testID={`nt-community-${c.id}`}
              onPress={() => setSelected(c.id)}
              style={[styles.chip, { backgroundColor: selected === c.id ? colors.brand : colors.surfaceSecondary, borderColor: selected === c.id ? colors.brand : colors.border }]}
            >
              <MaterialCommunityIcons name={c.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={16} color={selected === c.id ? colors.onBrandPrimary : colors.brand} />
              <Text style={[styles.chipText, { color: selected === c.id ? colors.onBrandPrimary : colors.onSurface }]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Eyebrow style={{ marginTop: spacing.lg }}>Title</Eyebrow>
        <TextInput
          testID="nt-title"
          value={title}
          onChangeText={setTitle}
          placeholder="A clear, catchy title"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          maxLength={140}
        />

        <Eyebrow style={{ marginTop: spacing.lg }}>Body</Eyebrow>
        <TextInput
          testID="nt-body"
          value={body}
          onChangeText={setBody}
          placeholder="Share your thoughts with the table…"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        />

        {error ? <Text testID="nt-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton label="Post thread" fullWidth size="lg" loading={busy} onPress={submit} testID="nt-submit" style={{ marginTop: spacing.xl }} />
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
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, flexShrink: 0 },
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
  multiline: { minHeight: 140, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
