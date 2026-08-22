import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATEGORIES = ["Essays", "Opinion", "Technology", "Culture", "Craft", "Fiction", "Guides", "News"];

export default function TelegraphNew() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Essays");
  const [body, setBody] = useState("");
  const [cover, setCover] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canPost = title.trim().length >= 3 && body.trim().length >= 20;

  const pickCover = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError("Photo access is needed to add a cover image."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true); setError("");
      const url = await uploadImage(res.assets[0].uri, Platform.OS === "web");
      setCover(url);
    } catch { setError("Couldn't upload that image. Try another."); }
    finally { setUploading(false); }
  };

  const post = async () => {
    if (!canPost || saving) return;
    setSaving(true); setError("");
    try {
      const created = await api.tgCreateArticle({ title: title.trim(), body: body.trim(), category, cover_url: cover });
      router.replace(`/telegraph/${created.id}`);
    } catch (e: any) { setError(e?.message || "Couldn't publish. Please try again."); setSaving(false); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="tg-new-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Post an Article</Text>
          <Eyebrow>Send it down the wire</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="A headline worth reading" placeholderTextColor={colors.muted} style={inputStyle} testID="tg-title" />

        <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <Pressable key={c} testID={`tg-cat-${c}`} onPress={() => setCategory(c)} style={[styles.catChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                <Text style={[styles.catChipText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Cover image (optional)</Text>
        {cover ? (
          <View>
            <Image source={{ uri: cover }} style={styles.coverPreview} contentFit="cover" />
            <Pressable onPress={() => setCover("")} style={[styles.removeCover, { backgroundColor: colors.surface }]} hitSlop={8} testID="tg-remove-cover">
              <MaterialCommunityIcons name="close" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={pickCover} disabled={uploading} style={[styles.coverPick, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID="tg-pick-cover">
            <MaterialCommunityIcons name={uploading ? "loading" : "image-plus"} size={22} color={colors.brand} />
            <Text style={[styles.coverPickText, { color: colors.muted }]}>{uploading ? "Uploading…" : "Add a cover image"}</Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: colors.onSurface }]}>Article</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write your long-form piece here. Separate paragraphs with a blank line for comfortable reading…"
          placeholderTextColor={colors.muted}
          multiline
          style={[inputStyle, { minHeight: 260, textAlignVertical: "top", paddingTop: spacing.md, lineHeight: 24 }]}
          testID="tg-body"
        />

        {error ? <Text style={[styles.error, { color: "#E53E3E" }]}>{error}</Text> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ForgeButton label={saving ? "Publishing…" : "Publish article"} fullWidth size="lg" disabled={!canPost || saving} testID="tg-publish" onPress={post} icon={<MaterialCommunityIcons name="send" size={18} color={colors.onBrandPrimary} />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  catChip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catChipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  coverPick: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 88, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
  coverPickText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  coverPreview: { width: "100%", height: 170, borderRadius: radius.md },
  removeCover: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
});
