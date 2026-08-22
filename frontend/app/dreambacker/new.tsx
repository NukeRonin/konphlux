import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, DBFundingModel } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { FUNDING_MODELS, fmtDeadline } from "@/src/utils/dreambacker";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const DURATIONS: { label: string; days: number | null }[] = [
  { label: "No deadline", days: null },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
];

const deadlineFromDays = (days: number | null): string | null =>
  days == null ? null : new Date(Date.now() + days * 86400 * 1000).toISOString();

export default function NewFundraiser() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [durationIdx, setDurationIdx] = useState(3); // 30 days default
  const [model, setModel] = useState<DBFundingModel>("all_or_nothing");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const goalCents = Math.round((parseFloat(goal.replace(/[^0-9.]/g, "")) || 0) * 100);
  const deadlineISO = deadlineFromDays(DURATIONS[durationIdx].days);
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && goalCents >= 100;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const p = await api.dbCreateProject({
        title: title.trim(),
        description: description.trim(),
        goal_cents: goalCents,
        funding_model: model,
        deadline: deadlineISO,
      });
      router.replace(`/dreambacker/${p.id}`);
    } catch {
      setError("Couldn't create your fundraiser. Please check the details and try again.");
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="new-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Start a Fundraiser</Text>
          <Eyebrow>Launch your dream</Eyebrow>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 20}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Project title</Text>
          <TextInput testID="new-title" value={title} onChangeText={setTitle} placeholder="e.g. The Tidal Orrery" placeholderTextColor={colors.muted} maxLength={120} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

          <Text style={[styles.label, { color: colors.onSurface }]}>Funding goal</Text>
          <View style={[styles.goalRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.brand }]}>$</Text>
            <TextInput testID="new-goal" value={goal} onChangeText={setGoal} placeholder="5,000" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.goalInput, { color: colors.onSurface }]} />
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Describe your project</Text>
          <TextInput testID="new-desc" value={description} onChangeText={setDescription} placeholder="What are you building, and why does it matter? Tell backers the story." placeholderTextColor={colors.muted} multiline maxLength={4000} style={[styles.input, styles.textarea, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

          <Text style={[styles.label, { color: colors.onSurface }]}>Deadline (optional)</Text>
          <View style={styles.durationWrap}>
            {DURATIONS.map((d, i) => {
              const active = durationIdx === i;
              return (
                <Pressable key={d.label} testID={`new-duration-${i}`} onPress={() => setDurationIdx(i)} style={[styles.durChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                  <Text style={[styles.durChipText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.deadlineHint, { color: colors.muted }]}>
            {deadlineISO ? `Ends ${fmtDeadline(deadlineISO)} · a live countdown will show on your project page.` : "No countdown — your fundraiser stays open indefinitely."}
          </Text>

          <Text style={[styles.label, { color: colors.onSurface }]}>Funding model</Text>
          <Text style={[styles.modelIntro, { color: colors.muted }]}>Choose how you&apos;ll receive the money you raise. This can&apos;t be changed later.</Text>
          {(Object.keys(FUNDING_MODELS) as DBFundingModel[]).map((key) => {
            const fm = FUNDING_MODELS[key];
            const active = model === key;
            return (
              <Pressable key={key} testID={`new-model-${key}`} onPress={() => setModel(key)} style={[styles.modelCard, { backgroundColor: colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2 : 1 }]}>
                <View style={styles.modelHead}>
                  <View style={[styles.modelIcon, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name={fm.icon as IconName} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modelTitle, { color: colors.onSurface }]}>{fm.label}</Text>
                    <Text style={[styles.modelShort, { color: colors.brand }]}>{fm.short}</Text>
                  </View>
                  <MaterialCommunityIcons name={active ? "radiobox-marked" : "radiobox-blank"} size={22} color={active ? colors.brand : colors.muted} />
                </View>
                <Text style={[styles.modelBlurb, { color: colors.muted }]}>{fm.blurb}</Text>
              </Pressable>
            );
          })}

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <ForgeButton label="Launch fundraiser" fullWidth size="lg" disabled={!valid} loading={saving} onPress={submit} testID="new-submit" style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 21 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, marginBottom: spacing.sm, marginTop: spacing.lg },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  goalRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  currency: { fontFamily: fonts.display, fontSize: 20, marginRight: spacing.xs },
  goalInput: { flex: 1, height: 52, fontFamily: fonts.display, fontSize: 20 },
  durationWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  durChip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  durChipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  deadlineHint: { fontFamily: fonts.body, fontSize: 12.5, marginTop: spacing.sm, lineHeight: 18 },
  modelIntro: { fontFamily: fonts.body, fontSize: 12.5, marginTop: -spacing.xs, marginBottom: spacing.sm, lineHeight: 18 },
  modelCard: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  modelHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modelIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  modelTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  modelShort: { fontFamily: fonts.bodyBold, fontSize: 12.5, marginTop: 1 },
  modelBlurb: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
});
