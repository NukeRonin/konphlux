import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, CBConvSummary } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const FEATURES: { label: string; icon: IconName; route: string; tint?: string }[] = [
  { label: "Private messaging", icon: "message-text", route: "/chatterbox/inbox" },
  { label: "Group chats", icon: "account-multiple", route: "/chatterbox/inbox?filter=group" },
  { label: "Voice calls", icon: "phone", route: "/chatterbox/new?call=voice" },
  { label: "Video calls", icon: "video", route: "/chatterbox/new?call=video" },
];

export default function ChatterboxHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [convs, setConvs] = useState<CBConvSummary[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const res = await api.cbConversations();
      setConvs(res.conversations);
      setUnread(res.total_unread);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="cb-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: colors.onSurface }]}>
            Chatterbox
          </Text>
          <Eyebrow>Every conversation, one inbox</Eyebrow>
        </View>
        <Pressable testID="cb-new" onPress={() => router.push("/chatterbox/new")} style={[styles.iconBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="pencil" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Ringing the switchboard…" />
      ) : status === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Feature grid */}
          <View style={styles.grid}>
            {FEATURES.map((f) => (
              <Pressable key={f.label} testID={`cb-feature-${f.label}`} onPress={() => router.push(f.route as any)} style={[styles.gridItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <View style={[styles.gridIcon, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name={f.icon} size={22} color={colors.brand} />
                </View>
                <Text style={[styles.gridText, { color: colors.onSurface }]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent conversations */}
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Recent chats</Text>
            {unread > 0 ? (
              <View style={[styles.unreadPill, { backgroundColor: colors.brand }]}>
                <Text style={[styles.unreadText, { color: colors.onBrandPrimary }]}>{unread} unread</Text>
              </View>
            ) : null}
          </View>

          {convs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="chat-plus-outline" size={30} color={colors.brand} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No conversations yet</Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>Start a private message or a group chat to begin.</Text>
              <Pressable testID="cb-empty-new" onPress={() => router.push("/chatterbox/new")} style={[styles.startBtn, { backgroundColor: colors.brand }]}>
                <Text style={[styles.startText, { color: colors.onBrandPrimary }]}>New message</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {convs.slice(0, 6).map((c) => (
                <Pressable key={c.id} testID={`cb-conv-${c.id}`} onPress={() => router.push(`/chatterbox/conversation/${c.id}`)} style={[styles.convRow, { borderColor: colors.border }]}>
                  <Image source={{ uri: c.avatar }} style={styles.avatar} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.convTitle, { color: colors.onSurface }]}>
                      {c.type === "group" ? "👥 " : ""}{c.title}
                    </Text>
                    <Text numberOfLines={1} style={[styles.convLast, { color: colors.muted }]}>{c.last_message || "No messages yet"}</Text>
                  </View>
                  {c.unread > 0 ? <View style={[styles.dot, { backgroundColor: colors.brand }]} /> : null}
                </Pressable>
              ))}
              <Pressable testID="cb-see-inbox" onPress={() => router.push("/chatterbox/inbox")} style={styles.seeInbox}>
                <Text style={[styles.seeInboxText, { color: colors.brand }]}>Open full inbox →</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridItem: { width: "48.5%", flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  gridIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  gridText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12.5 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18 },
  unreadPill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  unreadText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  emptyCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.xl, alignItems: "center", gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 16 },
  emptySub: { fontFamily: fonts.body, fontSize: 13, textAlign: "center" },
  startBtn: { height: 42, paddingHorizontal: spacing.xl, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  startText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  convRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  convTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  convLast: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  seeInbox: { alignItems: "center", paddingVertical: spacing.md },
  seeInboxText: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
