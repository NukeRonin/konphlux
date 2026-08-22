import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { DB_CATEGORIES } from "@/src/utils/dreambacker";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function EditFundraiser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const p = await api.dbProject(id);
      if (!p.is_creator) { setStatus("error"); return; }
      setTitle(p.title);
      setGoal(String(p.goal_cents / 100));
      setDescription(p.description);
      setCategory(p.category);
      setCoverUrl(p.cover_url);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const goalCents = Math.round((parseFloat(goal.replace(/[^0-9.]/g, "")) || 0) * 100);
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && goalCents >= 100;

  const pickCover = async () => {
    if (uploadingCover) return;
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access is needed to change the cover image. Enable it in Settings."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [16, 9] });
    if (res.canceled || !res.assets?.length) return;
    setUploadingCover(true);
    setError("");
    try {
      setCoverUrl(await uploadImage(res.assets[0].uri, Platform.OS === "web"));
    } catch {
      setError("Couldn't upload that image. Please try another.");
    } finally {
      setUploadingCover(false);
    }
  };

  const save = async () => {
    if (!valid || saving || !id) return;
    setSaving(true);
    setError("");
    try {
      await api.dbEditProject(id, {
        title: title.trim(),
        description: description.trim(),
        goal_cents: goalCents,
        cover_url: coverUrl,
        category,
      });
      router.back();
    } catch {
      setError("Couldn't save your changes. Please try again.");
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="edit-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Edit Fundraiser</Text>
          <Eyebrow>Update your project</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Loading your fundraiser…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 20}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.label, { color: colors.onSurface }]}>Project title</Text>
            <TextInput testID="edit-title" value={title} onChangeText={setTitle} placeholder="Project title" placeholderTextColor={colors.muted} maxLength={120} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

            <Text style={[styles.label, { color: colors.onSurface }]}>Cover image</Text>
            <Pressable testID="edit-cover" onPress={pickCover} style={[styles.coverPick, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {coverUrl ? (
                <>
                  <Image source={{ uri: coverUrl }} style={styles.coverPreview} contentFit="cover" />
                  <Pressable testID="edit-cover-remove" onPress={() => setCoverUrl(null)} hitSlop={8} style={[styles.coverRemove, { backgroundColor: colors.surface }]}>
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
              <TextInput testID="edit-goal" value={goal} onChangeText={setGoal} placeholder="5,000" placeholderTextColor={colors.muted} keyboardType="numeric" style={[styles.goalInput, { color: colors.onSurface }]} />
            </View>

            <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
            <View style={styles.catWrap}>
              {DB_CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable key={c.key} testID={`edit-cat-${c.key}`} onPress={() => setCategory(c.key)} style={[styles.catChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                    <MaterialCommunityIcons name={c.icon as IconName} size={13} color={active ? colors.onBrandPrimary : colors.brand} />
                    <Text style={[styles.catChipText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.onSurface }]}>Description</Text>
            <TextInput testID="edit-desc" value={description} onChangeText={setDescription} placeholder="Tell backers the story." placeholderTextColor={colors.muted} multiline maxLength={4000} style={[styles.input, styles.textarea, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            <ForgeButton label="Save changes" fullWidth size="lg" disabled={!valid} loading={saving} onPress={save} testID="edit-save" style={{ marginTop: spacing.lg }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  coverPick: { height: 170, borderRadius: radius.md, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  coverPreview: { width: "100%", height: "100%" },
  coverRemove: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  coverEmpty: { alignItems: "center", gap: spacing.sm },
  coverText: { fontFamily: fonts.body, fontSize: 13 },
  goalRow: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  currency: { fontFamily: fonts.display, fontSize: 20, marginRight: spacing.xs },
  goalInput: { flex: 1, height: 52, fontFamily: fonts.display, fontSize: 20 },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  catChipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
});
