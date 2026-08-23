import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl } from "@/src/api/client";
import { AudioPreview } from "@/src/components/AudioPreview";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Mode = "music" | "sfx";

const SUGGESTIONS: Record<Mode, string[]> = {
  music: ["Haunting music-box lullaby", "Triumphant brass airship anthem", "Smoky clockwork jazz", "Eerie boiler-room ambient"],
  sfx: ["Steam valve hiss & release", "Brass gears grinding to life", "Aether crystal power-up chime", "Distant foghorn over the docks"],
};

const OPTION_CHIPS: Record<Mode, { key: "genre" | "mood" | "duration"; label: string; values: string[] }[]> = {
  music: [
    { key: "genre", label: "Genre", values: ["Orchestral", "Jazz", "Ambient", "Electronic", "Folk"] },
    { key: "mood", label: "Mood", values: ["Whimsical", "Ominous", "Triumphant", "Melancholy", "Playful"] },
    { key: "duration", label: "Length", values: ["30s loop", "1 min", "2-3 min"] },
  ],
  sfx: [
    { key: "mood", label: "Character", values: ["Mechanical", "Ambient", "UI/Interface", "Creature", "Impact"] },
    { key: "duration", label: "Length", values: ["One-shot", "1-2s", "Looping"] },
  ],
};

function parseSections(text: string): { key: string; body: string }[] {
  const lines = text.split("\n");
  const out: { key: string; body: string }[] = [];
  let cur: { key: string; body: string } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([A-Z][A-Z &/]{2,30}):\s*(.*)$/);
    if (m) {
      if (cur) out.push(cur);
      cur = { key: m[1].trim(), body: m[2].trim() };
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    } else {
      out.push({ key: "", body: line });
      cur = out[out.length - 1];
    }
  }
  if (cur && (!out.length || out[out.length - 1] !== cur)) out.push(cur);
  return out.filter((s) => s.body);
}

