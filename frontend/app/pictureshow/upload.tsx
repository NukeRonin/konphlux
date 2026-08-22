import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATEGORIES = ["Serials", "Documentaries", "Music", "Tutorials", "Comedy", "Shorts", "Live Recordings"];

export default function PSUpload() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Shorts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (title.trim().length < 2) return setError("Give your video a title.");
    if (!/^https?:\/\/.+/.test(url.trim())) return setError("Paste a valid video link (https://…).");
    setBusy(true);
    setError("");
    try {
      const v = await api.psCreateVideo({ title: title.trim(), video_url: url.trim(), category, description: description.trim() });
      router.replace(`/pictureshow/video/${v.id}`);
    } catch {
      setError("Couldn't post the video. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psupload-back">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Upload a video</Text>
          <Eyebrow>Share a link to your reel</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Title</Text>
        <TextInput testID="upload-title" value={title} onChangeText={setTitle} placeholder="e.g. My steampunk short film" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

        <Text style={[styles.label, { color: colors.onSurface }]}>Video link</Text>
        <TextInput testID="upload-url" value={url} onChangeText={setUrl} placeholder="https://…/video.mp4 or streaming URL" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
        <Text style={[styles.hint, { color: colors.muted }]}>Paste a direct .mp4 link or a public streaming URL.</Text>

        <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`upload-cat-${c}`} onPress={() => setCategory(c)} style={[styles.catChip, { backgroundColor: category === c ? colors.surfaceTertiary : "transparent", borderColor: category === c ? colors.brand : colors.border }]}>
              <Text style={[styles.catText, { color: category === c ? colors.brand : colors.muted }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: colors.onSurface }]}>Description (optional)</Text>
        <TextInput testID="upload-desc" value={description} onChangeText={setDescription} placeholder="What's it about?" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label="Post video" fullWidth loading={busy} onPress={submit} testID="upload-submit" style={{ marginTop: spacing.md }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  hint: { fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  catRow: { gap: spacing.sm },
  catChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
