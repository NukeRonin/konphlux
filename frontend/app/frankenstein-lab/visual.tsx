import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Kind = "pic" | "logo" | "gif" | "meme";

const TYPES: { key: Kind; label: string; icon: IconName; hint: string; ph: string }[] = [
  { key: "pic", label: "GenoPic", icon: "image", hint: "High-quality AI images", ph: "e.g. A brass owl perched on a gaslamp at dusk" },
  { key: "logo", label: "GenoLogo", icon: "shield-star", hint: "Clean iconic logos", ph: "e.g. Logo for 'Aether Coffee', a cozy steampunk café" },
  { key: "gif", label: "GenoGIF", icon: "animation-play", hint: "Keyframe (animation soon)", ph: "e.g. A cat piloting a tiny airship, waving" },
  { key: "meme", label: "GenoMeme", icon: "emoticon-lol", hint: "Shareable meme art", ph: "e.g. When the boiler finally works after 3 hours" },
];

export default function VisualStudio() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const initial = (["pic", "logo", "gif", "meme"].includes(params.type ?? "") ? params.type : "pic") as Kind;
  const [kind, setKind] = useState<Kind>(initial);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imagePath, setImagePath] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = TYPES.find((t) => t.key === kind)!;

  const switchKind = (k: Kind) => { setKind(k); setImagePath(""); setSaved(false); setError(""); };

  const generate = async () => {
    if (prompt.trim().length < 1 || loading) return;
    setLoading(true); setError(""); setImagePath(""); setSaved(false);
    try {
      const res = await api.frankVisual({ kind, prompt: prompt.trim() });
      setImagePath(res.image_path);
    } catch {
      setError("The image forge sputtered. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveToVault = async () => {
    if (!imagePath || saving || saved) return;
    setSaving(true);
    try {
      await api.frankVaultSave({ kind, prompt: prompt.trim(), image_path: imagePath });
      // Also surface it in the app-wide Vault organization hub, tagged by category.
      const vaultCat = kind === "logo" ? "Logos" : kind === "gif" ? "GIFs" : kind === "meme" ? "Memes" : "Artwork";
      await api.vaultSave({ source: "frankenstein", ref_id: imagePath, title: prompt.trim() || `Frankenstein ${kind}`,
        image_url: fileUrl(imagePath), subtitle: `Frankenstein Lab · ${meta.label}`, category: vaultCat, route: "/frankenstein-lab/visual" }).catch(() => {});
      setSaved(true);
    } catch {
      setError("Couldn't save to your Vault. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="visual-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Visual Creation Studio</Text>
          <Eyebrow>Frankenstein Lab</Eyebrow>
        </View>
        <Pressable testID="visual-vault" onPress={() => router.push("/frankenstein-lab/vault")} hitSlop={8} style={styles.hdrBtn}>
          <MaterialCommunityIcons name="treasure-chest" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 20}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.typeGrid}>
            {TYPES.map((t) => {
              const active = kind === t.key;
              return (
                <Pressable key={t.key} testID={`visual-type-${t.key}`} onPress={() => switchKind(t.key)} style={[styles.typeCard, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                  <MaterialCommunityIcons name={t.icon} size={22} color={active ? colors.onBrandPrimary : colors.brand} />
                  <Text style={[styles.typeLabel, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
                  <Text style={[styles.typeHint, { color: active ? colors.onBrandPrimary : colors.muted }]}>{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>Describe what to create</Text>
          <TextInput testID="visual-prompt" value={prompt} onChangeText={setPrompt} placeholder={meta.ph} placeholderTextColor={colors.muted} multiline maxLength={600} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

          {(kind === "gif" || kind === "meme") ? (
            <View style={[styles.note, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="information-outline" size={16} color={colors.brand} />
              <Text style={[styles.noteText, { color: colors.onSurface }]}>{kind === "gif" ? "For now we generate a still keyframe — full animation is coming soon." : "For now we generate the meme art — caption tools are coming soon."}</Text>
            </View>
          ) : null}

          <ForgeButton label={`Generate ${meta.label}`} fullWidth size="lg" loading={loading} disabled={prompt.trim().length < 1} onPress={generate} testID="visual-generate" style={{ marginTop: spacing.lg }} icon={<MaterialCommunityIcons name={meta.icon} size={18} color={colors.onBrandPrimary} />} />

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          {imagePath ? (
            <>
              <Image source={{ uri: fileUrl(imagePath) }} style={styles.result} contentFit="cover" transition={250} />
              <ForgeButton
                label={saved ? "Saved to Vault" : "Save to Vault"}
                fullWidth
                variant={saved ? "outline" : "solid"}
                loading={saving}
                disabled={saved}
                onPress={saveToVault}
                testID="visual-save"
                style={{ marginTop: spacing.md }}
                icon={<MaterialCommunityIcons name={saved ? "check" : "treasure-chest"} size={18} color={saved ? colors.brand : colors.onBrandPrimary} />}
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  hdrBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeCard: { width: "47.5%", borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: 4 },
  typeLabel: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 4 },
  typeHint: { fontFamily: fonts.body, fontSize: 11.5 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 90, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  note: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  result: { width: "100%", height: 300, borderRadius: radius.md, marginTop: spacing.lg },
});
