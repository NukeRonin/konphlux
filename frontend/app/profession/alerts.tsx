import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function JobAlerts() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meta, prefs] = await Promise.all([api.jobMeta(), api.jobAlertPrefs()]);
      setCategories(meta.categories);
      setSelected(prefs.categories);
      setKeywords(prefs.keywords);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleCat = (c: string) => {
    setSaved(false);
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const addKeyword = () => {
    const k = kwInput.trim();
    if (!k || keywords.includes(k)) { setKwInput(""); return; }
    setKeywords((prev) => [...prev, k]);
    setKwInput("");
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.jobSetAlertPrefs(selected, keywords);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="alerts-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Job Alerts</Text>
          <Eyebrow>Get notified about new matches</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.muted }]}>We&apos;ll send you an in-app alert whenever a new job matches a category or keyword you follow.</Text>

        <Text style={[styles.label, { color: colors.onSurface }]}>Categories to follow</Text>
        <View style={styles.chipWrap}>
          {categories.map((c) => {
            const active = selected.includes(c);
            return (
              <Pressable key={c} testID={`alert-cat-${c}`} onPress={() => toggleCat(c)} style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                {active ? <MaterialCommunityIcons name="check" size={13} color={colors.onBrandPrimary} /> : null}
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Keywords to follow</Text>
        <View style={styles.kwRow}>
          <TextInput
            testID="alert-kw-input"
            value={kwInput}
            onChangeText={setKwInput}
            onSubmitEditing={addKeyword}
            returnKeyType="done"
            placeholder="e.g. airship, python, remote"
            placeholderTextColor={colors.muted}
            style={[styles.kwInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
          />
          <Pressable testID="alert-kw-add" onPress={addKeyword} style={[styles.addBtn, { backgroundColor: colors.brand }]}>
            <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
        {keywords.length > 0 ? (
          <View style={[styles.chipWrap, { marginTop: spacing.sm }]}>
            {keywords.map((k) => (
              <Pressable key={k} onPress={() => { setKeywords((prev) => prev.filter((x) => x !== k)); setSaved(false); }} style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.onSurface }]}>{k}</Text>
                <MaterialCommunityIcons name="close" size={13} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <ForgeButton label={saved ? "Saved ✓" : "Save alerts"} variant={saved ? "outline" : "forge"} fullWidth loading={saving} onPress={save} testID="alerts-save" style={{ marginTop: spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  intro: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.xl, marginBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  kwRow: { flexDirection: "row", gap: spacing.sm },
  kwInput: { flex: 1, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  addBtn: { width: 46, height: 46, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
