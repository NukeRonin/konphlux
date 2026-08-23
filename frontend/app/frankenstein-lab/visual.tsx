import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { downloadAndShare, shareLocalUri } from "@/src/utils/mediaDownload";
import { captureRef } from "react-native-view-shot";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Kind = "pic" | "logo" | "gif" | "meme";

const TYPES: { key: Kind; label: string; icon: IconName; hint: string; ph: string }[] = [
  { key: "pic", label: "GenoPic", icon: "image", hint: "High-quality AI images", ph: "e.g. A brass owl perched on a gaslamp at dusk" },
  { key: "logo", label: "GenoLogo", icon: "shield-star", hint: "Clean iconic logos", ph: "e.g. Logo for 'Aether Coffee', a cozy steampunk café" },
  { key: "gif", label: "GenoGIF", icon: "animation-play", hint: "Real looping animation", ph: "e.g. A cat piloting a tiny airship, waving" },
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
  const [gifStatus, setGifStatus] = useState<"idle" | "rendering" | "ready" | "failed">("idle");
  const [gifUrl, setGifUrl] = useState("");
  const gifJob = useRef<string | null>(null);
  const shotRef = useRef<View>(null);
  const [watermarkOn, setWatermarkOn] = useState(true);

  const shareVisual = async () => {
    if (kind === "gif" && gifUrl) { downloadAndShare(gifUrl, `${(prompt.trim() || kind)}.mp4`); return; }
    if (!watermarkOn) { downloadAndShare(fileUrl(imagePath), `${(prompt.trim() || kind)}.png`); return; }
    try {
      const uri = await captureRef(shotRef, { format: "png", quality: 1 });
      await shareLocalUri(uri);
    } catch {
      downloadAndShare(fileUrl(imagePath), `${(prompt.trim() || kind)}.png`);
    }
  };

  const meta = TYPES.find((t) => t.key === kind)!;

  const switchKind = (k: Kind) => { setKind(k); setImagePath(""); setSaved(false); setError(""); setGifStatus("idle"); setGifUrl(""); gifJob.current = null; };

  // Poll the fal.ai animation job for GenoGIF.
  useEffect(() => {
    if (gifStatus !== "rendering" || !gifJob.current) return;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const s = await api.frankGifStatus(gifJob.current!);
        if (!alive) return;
        if (s.status === "ready" && s.output_url) { setGifUrl(s.output_url); setGifStatus("ready"); }
        else if (s.status === "failed") { setGifStatus("failed"); }
      } catch { /* keep polling */ }
    }, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [gifStatus]);

  const generate = async () => {
    if (prompt.trim().length < 1 || loading) return;
    setLoading(true); setError(""); setImagePath(""); setSaved(false);
    setGifStatus("idle"); setGifUrl(""); gifJob.current = null;
    try {
      const res = await api.frankVisual({ kind, prompt: prompt.trim() });
      setImagePath(res.image_path);
      // GenoGIF: also render a real looping animation on fal.ai.
      if (kind === "gif") {
        try {
          const job = await api.frankGifRender(prompt.trim());
          gifJob.current = job.job_id;
          setGifStatus("rendering");
        } catch {
          setGifStatus("failed");
        }
      }
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
      await api.frankVaultSave({ kind, prompt: prompt.trim(), image_path: imagePath, media_url: gifUrl });
      // Also surface it in the app-wide Vault organization hub, tagged by category.
      const vaultCat = kind === "logo" ? "Logos" : kind === "gif" ? "GIFs" : kind === "meme" ? "Memes" : "Images";
      await api.vaultSave({ source: "frankenstein", ref_id: imagePath, title: prompt.trim() || `Frankenstein ${kind}`,
        image_url: fileUrl(imagePath), media_url: kind === "gif" ? gifUrl : "", media_type: kind === "gif" && gifUrl ? "video" : "",
        subtitle: `Frankenstein Lab · ${meta.label}`, category: vaultCat, route: "/frankenstein-lab/visual" }).catch(() => {});
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
              <Text style={[styles.noteText, { color: colors.onSurface }]}>{kind === "gif" ? "GenoGIF generates a real looping animation (a short video) — takes a couple of minutes." : "For now we generate the meme art — caption tools are coming soon."}</Text>
            </View>
          ) : null}

          <ForgeButton label={`Generate ${meta.label}`} fullWidth size="lg" loading={loading} disabled={prompt.trim().length < 1} onPress={generate} testID="visual-generate" style={{ marginTop: spacing.lg }} icon={<MaterialCommunityIcons name={meta.icon} size={18} color={colors.onBrandPrimary} />} />

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          {imagePath ? (
            <>
              {kind === "gif" ? (
                gifStatus === "ready" && gifUrl ? (
                  <View style={{ marginTop: spacing.lg }}>
                    <VideoPlayer uri={gifUrl} loop style={{ aspectRatio: 1 }} />
                  </View>
                ) : gifStatus === "rendering" ? (
                  <View style={[styles.note, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border, marginTop: spacing.lg }]}>
                    <ActivityIndicator color={colors.brand} />
                    <Text style={[styles.noteText, { color: colors.onSurface }]}>Animating your GIF… this can take a couple of minutes. A keyframe preview is shown below.</Text>
                  </View>
                ) : gifStatus === "failed" ? (
                  <Text style={[styles.error, { color: colors.error }]}>Animation didn&apos;t complete — showing the keyframe. You can regenerate.</Text>
                ) : null
              ) : null}
              <View ref={shotRef} collapsable={false} style={styles.shotWrap}>
                <Image source={{ uri: fileUrl(imagePath) }} style={styles.result} contentFit="cover" transition={250} />
                {watermarkOn ? (
                  <View style={styles.watermark}>
                    <MaterialCommunityIcons name="cog" size={13} color="#fff" />
                    <Text style={styles.watermarkText}>Konphlux</Text>
                  </View>
                ) : null}
              </View>
              {kind !== "gif" ? (
                <Pressable testID="visual-watermark-toggle" onPress={() => setWatermarkOn((w) => !w)} style={[styles.wmRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                  <MaterialCommunityIcons name={watermarkOn ? "watermark" : "watermark"} size={18} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.wmTitle, { color: colors.onSurface }]}>Konphlux watermark</Text>
                    <Text style={[styles.wmHint, { color: colors.muted }]}>{watermarkOn ? "Shared art will carry the watermark" : "Shared art will have no watermark"}</Text>
                  </View>
                  <View style={[styles.wmSwitch, { backgroundColor: watermarkOn ? colors.brand : colors.surfaceTertiary }]}>
                    <View style={[styles.wmKnob, { alignSelf: watermarkOn ? "flex-end" : "flex-start" }]} />
                  </View>
                </Pressable>
              ) : null}
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
              <ForgeButton
                label="Download / Share"
                fullWidth
                variant="outline"
                onPress={shareVisual}
                testID="visual-download"
                style={{ marginTop: spacing.sm }}
                icon={<MaterialCommunityIcons name="download" size={18} color={colors.brand} />}
              />
              <ForgeButton
                label="Make another version"
                fullWidth
                variant="ghost"
                onPress={generate}
                testID="visual-regenerate"
                style={{ marginTop: spacing.xs }}
                icon={<MaterialCommunityIcons name="refresh" size={18} color={colors.brand} />}
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
  shotWrap: { position: "relative" },
  watermark: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  watermarkText: { color: "#fff", fontFamily: fonts.displaySemi, fontSize: 12, letterSpacing: 0.3 },
  wmRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  wmTitle: { fontFamily: fonts.bodyBold, fontSize: 14 },
  wmHint: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  wmSwitch: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: "center" },
  wmKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
});
