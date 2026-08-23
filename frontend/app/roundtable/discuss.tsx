import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Community, Thread } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { ErrorState, Loading } from "@/src/components/States";
import { ThreadRow } from "@/src/components/ThreadRow";
import { useTheme } from "@/src/theme/ThemeContext";
import { compactNumber, fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function DiscussCategory() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const cat = (category ?? "").trim();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [community, setCommunity] = useState<Community | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!cat) {
      setStatus("error");
      return;
    }
    try {
      setStatus("loading");
      const c = await api.rtCategory(cat);
      setCommunity(c);
      setThreads(c.threads ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [cat]);

  useEffect(() => {
    load();
  }, [load]);

  const onVoted = (t: Thread) => setThreads((prev) => prev.map((x) => (x.id === t.id ? t : x)));

  const startDiscussion = async () => {
    if (title.trim().length < 2) {
      setError("Give your discussion a title (2+ characters).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.rtDiscuss(cat, title.trim(), body.trim() || undefined);
      if (res.thread_id) {
        router.push(`/roundtable/thread/${res.thread_id}`);
      }
      setTitle("");
      setBody("");
      load();
    } catch {
      setError("Couldn't start the discussion. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="discuss-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onSurface }]}>
            {cat || "Roundtable"} Discussions
          </Text>
          <Eyebrow>Routed to the Roundtable</Eyebrow>
        </View>
        <Pressable
          testID="discuss-open-roundtable"
          onPress={() => router.push("/roundtable")}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="forum" size={20} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Opening the discussion…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxxl }]}
          bottomOffset={40}
          showsVerticalScrollIndicator={false}
        >
          {/* Category banner */}
          <LinearGradient
            colors={colors.brassGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.banner, { borderColor: colors.brandSecondary }]}
          >
            <View style={[styles.bannerIcon, { backgroundColor: "rgba(0,0,0,0.15)" }]}>
              <MaterialCommunityIcons name={(community?.icon as IconName) ?? "forum"} size={26} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTag, { color: colors.onBrandPrimary }]}>{cat}</Text>
              <Text style={[styles.bannerMeta, { color: colors.onBrandPrimary }]}>
                {compactNumber(community?.members ?? 0)} members · {threads.length} discussions
              </Text>
            </View>
          </LinearGradient>

          {/* Composer */}
          <View style={[styles.composer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Eyebrow>Start a discussion</Eyebrow>
            <TextInput
              testID="discuss-title"
              value={title}
              onChangeText={setTitle}
              placeholder={`What's on your mind about ${cat}?`}
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
              maxLength={140}
            />
            <TextInput
              testID="discuss-body"
              value={body}
              onChangeText={setBody}
              placeholder="Add some detail (optional)…"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.border }]}
            />
            {error ? <Text testID="discuss-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            <ForgeButton
              label="Post to the Roundtable"
              fullWidth
              loading={busy}
              onPress={startDiscussion}
              testID="discuss-submit"
              icon={<MaterialCommunityIcons name="feather" size={18} color={colors.onBrandPrimary} />}
              style={{ marginTop: spacing.md }}
            />
          </View>

          {/* Existing threads */}
          <View style={styles.rowHead}>
            <Eyebrow>Join a discussion</Eyebrow>
          </View>
          {threads.length === 0 ? (
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <MaterialCommunityIcons name="forum-outline" size={30} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No discussions yet — be the first to start one.
              </Text>
            </View>
          ) : (
            threads.map((t) => <ThreadRow key={t.id} thread={t} onVoted={onVoted} showCommunity={false} />)
          )}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 19 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  bannerIcon: { width: 48, height: 48, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  bannerTag: { fontFamily: fonts.display, fontSize: 20 },
  bannerMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2, opacity: 0.85 },
  composer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  rowHead: { marginTop: spacing.xl, marginBottom: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl, borderWidth: 1, borderRadius: radius.md, borderStyle: "dashed" },
  emptyText: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", paddingHorizontal: spacing.xl },
});