export default function AudioStudio() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "sfx" ? "sfx" : "music");
  const [prompt, setPrompt] = useState("");
  const [opts, setOpts] = useState<{ genre?: string; mood?: string; duration?: string }>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ concept: string; image_path: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [audioStatus, setAudioStatus] = useState<"idle" | "rendering" | "ready" | "failed">("idle");
  const [audioUrl, setAudioUrl] = useState("");
  const audioJob = useRef<string | null>(null);

  const switchMode = (m: Mode) => { setMode(m); setResult(null); setOpts({}); setError(""); setSaved(false); setAudioStatus("idle"); setAudioUrl(""); audioJob.current = null; };
  const setOpt = (k: "genre" | "mood" | "duration", v: string) => setOpts((o) => ({ ...o, [k]: o[k] === v ? undefined : v }));

  // Poll the fal.ai audio job until a real playable file is ready.
  useEffect(() => {
    if (audioStatus !== "rendering" || !audioJob.current) return;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const s = await api.frankAudioStatus(audioJob.current!);
        if (!alive) return;
        if (s.status === "ready" && s.output_url) { setAudioUrl(s.output_url); setAudioStatus("ready"); }
        else if (s.status === "failed") { setAudioStatus("failed"); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [audioStatus]);

  const saveToVault = async () => {
    if (!result || saving || saved) return;
    setSaving(true);
    try {
      await api.frankVaultSave({ kind: mode, prompt: prompt.trim(), image_path: result.image_path, concept: result.concept, media_url: audioUrl });
      setSaved(true);
    } catch {
      setError("Couldn't save to your Vault. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    if (prompt.trim().length < 1 || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);
    setAudioStatus("idle");
    setAudioUrl("");
    audioJob.current = null;
    try {
      // 1) Fast concept + cover for context.
      const res = await api.frankAudio({ kind: mode, prompt: prompt.trim(), genre: opts.genre, mood: opts.mood, duration: opts.duration });
      setResult({ concept: res.concept, image_path: res.image_path });
      // 2) Kick off the REAL audio render on fal.ai.
      try {
        const job = await api.frankAudioRender({ kind: mode, prompt: prompt.trim(), genre: opts.genre, mood: opts.mood, duration: opts.duration });
        audioJob.current = job.job_id;
        setAudioStatus("rendering");
      } catch {
        setAudioStatus("failed");
      }
    } catch {
      setError("The lab's aether coils overloaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const retryAudio = async () => {
    setAudioStatus("idle"); setAudioUrl(""); audioJob.current = null;
    try {
      const job = await api.frankAudioRender({ kind: mode, prompt: prompt.trim(), genre: opts.genre, mood: opts.mood, duration: opts.duration });
      audioJob.current = job.job_id;
      setAudioStatus("rendering");
    } catch { setAudioStatus("failed"); }
  };

  const accent = mode === "music" ? "music-clef-treble" : "waveform";

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="audio-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>Audio Creation Studio</Text>
          <Eyebrow>Frankenstein Lab</Eyebrow>
        </View>
        <Pressable testID="audio-vault" onPress={() => router.push("/frankenstein-lab/vault")} hitSlop={8} style={styles.hdrBtn}>
          <MaterialCommunityIcons name="treasure-chest" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["music", "sfx"] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <Pressable key={m} testID={`audio-tab-${m}`} onPress={() => switchMode(m)} style={[styles.tab, active && { borderBottomColor: colors.brand }]}>
              <MaterialCommunityIcons name={m === "music" ? "music-clef-treble" : "waveform"} size={16} color={active ? colors.brand : colors.muted} />
              <Text style={[styles.tabText, { color: active ? colors.brand : colors.muted }]}>{m === "music" ? "GenoTune" : "GenoFX"}</Text>
            </Pressable>
          );
        })}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 20}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.intro, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={accent} size={20} color={colors.brand} />
            <Text style={[styles.introText, { color: colors.muted }]}>
              {mode === "music"
                ? "Describe a piece of music. GenoTune generates a real, playable track (plus a concept & cover art)."
                : "Describe a sound effect. GenoFX generates a real, playable sound (plus a blueprint & visual)."}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.onSurface }]}>{mode === "music" ? "Describe your track" : "Describe your sound effect"}</Text>
          <TextInput
            testID="audio-prompt"
            value={prompt}
            onChangeText={setPrompt}
            placeholder={mode === "music" ? "e.g. A haunting music-box waltz that builds into a brassy crescendo" : "e.g. A heavy steam valve releasing pressure, then a metallic clank"}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={600}
            style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
          />
          <View style={styles.sugRow}>
            {SUGGESTIONS[mode].map((s) => (
              <Pressable key={s} testID={`audio-sug-${s.slice(0, 6)}`} onPress={() => setPrompt(s)} style={[styles.sug, { borderColor: colors.border }]}>
                <Text style={[styles.sugText, { color: colors.muted }]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          {OPTION_CHIPS[mode].map((group) => (
            <View key={group.key} style={{ marginTop: spacing.md }}>
              <Text style={[styles.optLabel, { color: colors.onSurface }]}>{group.label}</Text>
              <View style={styles.chipWrap}>
                {group.values.map((v) => {
                  const active = opts[group.key] === v;
                  return (
                    <Pressable key={v} testID={`audio-opt-${group.key}-${v}`} onPress={() => setOpt(group.key, v)} style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                      <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <ForgeButton label={mode === "music" ? "Generate Music" : "Generate Sound Effect"} fullWidth size="lg" loading={loading} disabled={prompt.trim().length < 1} onPress={generate} testID="audio-generate" style={{ marginTop: spacing.lg }} icon={<MaterialCommunityIcons name={accent} size={18} color={colors.onBrandPrimary} />} />

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          {result ? (
            <>
              {result.image_path ? (
                <Image source={{ uri: fileUrl(result.image_path) }} style={styles.visual} contentFit="cover" transition={250} />
              ) : null}

              {audioStatus === "rendering" ? (
                <View style={[styles.comingSoon, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
                  <ActivityIndicator color={colors.brand} />
                  <Text style={[styles.comingSoonText, { color: colors.onSurface }]}>Generating your real {mode === "music" ? "track" : "sound effect"}… this takes a few seconds.</Text>
                </View>
              ) : audioStatus === "ready" && audioUrl ? (
                <View style={{ marginTop: spacing.lg }}>
                  <AudioPreview uri={audioUrl} title={mode === "music" ? "Your generated track" : "Your generated sound effect"} />
                </View>
              ) : audioStatus === "failed" ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[styles.error, { color: colors.error }]}>Audio generation didn&apos;t complete.</Text>
                  <ForgeButton label="Try audio again" variant="outline" fullWidth onPress={retryAudio} testID="audio-retry" style={{ marginTop: spacing.sm }} />
                </View>
              ) : null}

              {parseSections(result.concept).map((sec, i) => (
                <View key={i} style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  {sec.key ? <Text style={[styles.sectionKey, { color: colors.brand }]}>{sec.key}</Text> : null}
                  <Text style={[styles.sectionBody, { color: colors.onSurface }]}>{sec.body}</Text>
                </View>
              ))}
              <ForgeButton
                label={saved ? "Saved to Vault" : "Save to Vault"}
                fullWidth
                variant={saved ? "outline" : "solid"}
                loading={saving}
                disabled={saved}
                onPress={saveToVault}
                testID="audio-save"
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
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontFamily: fonts.displaySemi, fontSize: 14 },
  intro: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  introText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 90, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  sugRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  sug: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sugText: { fontFamily: fonts.body, fontSize: 12 },
  optLabel: { fontFamily: fonts.bodyBold, fontSize: 13, marginBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  visual: { width: "100%", height: 220, borderRadius: radius.md, marginTop: spacing.lg },
  section: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  sectionKey: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5, marginBottom: 4 },
  sectionBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  comingSoon: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  comingSoonText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
});
