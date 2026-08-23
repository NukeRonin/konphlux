import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATS = ["Recipes", "DIY Projects", "Magic Tricks", "Life Hacks", "Crafts", "Decor Ideas", "Fashion", "Travel Ideas", "Reading List", "Tutorials", "Artwork", "Logos", "Memes", "GIFs", "Jokes", "Quotes", "Video Game Cheats", "Images", "TV Recommendations", "Movie Recommendations", "Music Recommendations", "Video Game Recommendations", "Sound Effects"];
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function VaultAdd() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; id?: string }>();
  const editingId = params.id || "";
  const [category, setCategory] = useState(params.category && CATS.includes(params.category) ? params.category : "Recipes");
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editingId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingId) return;
    api.vaultGetItem(editingId).then((v) => {
      setCategory(v.category || "Recipes"); setTitle(v.title); setImage(v.image_url); setInstructions(v.text); setNotes(v.notes);
    }).catch(() => setError("Couldn't load that item.")).finally(() => setLoading(false));
  }, [editingId]);

  const canSave = title.trim().length >= 1;

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError("Photo access is needed to add an image."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true); setError("");
      setImage(await uploadImage(res.assets[0].uri, Platform.OS === "web"));
    } catch { setError("Couldn't upload that image. Try another."); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true); setError("");
    try {
      if (editingId) {
        await api.vaultUpdateItem(editingId, { title: title.trim(), image_url: image, category, text: instructions.trim(), notes: notes.trim() });
        router.replace(`/vault/item/${editingId}`);
      } else {
        const res = await api.vaultSave({ source: "other", ref_id: `idea-${rid()}`, title: title.trim(), image_url: image, subtitle: category, category, text: instructions.trim(), notes: notes.trim() });
        router.replace(`/vault/item/${res.item.id}`);
      }
    } catch (e: any) { setError(e?.message || "Couldn't save. Please try again."); setSaving(false); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }];
  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}><Loading label="Loading…" /></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vault-add-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{editingId ? "Edit Idea" : "Add to Vault"}</Text>
          <Eyebrow>Images, instructions &amp; notes</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
        <View style={styles.catRow}>
          {CATS.map((c) => {
            const active = category === c;
            return (
              <Pressable key={c} testID={`vault-add-cat-${c}`} onPress={() => setCategory(c)} style={[styles.catChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                <Text style={[styles.catText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Image (optional)</Text>
        {image ? (
          <View>
            <Image source={{ uri: image }} style={styles.preview} contentFit="cover" />
            <Pressable onPress={() => setImage("")} style={[styles.removeImg, { backgroundColor: colors.surface }]} hitSlop={8} testID="vault-add-remove-img"><MaterialCommunityIcons name="close" size={18} color={colors.onSurface} /></Pressable>
          </View>
        ) : (
          <Pressable onPress={pickImage} disabled={uploading} style={[styles.imgPick, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID="vault-add-pick-img">
            <MaterialCommunityIcons name={uploading ? "loading" : "image-plus"} size={22} color={colors.brand} />
            <Text style={[styles.imgPickText, { color: colors.muted }]}>{uploading ? "Uploading…" : "Add an image"}</Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: colors.onSurface }]}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Copperpot Spiced Cocoa" placeholderTextColor={colors.muted} style={inputStyle} testID="vault-add-title" />

        <Text style={[styles.label, { color: colors.onSurface }]}>Instructions</Text>
        <TextInput value={instructions} onChangeText={setInstructions} placeholder="Steps, method or the joke/quote text…" placeholderTextColor={colors.muted} multiline style={[inputStyle, { minHeight: 130, textAlignVertical: "top", paddingTop: spacing.md, lineHeight: 22 }]} testID="vault-add-instructions" />

        <Text style={[styles.label, { color: colors.onSurface }]}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Extra tips, variations, reminders…" placeholderTextColor={colors.muted} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top", paddingTop: spacing.md, lineHeight: 22 }]} testID="vault-add-notes" />

        {error ? <Text style={[styles.error, { color: "#E53E3E" }]}>{error}</Text> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ForgeButton label={saving ? "Saving…" : editingId ? "Save changes" : "Save to Vault"} fullWidth size="lg" disabled={!canSave || saving} testID="vault-add-save" onPress={save} icon={<MaterialCommunityIcons name="bookmark-plus-outline" size={18} color={colors.onBrandPrimary} />} />
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
  catChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  imgPick: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 92, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
  imgPickText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  preview: { width: "100%", height: 180, borderRadius: radius.md },
  removeImg: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
});
