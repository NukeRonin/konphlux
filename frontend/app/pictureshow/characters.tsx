import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, PSCharacter, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

export default function PSCharacters() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<PSCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [referencePath, setReferencePath] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.psCharacters());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickPhoto = async () => {
    if (uploading) return;
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access is needed to add a reference. Enable it in Settings."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(res.assets[0].uri, Platform.OS === "web");
      setReferencePath(url);
    } catch {
      setError("Couldn't upload that image. Try another.");
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    if (name.trim().length < 1) return setError("Give your character a name.");
    setSaving(true);
    setError("");
    try {
      await api.psCreateCharacter({ name: name.trim(), description: description.trim(), reference_path: referencePath });
      setName(""); setDescription(""); setReferencePath("");
      await load();
    } catch {
      setError("Couldn't save the character. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (c: PSCharacter) => {
    Alert.alert("Delete character", `Remove "${c.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.psDeleteCharacter(c.id); load(); } },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psc-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Characters</Text>
          <Eyebrow>Reusable cast for your videos</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <View style={[styles.form, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.onSurface }]}>New character</Text>
          <View style={styles.refRow}>
            <Pressable testID="psc-photo" onPress={pickPhoto} style={[styles.refBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {referencePath ? (
                <Image source={{ uri: referencePath }} style={styles.refImg} contentFit="cover" />
              ) : (
                <MaterialCommunityIcons name={uploading ? "progress-upload" : "camera-plus"} size={24} color={colors.muted} />
              )}
            </Pressable>
            <View style={{ flex: 1, gap: spacing.sm }}>
              <TextInput testID="psc-name" value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} />
              <Text style={[styles.hint, { color: colors.muted }]}>Tap the box to add a reference photo.</Text>
            </View>
          </View>
          <TextInput testID="psc-desc" value={description} onChangeText={setDescription} placeholder="Describe them: look, personality, role…" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} />
          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          <ForgeButton label="Add character" fullWidth loading={saving} onPress={create} testID="psc-create" style={{ marginTop: spacing.sm }} />
        </View>

        <Text style={[styles.listTitle, { color: colors.onSurface }]}>Your cast</Text>
        {loading ? (
          <Loading label="Fetching your cast…" />
        ) : items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>No characters yet. Create one above to reuse across your AI videos.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {items.map((c) => (
              <View key={c.id} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {c.reference_path ? (
                  <Image source={{ uri: c.reference_path }} style={styles.cardImg} contentFit="cover" />
                ) : (
                  <View style={[styles.cardImg, styles.cardImgFallback, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name="account" size={26} color={colors.muted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.onSurface }]}>{c.name}</Text>
                  {c.description ? <Text numberOfLines={2} style={[styles.cardDesc, { color: colors.muted }]}>{c.description}</Text> : null}
                </View>
                <Pressable onPress={() => remove(c)} hitSlop={10} testID={`psc-del-${c.id}`}>
                  <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  form: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  formTitle: { fontFamily: fonts.displaySemi, fontSize: 16 },
  refRow: { flexDirection: "row", gap: spacing.md },
  refBox: { width: 84, height: 84, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  refImg: { width: "100%", height: "100%" },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  input: { minHeight: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  listTitle: { fontFamily: fonts.display, fontSize: 18, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  cardImg: { width: 52, height: 52, borderRadius: radius.sm },
  cardImgFallback: { alignItems: "center", justifyContent: "center" },
  cardName: { fontFamily: fonts.bodyBold, fontSize: 15 },
  cardDesc: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
});
