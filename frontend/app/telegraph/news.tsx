import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, NewsCluster } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const TOPICS = ["following", "top", "blindspot", "technology", "business", "science", "health", "sports", "world", "politics"];
const TOPIC_LABEL: Record<string, string> = { following: "Following", top: "Top", blindspot: "Blindspot" };
const BIAS_COLOR: Record<string, string> = { Left: "#3B6FE0", Center: "#7A7A85", Right: "#D0453B" };

function timeAgo(iso: string): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function CoverageBar({ coverage }: { coverage: { Left: number; Center: number; Right: number } }) {
  const total = coverage.Left + coverage.Center + coverage.Right || 1;
  return (
    <View style={styles.covBar}>
      {(["Left", "Center", "Right"] as const).map((k) =>
        coverage[k] > 0 ? (
          <View key={k} style={{ flex: coverage[k] / total, backgroundColor: BIAS_COLOR[k] }} />
        ) : null,
      )}
    </View>
  );
}

function StoryCard({ cluster }: { cluster: NewsCluster }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [following, setFollowing] = useState(!!cluster.following);
  const [saved, setSaved] = useState(false);
  const total = cluster.source_count || 1;

  const toggleFollow = async () => {
    setFollowing((f) => !f);
    try {
      await api.tgNewsFollow({
        headline: cluster.headline,
        sources: cluster.sources.map((s) => s.source_name),
        coverage: cluster.coverage,
        image_url: cluster.image_url,
        url: cluster.sources[0]?.url || "",
      });
    } catch { setFollowing((f) => !f); }
  };

  const saveToVault = async () => {
    if (saved) return;
    setSaved(true);
    try {
      await api.vaultSave({
        source: "other", ref_id: `news-${cluster.id}`, title: cluster.headline,
        image_url: cluster.image_url, subtitle: "News",
        text: `${cluster.summary}\n\nCoverage: ${cluster.source_count} source(s).`,
        notes: cluster.sources.map((s) => `${s.source_name} (${s.bias}): ${s.url}`).join("\n"),
      });
    } catch { setSaved(false); }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      {cluster.image_url ? <Image source={{ uri: cluster.image_url }} style={styles.cover} contentFit="cover" transition={180} /> : null}
      <View style={styles.cardBody}>
        <Text style={[styles.headline, { color: colors.onSurface }]}>{cluster.headline}</Text>
        {cluster.summary ? <Text numberOfLines={3} style={[styles.summary, { color: colors.muted }]}>{cluster.summary}</Text> : null}

        <View style={styles.actionRow}>
          <Pressable onPress={toggleFollow} testID={`news-follow-${cluster.id}`} style={[styles.actBtn, { borderColor: following ? colors.brand : colors.border, backgroundColor: following ? colors.brand : "transparent" }]}>
            <MaterialCommunityIcons name={following ? "bell" : "bell-outline"} size={15} color={following ? colors.onBrandPrimary : colors.brand} />
            <Text style={[styles.actText, { color: following ? colors.onBrandPrimary : colors.brand }]}>{following ? "Following" : "Follow story"}</Text>
          </Pressable>
          <Pressable onPress={saveToVault} testID={`news-save-${cluster.id}`} style={[styles.actBtn, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name={saved ? "bookmark-check" : "bookmark-plus-outline"} size={15} color={colors.brand} />
            <Text style={[styles.actText, { color: colors.brand }]}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={styles.covRow}>
          <CoverageBar coverage={cluster.coverage} />
          <Text style={[styles.covMeta, { color: colors.muted }]}>{cluster.source_count} source{cluster.source_count !== 1 ? "s" : ""}</Text>
        </View>
        <View style={styles.legend}>
          {(["Left", "Center", "Right"] as const).map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: BIAS_COLOR[k] }]} />
              <Text style={[styles.legendText, { color: colors.muted }]}>{k} {Math.round((cluster.coverage[k] / total) * 100)}%</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => setOpen((o) => !o)} testID={`news-toggle-${cluster.id}`} style={styles.toggle}>
          <Text style={[styles.toggleText, { color: colors.brand }]}>{open ? "Hide coverage" : "Compare coverage"}</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.brand} />
        </Pressable>

        {open ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {cluster.sources.map((s, i) => (
              <Pressable key={i} testID={`news-source-${cluster.id}-${i}`} onPress={() => s.url && WebBrowser.openBrowserAsync(s.url)} style={[styles.source, { borderColor: colors.border }]}>
                <View style={[styles.biasTag, { backgroundColor: BIAS_COLOR[s.bias] }]}>
                  <Text style={styles.biasText}>{s.bias[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.srcName, { color: colors.brand }]}>{s.source_name}</Text>
                  <Text numberOfLines={2} style={[styles.srcTitle, { color: colors.onSurface }]}>{s.title}</Text>
                </View>
                <MaterialCommunityIcons name="open-in-new" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function TelegraphNews() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState("top");
  const [clusters, setClusters] = useState<NewsCluster[]>([]);
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.tgNews(topic);
      setConfigured(res.configured);
      setClusters(res.clusters);
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [topic]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="news-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>News</Text>
          <Eyebrow>The same story, from every angle</Eyebrow>
        </View>
      </View>

      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRow}>
          {TOPICS.map((t) => {
            const active = topic === t;
            return (
              <Pressable key={t} testID={`news-topic-${t}`} onPress={() => setTopic(t)} style={[styles.topicChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                <Text style={[styles.topicText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{TOPIC_LABEL[t] ?? (t.charAt(0).toUpperCase() + t.slice(1))}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {status === "loading" ? <Loading label="Gathering the headlines…" /> :
       status === "error" ? <ErrorState onRetry={load} /> :
       !configured ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState icon="newspaper-variant-outline" title="News is being set up" subtitle="Live headlines will appear here once the news source is connected." />
        </View>
       ) : (
        <FlatList
          data={clusters}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <StoryCard cluster={item} />}
          ListEmptyComponent={<EmptyState icon="newspaper-variant-outline" title="No stories right now" subtitle="Try another topic or check back shortly." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  topicRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  topicChip: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  topicText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 160 },
  cardBody: { padding: spacing.md, gap: spacing.sm },
  headline: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 24 },
  summary: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actBtn: { flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  actText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  covRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  covBar: { flex: 1, flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden" },
  covMeta: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  legend: { flexDirection: "row", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontFamily: fonts.body, fontSize: 11.5 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  source: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm },
  biasTag: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  biasText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#fff" },
  srcName: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  srcTitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 1 },
});
