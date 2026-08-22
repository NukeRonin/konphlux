import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, DBFundingModel, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { FUNDING_MODELS, fmtDeadline } from "@/src/utils/dreambacker";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type TierDraft = { title: string; description: string; amount: string };

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
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [tiers, setTiers] = useState<TierDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const goalCents = Math.round((parseFloat(goal.replace(/[^0-9.]/g, "")) || 0) * 100);
  const deadlineISO = deadlineFromDays(DURATIONS[durationIdx].days);
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && goalCents >= 100;

  const pickCover = async () => {
    if (uploadingCover) return;
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access is needed to add a cover image. You can enable it in Settings."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (res.canceled || !res.assets?.length) return;
    setUploadingCover(true);
    setError("");
    try {
      const url = await uploadImage(res.assets[0].uri, Platform.OS === "web");
      setCoverUrl(url);
    } catch {
      setError("Couldn't upload that image. Please try another.");
    } finally {
      setUploadingCover(false);
    }
  };

  const addTier = () => setTiers((t) => [...t, { title: "", description: "", amount: "" }]);
  const updateTier = (i: number, patch: Partial<TierDraft>) => setTiers((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeTier = (i: number) => setTiers((t) => t.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const reward_tiers = tiers
        .map((t) => ({ title: t.title.trim(), description: t.description.trim(), amount_cents: Math.round((parseFloat(t.amount.replace(/[^0-9.]/g, "")) || 0) * 100) }))
        .filter((t) => t.title.length > 0 && t.amount_cents >= 100);
      const p = await api.dbCreateProject({
        title: title.trim(),
        description: description.trim(),
        goal_cents: goalCents,
        funding_model: model,
        deadline: deadlineISO,
        cover_url: coverUrl,
        reward_tiers,
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

          <Text style={[styles.label, { color: colors.onSurface }]}>Cover image (optional)</Text>
          <Pressable testID="new-cover" onPress={pickCover} style={[styles.coverPick, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            {coverUrl ? (
              <>
                <Image source={{ uri: coverUrl }} style={styles.coverPreview} contentFit="cover" />
                <Pressable testID="new-cover-remove" onPress={() => setCoverUrl(null)} hitSlop={8} style={[styles.coverRemove, { backgroundColor: colors.surface }]}>
                  <MaterialCommunityIcons name="close" size={16} color={colors.onSurface} />
                </Pressable>
              </>
            ) : (
              <View style={styles.coverEmpty}>
                <MaterialCommunityIcons name={uploadingCover ? "progress-upload" : "image-plus"} size={26} color={colors.brand} />
                <Text style={[styles.coverText, { color: colors.muted }]}>{uploadingCover ? "Uploading…" : "Add a hero photo (16:9)"}</Text>
              </View>
            )}
          </Pressable>

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

          <Text style={[styles.label, { color: colors.onSurface }]}>Reward tiers (optional)</Text>
          <Text style={[styles.modelIntro, { color: colors.muted }]}>Offer perks at different pledge amounts so backers can pick a level.</Text>
          {tiers.map((t, i) => (
            <View key={i} style={[styles.tierCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <View style={styles.tierHead}>
                <Text style={[styles.tierNum, { color: colors.brand }]}>Tier {i + 1}</Text>
                <Pressable testID={`new-tier-remove-${i}`} onPress={() => removeTier(i)} hitSlop={8}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
              <View style={styles.tierRow}>
                <TextInput testID={`new-tier-title-${i}`} value={t.title} onChangeText={(v) => updateTier(i, { title: v })} placeholder="Reward name (e.g. Early Bird)" placeholderTextColor={colors.muted} maxLength={80} style={[styles.tierInput, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} />
                <View style={[styles.tierAmountBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.currency, { color: colors.brand, fontSize: 15 }]}>$</Text>
                  <TextInput testID={`new-tier-amount-${i}`} value={t.amount} onChangeText={(v) => updateTier(i, { amount: v })} placeholder="25" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.tierAmountInput, { color: colors.onSurface }]} />
                </View>
              </View>
              <TextInput testID={`new-tier-desc-${i}`} value={t.description} onChangeText={(v) => updateTier(i, { description: v })} placeholder="What backers get at this level" placeholderTextColor={colors.muted} maxLength={400} multiline style={[styles.tierInput, { marginTop: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface, minHeight: 44, textAlignVertical: "top" }]} />
            </View>
          ))}
          <Pressable testID="new-add-tier" onPress={addTier} style={[styles.addTier, { borderColor: colors.brand }]}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.brand} />
            <Text style={[styles.addTierText, { color: colors.brand }]}>Add a reward tier</Text>
          </Pressable>

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
  coverPick: { height: 170, borderRadius: radius.md, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  coverPreview: { width: "100%", height: "100%" },
  coverRemove: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  coverEmpty: { alignItems: "center", gap: spacing.sm },
  coverText: { fontFamily: fonts.body, fontSize: 13 },
  tierCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  tierHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  tierNum: { fontFamily: fonts.bodyBold, fontSize: 13 },
  tierRow: { flexDirection: "row", gap: spacing.sm },
  tierInput: { borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 14, height: 44 },
  tierAmountBox: { flexDirection: "row", alignItems: "center", borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, width: 92, height: 44 },
  tierAmountInput: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15 },
  addTier: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
  addTierText: { fontFamily: fonts.bodyBold, fontSize: 14 },
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
