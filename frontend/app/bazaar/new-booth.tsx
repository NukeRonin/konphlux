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

export default function NewBooth() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    setUploading(true);
    try {
      setImage(await uploadImage(res.assets[0].uri, Platform.OS === "web"));
    } catch {
      setError("Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (name.trim().length < 2) return setError("Give your booth a name.");
    setBusy(true);
    try {
      const booth = await api.createBooth(name.trim(), description.trim(), image);
      router.replace(`/bazaar/booth/${booth.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't create the booth.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="nb-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Set Up a Booth</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.muted }]}>
          A booth is your storefront — group your wares under one name. You can still post individual items separately.
        </Text>

        <Eyebrow style={{ marginTop: spacing.lg }}>Banner (optional)</Eyebrow>
        <Pressable testID="nb-image" onPress={pickImage} style={[styles.imageBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.placeholder}>
              <MaterialCommunityIcons name={uploading ? "progress-upload" : "image-plus"} size={34} color={colors.muted} />
              <Text style={[styles.hint, { color: colors.muted }]}>{uploading ? "Uploading…" : "Add a banner"}</Text>
            </View>
          )}
        </Pressable>

        <Eyebrow style={{ marginTop: spacing.lg }}>Booth name</Eyebrow>
        <TextInput testID="nb-name" value={name} onChangeText={setName} placeholder="e.g. Cog & Cauldron" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} maxLength={80} />

        <Eyebrow style={{ marginTop: spacing.lg }}>Description (optional)</Eyebrow>
        <TextInput testID="nb-description" value={description} onChangeText={setDescription} placeholder="What does your booth sell?" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />

        {error ? <Text testID="nb-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton label="Create booth" fullWidth size="lg" loading={busy} onPress={submit} testID="nb-submit" style={{ marginTop: spacing.xl }} />
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
  body: { padding: spacing.lg },
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  imageBox: { height: 150, borderRadius: radius.md, borderWidth: 1, overflow: "hidden", marginTop: spacing.sm },
  image: { width: "100%", height: "100%" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  hint: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
