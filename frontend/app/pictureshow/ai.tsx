import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl, PSCharacter, PSPreset, uploadAudio } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { VideoPlayer } from "@/src/components/VideoPlayer";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import {
  PS_ATMOSPHERICS, PS_AUDIO_EFFECTS, PS_FINISHING, PS_LENGTHS, PS_SPEEDS,
  PS_STYLES, PS_TITLES, PS_TRANSITIONS, PSKind, toggle,
} from "@/src/utils/psSuite";

const isWeb = Platform.OS === "web";

function parseSections(text: string): { key: string; body: string }[] {
  const out: { key: string; body: string }[] = [];
  let cur: { key: string; body: string } | null = null;
  for (const raw of text.split("\n")) {
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

/** Single-select chip row. */
function SingleChips({ options, value, onSelect }: { options: string[]; value: string; onSelect: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chipWrap}>
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable key={o} onPress={() => onSelect(active ? "" : o)} style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
            <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Collapsible multi-select section. */
function MultiSection({ title, icon, options, selected, onToggle }: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.sectionHead}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.brand} />
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
        {selected.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: colors.brand }]}>
            <Text style={[styles.countText, { color: colors.onBrandPrimary }]}>{selected.length}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={styles.chipWrap}>
          {options.map((o) => {
            const active = selected.includes(o);
            return (
              <Pressable key={o} onPress={() => onToggle(o)} style={[styles.chip, { backgroundColor: active ? colors.brand : colors.surface, borderColor: active ? colors.brand : colors.border }]}>
                {active ? <MaterialCommunityIcons name="check" size={13} color={colors.onBrandPrimary} /> : null}
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default function PSAiSuite() {
  const params = useLocalSearchParams<{ kind?: string; project?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [kind, setKind] = useState<PSKind>(params.kind === "animation" ? "animation" : "video");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [length, setLength] = useState("");
  const [speed, setSpeed] = useState("");
  const [transitions, setTransitions] = useState<string[]>([]);
  const [atmospherics, setAtmospherics] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [finishing, setFinishing] = useState<string[]>([]);
  const [audioFx, setAudioFx] = useState<string[]>([]);

  const [characters, setCharacters] = useState<PSCharacter[]>([]);
  const [charIds, setCharIds] = useState<string[]>([]);

  const [soundtrackPath, setSoundtrackPath] = useState("");
  const [soundtrackName, setSoundtrackName] = useState("");
  const [voiceoverPath, setVoiceoverPath] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState<"" | "track" | "voice">("");

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const voicePlayer = useAudioPlayer(voiceoverPath ? { uri: fileUrl(voiceoverPath) } : null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ storyboard: string; poster_path: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [renderStatus, setRenderStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [presets, setPresets] = useState<PSPreset[]>([]);
  const [presetModal, setPresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");

  const loadPresets = useCallback(async () => {
    try {
      setPresets(await api.psPresets());
    } catch {
      /* ignore */
    }
  }, []);

  const loadCharacters = useCallback(async () => {
    try {
      setCharacters(await api.psCharacters());
    } catch {
      /* ignore */
    }
  }, []);

  const loadProject = useCallback(async (id: string) => {
    try {
      const p = await api.psProject(id);
      setKind(p.kind);
      setPrompt(p.prompt);
      setStyle(p.style);
      setLength(p.length);
      setSpeed(p.speed);
      setTransitions(p.transitions || []);
      setAtmospherics(p.atmospherics || []);
      setTitles(p.titles || []);
      setFinishing(p.finishing || []);
      setAudioFx(p.audio_effects || []);
      setCharIds(p.character_ids || []);
      setSoundtrackPath(p.soundtrack_path || "");
      setSoundtrackName(p.soundtrack_path ? "Saved soundtrack" : "");
      setVoiceoverPath(p.voiceover_path || "");
      setProjectId(p.id);
      setRenderStatus(p.render_status || "");
      setVideoUrl(p.video_url || "");
      if (p.storyboard || p.poster_path) { setResult({ storyboard: p.storyboard, poster_path: p.poster_path }); setSaved(true); }
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(useCallback(() => { loadCharacters(); loadPresets(); }, [loadCharacters, loadPresets]));
  const [loadedProject, setLoadedProject] = useState(false);
  if (params.project && !loadedProject) {
    setLoadedProject(true);
    loadProject(params.project);
  }

  const pickSoundtrack = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setUploadingAudio("track");
      const path = await uploadAudio(asset.uri, isWeb, asset.mimeType || "audio/mpeg", asset.name || `track_${Date.now()}.mp3`);
      setSoundtrackPath(path);
      setSoundtrackName(asset.name || "Soundtrack");
    } catch {
      Alert.alert("Upload failed", "Couldn't add that soundtrack. Try another file.");
    } finally {
      setUploadingAudio("");
    }
  };

  const startRecording = async () => {
    if (isWeb) {
      Alert.alert("Use the app", "Voice-over recording works in the Konphlux mobile app, not the web preview.");
      return;
    }
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) {
          Alert.alert("Microphone blocked", "Enable microphone access in Settings to record a voice-over.", [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]);
        } else {
          Alert.alert("Microphone needed", "We need microphone access to record your voice-over.");
        }
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      Alert.alert("Recording error", "Couldn't start recording. Try again.");
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (!uri) return;
      setUploadingAudio("voice");
      const path = await uploadAudio(uri, isWeb, "audio/m4a", `voiceover_${Date.now()}.m4a`);
      setVoiceoverPath(path);
    } catch {
      Alert.alert("Recording error", "Couldn't save the recording.");
    } finally {
      setUploadingAudio("");
    }
  };

  const generate = async () => {
    if (prompt.trim().length < 3) return setError("Describe your idea first.");
    setBusy(true);
    setError("");
    setResult(null);
    setSaved(false);
    setProjectId("");
    setRenderStatus("");
    setVideoUrl("");
    try {
      const res = await api.psAiSuite({
        prompt: prompt.trim(), kind, style, length, speed,
        transitions, atmospherics, titles, finishing, audio_effects: audioFx,
        character_ids: charIds, has_soundtrack: !!soundtrackPath, has_voiceover: !!voiceoverPath,
      });
      setResult({ storyboard: res.storyboard, poster_path: res.poster_path });
    } catch {
      setError("The projection engine sputtered. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveProject = async () => {
    if (!result) return;
    try {
      const p = await api.psSaveProject({
        title: prompt.trim().slice(0, 60), prompt: prompt.trim(), kind, style, length, speed,
        transitions, atmospherics, titles, finishing, audio_effects: audioFx, character_ids: charIds,
        soundtrack_path: soundtrackPath, voiceover_path: voiceoverPath,
        storyboard: result.storyboard, poster_path: result.poster_path,
      });
      setSaved(true);
      setProjectId(p.id);
    } catch {
      Alert.alert("Couldn't save", "Saving to your projects failed. Try again.");
    }
  };

  const applyPreset = (p: PSPreset) => {
    setStyle(p.style || "");
    setLength(p.length || "");
    setSpeed(p.speed || "");
    setTransitions(p.transitions || []);
    setAtmospherics(p.atmospherics || []);
    setTitles(p.titles || []);
    setFinishing(p.finishing || []);
    setAudioFx(p.audio_effects || []);
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) return;
    try {
      await api.psSavePreset({
        name, style, length, speed, transitions, atmospherics, titles, finishing, audio_effects: audioFx,
      });
      setPresetName("");
      setPresetModal(false);
      loadPresets();
    } catch {
      Alert.alert("Couldn't save preset", "Try again.");
    }
  };

  const deletePreset = (p: PSPreset) => {
    Alert.alert("Delete preset", `Remove "${p.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.psDeletePreset(p.id); loadPresets(); } },
    ]);
  };

  const exportShotList = async () => {
    if (!result) return;
    const meta = [
      style && `Style: ${style}`,
      length && `Length: ${length}`,
      speed && `Speed: ${speed}`,
      transitions.length && `Transitions: ${transitions.join(", ")}`,
      atmospherics.length && `Atmosphere: ${atmospherics.join(", ")}`,
      titles.length && `Titles: ${titles.join(", ")}`,
      finishing.length && `Finishing: ${finishing.join(", ")}`,
      audioFx.length && `Audio FX: ${audioFx.join(", ")}`,
    ].filter(Boolean).join("\n");
    const text = `🎬 ${prompt.trim().slice(0, 60)} — ${kind === "animation" ? "AI Animation" : "AI Video"}\n\n${meta}\n\n${result.storyboard}\n\n— Made in Konphlux AI Video Suite`;
    try {
      await Share.share({ message: text });
    } catch {
      /* dismissed */
    }
  };

  const startRender = async () => {
    if (!projectId) return;
    setRenderStatus("rendering");
    setVideoUrl("");
    try {
      await api.psRender(projectId);
    } catch (e: any) {
      setRenderStatus("");
      Alert.alert("Can't render yet", e?.message || "Video rendering isn't available right now.");
    }
  };

  // Poll render status while a job is in flight.
  useEffect(() => {
    if (renderStatus !== "rendering" || !projectId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const s = await api.psRenderStatus(projectId);
        if (s.status === "ready") { setVideoUrl(s.video_url); setRenderStatus("ready"); }
        else if (s.status === "failed") { setRenderStatus("failed"); }
      } catch {
        /* keep polling */
      }
    }, 6000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [renderStatus, projectId]);

  const posterUrl = result?.poster_path ? fileUrl(result.poster_path) : "";
  const sections = result ? parseSections(result.storyboard) : [];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="psai-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>AI Video Suite</Text>
          <Eyebrow>Concept studio · storyboard + script</Eyebrow>
        </View>
        <Pressable testID="psai-projects" onPress={() => router.push("/pictureshow/projects")} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="folder-multiple" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        {/* Kind */}
        <View style={styles.tabs}>
          {(["video", "animation"] as PSKind[]).map((k) => (
            <Pressable key={k} testID={`psai-kind-${k}`} onPress={() => { setKind(k); }} style={[styles.tab, { backgroundColor: kind === k ? colors.brand : colors.surfaceSecondary, borderColor: kind === k ? colors.brand : colors.border }]}>
              <MaterialCommunityIcons name={k === "video" ? "movie-filter" : "animation-play"} size={16} color={kind === k ? colors.onBrandPrimary : colors.brand} />
              <Text style={[styles.tabText, { color: kind === k ? colors.onBrandPrimary : colors.onSurface }]}>{k === "video" ? "AI Video" : "AI Animation"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.note, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.muted} />
          <Text style={[styles.noteText, { color: colors.muted }]}>Builds a poster keyframe + a shot-ready storyboard & script. Save it, then render a real short clip.</Text>
        </View>

        {/* Presets */}
        <View style={styles.rowBetween}>
          <Text style={[styles.label, { color: colors.onSurface }]}>Presets</Text>
          <Pressable testID="psai-save-preset" onPress={() => setPresetModal(true)} style={styles.manageBtn}>
            <MaterialCommunityIcons name="content-save-plus" size={15} color={colors.brand} />
            <Text style={[styles.manageText, { color: colors.brand }]}>Save current</Text>
          </Pressable>
        </View>
        {presets.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.muted }]}>Save your favourite style + effects bundle, then apply it in one tap.</Text>
        ) : (
          <View style={styles.chipWrap}>
            {presets.map((p) => (
              <Pressable key={p.id} testID={`psai-preset-${p.id}`} onPress={() => applyPreset(p)} onLongPress={() => deletePreset(p)} style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="star-four-points" size={13} color={colors.brand} />
                <Text style={[styles.chipText, { color: colors.onSurface }]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Concept */}
        <Text style={[styles.label, { color: colors.onSurface }]}>Your concept</Text>
        <TextInput testID="psai-prompt" value={prompt} onChangeText={setPrompt} placeholder={kind === "video" ? "e.g. an airship race through storm clouds" : "e.g. a clockwork owl learns to fly"} placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

        {/* Style */}
        <Text style={[styles.label, { color: colors.onSurface }]}>Style</Text>
        <View style={styles.chipWrap}>
          {PS_STYLES.map((s) => {
            const active = style === s.key;
            return (
              <Pressable key={s.key} onPress={() => setStyle(active ? "" : s.key)} style={[styles.styleChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{s.key}</Text>
                <Text style={[styles.styleNote, { color: active ? colors.onBrandPrimary : colors.muted }]}>{s.note}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Length */}
        <Text style={[styles.label, { color: colors.onSurface }]}>Length</Text>
        <SingleChips options={PS_LENGTHS} value={length} onSelect={setLength} />

        {/* Characters */}
        <View style={styles.rowBetween}>
          <Text style={[styles.label, { color: colors.onSurface, marginTop: spacing.lg }]}>Characters</Text>
          <Pressable testID="psai-manage-chars" onPress={() => router.push("/pictureshow/characters")} style={styles.manageBtn}>
            <MaterialCommunityIcons name="account-plus" size={15} color={colors.brand} />
            <Text style={[styles.manageText, { color: colors.brand }]}>Manage</Text>
          </Pressable>
        </View>
        {characters.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.muted }]}>No characters yet. Tap Manage to create one with a reference photo.</Text>
        ) : (
          <View style={styles.chipWrap}>
            {characters.map((c) => {
              const active = charIds.includes(c.id);
              return (
                <Pressable key={c.id} onPress={() => setCharIds((ids) => toggle(ids, c.id))} style={[styles.charChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                  {c.reference_path ? (
                    <Image source={{ uri: c.reference_path }} style={styles.charAvatar} contentFit="cover" />
                  ) : (
                    <MaterialCommunityIcons name="account" size={16} color={active ? colors.onBrandPrimary : colors.muted} />
                  )}
                  <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Effect sections */}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <MultiSection title="Transition Effects" icon="transition" options={PS_TRANSITIONS} selected={transitions} onToggle={(v) => setTransitions((s) => toggle(s, v))} />
          <MultiSection title="Atmospheric Presets" icon="weather-fog" options={PS_ATMOSPHERICS} selected={atmospherics} onToggle={(v) => setAtmospherics((s) => toggle(s, v))} />
          <MultiSection title="Titles" icon="format-title" options={PS_TITLES} selected={titles} onToggle={(v) => setTitles((s) => toggle(s, v))} />
          <MultiSection title="Finishing Effects" icon="auto-fix" options={PS_FINISHING} selected={finishing} onToggle={(v) => setFinishing((s) => toggle(s, v))} />
          <MultiSection title="Audio Effects" icon="waveform" options={PS_AUDIO_EFFECTS} selected={audioFx} onToggle={(v) => setAudioFx((s) => toggle(s, v))} />
        </View>

        {/* Playback speed */}
        <Text style={[styles.label, { color: colors.onSurface }]}>Playback speed</Text>
        <SingleChips options={PS_SPEEDS} value={speed} onSelect={setSpeed} />

        {/* Soundtrack */}
        <Text style={[styles.label, { color: colors.onSurface }]}>Soundtrack</Text>
        {soundtrackPath ? (
          <View style={[styles.mediaRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="music-note" size={18} color={colors.brand} />
            <Text numberOfLines={1} style={[styles.mediaName, { color: colors.onSurface }]}>{soundtrackName}</Text>
            <Pressable onPress={() => { setSoundtrackPath(""); setSoundtrackName(""); }} hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          </View>
        ) : (
          <Pressable testID="psai-soundtrack" onPress={pickSoundtrack} disabled={uploadingAudio === "track"} style={[styles.mediaBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <MaterialCommunityIcons name="upload" size={18} color={colors.brand} />
            <Text style={[styles.mediaBtnText, { color: colors.onSurface }]}>{uploadingAudio === "track" ? "Uploading…" : "Upload audio track"}</Text>
          </Pressable>
        )}

        {/* Voice over */}
        <Text style={[styles.label, { color: colors.onSurface }]}>Voice-over</Text>
        {voiceoverPath ? (
          <View style={[styles.mediaRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Pressable onPress={() => voicePlayer.play()} hitSlop={8}>
              <MaterialCommunityIcons name="play-circle" size={22} color={colors.brand} />
            </Pressable>
            <Text numberOfLines={1} style={[styles.mediaName, { color: colors.onSurface }]}>Recorded voice-over</Text>
            <Pressable onPress={() => setVoiceoverPath("")} hitSlop={10}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          </View>
        ) : (
          <Pressable testID="psai-voiceover" onPress={recording ? stopRecording : startRecording} disabled={uploadingAudio === "voice"} style={[styles.mediaBtn, { borderColor: recording ? colors.error : colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <MaterialCommunityIcons name={recording ? "stop-circle" : "microphone"} size={18} color={recording ? colors.error : colors.brand} />
            <Text style={[styles.mediaBtnText, { color: recording ? colors.error : colors.onSurface }]}>{uploadingAudio === "voice" ? "Saving…" : recording ? "Stop recording" : "Record a voice-over"}</Text>
          </Pressable>
        )}

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label={result ? "Regenerate concept" : "Generate concept"} fullWidth loading={busy} onPress={generate} testID="psai-generate" style={{ marginTop: spacing.lg }} />
        {busy ? <Text style={[styles.working, { color: colors.muted }]}>Painting the keyframe & writing the shot list…</Text> : null}

        {result ? (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" transition={300} />
            ) : (
              <View style={[styles.posterFallback, { backgroundColor: colors.surfaceTertiary }]}>
                <MaterialCommunityIcons name="image-off-outline" size={28} color={colors.muted} />
                <Text style={[styles.noteText, { color: colors.muted }]}>Poster couldn&apos;t be generated, but your storyboard is ready.</Text>
              </View>
            )}
            <View style={[styles.storyCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {sections.map((s, i) => (
                <View key={i} style={{ marginBottom: i < sections.length - 1 ? spacing.md : 0 }}>
                  {s.key ? <Text style={[styles.storyKey, { color: colors.brand }]}>{s.key}</Text> : null}
                  <Text style={[styles.storyText, { color: colors.onSurface }]}>{s.body}</Text>
                </View>
              ))}
            </View>
            <ForgeButton label={saved ? "Saved to Projects ✓" : "Save to Projects"} variant={saved ? "outline" : "forge"} fullWidth onPress={saveProject} testID="psai-save" disabled={saved} />

            <Pressable testID="psai-export" onPress={exportShotList} style={[styles.mediaBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, justifyContent: "center" }]}>
              <MaterialCommunityIcons name="share-variant" size={18} color={colors.brand} />
              <Text style={[styles.mediaBtnText, { color: colors.onSurface }]}>Export / share shot list</Text>
            </Pressable>

            {/* Real video render */}
            {saved ? (
              renderStatus === "ready" && videoUrl ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={[styles.storyKey, { color: colors.brand }]}>RENDERED CLIP</Text>
                  <VideoPlayer uri={videoUrl} />
                  <ForgeButton label="Render again" variant="outline" fullWidth onPress={startRender} testID="psai-render-again" />
                </View>
              ) : renderStatus === "rendering" ? (
                <View style={[styles.renderBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <MaterialCommunityIcons name="movie-roll" size={22} color={colors.brand} />
                  <Text style={[styles.renderText, { color: colors.onSurface }]}>Rendering your clip… this can take a couple of minutes. You can leave this open.</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.xs }}>
                  <ForgeButton label="Render real video" fullWidth onPress={startRender} testID="psai-render" />
                  {renderStatus === "failed" ? <Text style={[styles.error, { color: colors.error }]}>That render didn&apos;t complete. Try again.</Text> : null}
                </View>
              )
            ) : (
              <Text style={[styles.emptyHint, { color: colors.muted, textAlign: "center" }]}>Save to Projects to unlock real video rendering.</Text>
            )}
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      {/* Save preset modal */}
      <Modal visible={presetModal} transparent animationType="fade" onRequestClose={() => setPresetModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPresetModal(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Save preset</Text>
            <Text style={[styles.emptyHint, { color: colors.muted }]}>Saves your current style, length, speed & effects as a reusable bundle.</Text>
            <TextInput testID="psai-preset-name" value={presetName} onChangeText={setPresetName} placeholder="Preset name (e.g. Moody Noir)" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface, marginTop: spacing.md }]} autoFocus />
            <ForgeButton label="Save preset" fullWidth onPress={savePreset} testID="psai-preset-confirm" style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  note: { flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.md, height: 38, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  styleChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, minWidth: "47%", flexGrow: 1 },
  styleNote: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  section: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 14 },
  countBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  countText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  manageBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.lg },
  manageText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  emptyHint: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
  charChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1 },
  charAvatar: { width: 30, height: 30, borderRadius: 15 },
  mediaBtn: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  mediaBtnText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  mediaName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  working: { fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.sm },
  poster: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md },
  posterFallback: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg },
  storyCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg },
  storyKey: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5, marginBottom: 3 },
  storyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  renderBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  renderText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.xl },
  modalCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: 4 },
});
