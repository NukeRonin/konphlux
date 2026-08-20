import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Mode = "dictionary" | "thesaurus";

export default function Lexicon() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(params.mode === "thesaurus" ? "thesaurus" : "dictionary");
  const [word, setWord] = useState("");
  const [result, setResult] = useState<{ word: string; mode: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lookup = async () => {
    const w = word.trim();
    if (w.length < 1) {
      setError("Type a word to look up.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setResult(await api.bbLexicon(w, mode));
    } catch {
      setError("The library couldn't find that just now. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setResult(null);
    setError("");
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} onPress={() => router.back()} testID="lexicon-back" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Word Library</Text>
          <Eyebrow>Dictionary &amp; thesaurus</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        {/* Mode toggle */}
        <View style={styles.tabs}>
          {(["dictionary", "thesaurus"] as Mode[]).map((m) => (
            <Pressable key={m} testID={`mode-${m}`} onPress={() => switchMode(m)} style={[styles.tab, { backgroundColor: mode === m ? colors.brand : colors.surfaceSecondary, borderColor: mode === m ? colors.brand : colors.border }]}>
              <MaterialCommunityIcons name={m === "dictionary" ? "book-alphabet" : "book-search"} size={16} color={mode === m ? colors.onBrandPrimary : colors.brand} />
              <Text style={[styles.tabText, { color: mode === m ? colors.onBrandPrimary : colors.onSurface }]}>{m === "dictionary" ? "Dictionary" : "Thesaurus"}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          testID="lexicon-input"
          value={word}
          onChangeText={setWord}
          placeholder="Enter a word…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={lookup}
          style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
        />
        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label={mode === "dictionary" ? "Define" : "Find synonyms"} fullWidth loading={busy} onPress={lookup} testID="lexicon-lookup" style={{ marginTop: spacing.md }} />

        {result ? (
          <View style={[styles.result, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.resultWord, { color: colors.brand }]}>{result.word}</Text>
            <Text style={[styles.resultText, { color: colors.onSurface }]}>{result.text}</Text>
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
  tabs: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.md, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 16 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.sm },
  result: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  resultWord: { fontFamily: fonts.display, fontSize: 22 },
  resultText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
});
