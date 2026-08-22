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

const LIVE = "#C0392B";
const CATEGORIES = ["Live Recordings", "Music", "Tutorials", "Comedy", "Documentaries", "Serials"];

export default function GoLive() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Live Recordings");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (title.trim().length < 2) return setError("Give your stream a title.");
    setBusy(true);
    setError("");
    try {
      const when = mode === "now" ? "now" : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const s = await api.streamoraGoLive({ title: title.trim(), category, when });
      if (s.status === "live") {
        router.replace({ pathname: "/pictureshow/streamora/watch", params: { url: s.video_url, title: s.title, channel: s.channel_name, status: "live", when: "" } });
      } else {
        router.replace("/pictureshow/streamora");
      }
    } catch {
      setError("Couldn't start your stream. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="golive-back">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Go live on Streamora</Text>
          <Eyebrow>Broadcast to Konphlux</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} bottomOffset={40} showsVerticalScrollIndicator={false}>
        {/* Mode */}
        <View style={styles.tabs}>
          {(["now", "schedule"] as const).map((m) => (
            <Pressable key={m} testID={`golive-mode-${m}`} onPress={() => setMode(m)} style={[styles.tab, { backgroundColor: mode === m ? LIVE : colors.surfaceSecondary, borderColor: mode === m ? LIVE : colors.border }]}>
              <MaterialCommunityIcons name={m === "now" ? "broadcast" : "calendar-clock"} size={16} color={mode === m ? "#fff" : colors.brand} />
              <Text style={[styles.tabText, { color: mode === m ? "#fff" : colors.onSurface }]}>{m === "now" ? "Start now" : "Schedule"}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Stream title</Text>
        <TextInput testID="golive-title" value={title} onChangeText={setTitle} placeholder="e.g. Late-night forge build" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />

        <Text style={[styles.label, { color: colors.onSurface }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c} testID={`golive-cat-${c}`} onPress={() => setCategory(c)} style={[styles.catChip, { backgroundColor: category === c ? colors.surfaceTertiary : "transparent", borderColor: category === c ? colors.brand : colors.border }]}>
              <Text style={[styles.catText, { color: category === c ? colors.brand : colors.muted }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[styles.hint, { color: colors.muted }]}>
          {mode === "now" ? "Your stream goes live immediately and appears in Live now." : "Your stream is scheduled for tomorrow and appears under Upcoming."}
        </Text>

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
        <ForgeButton label={mode === "now" ? "Start streaming" : "Schedule stream"} fullWidth loading={busy} onPress={submit} testID="golive-submit" style={{ marginTop: spacing.md }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1 },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { height: 50, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  catRow: { gap: spacing.sm },
  catChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  catText: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, marginTop: spacing.md, lineHeight: 18 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
