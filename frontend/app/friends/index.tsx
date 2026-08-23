import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, FeedComment, fileUrl, FriendActivity, FriendCard } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type Rel = FriendCard & { relation?: string };

const VERB_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  created: "flask-round-bottom", published: "school", saved: "safe-square",
};

function timeAgo(iso: string): string {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Friends() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"people" | "activity">("people");
  const [data, setData] = useState<{ friends: FriendCard[]; incoming: FriendCard[]; outgoing: FriendCard[] }>({ friends: [], incoming: [], outgoing: [] });
  const [feed, setFeed] = useState<FriendActivity[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Rel[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => { try { setData(await api.friends()); } catch { /* ignore */ } }, []);
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try { setFeed((await api.friendsFeed()).activity); } catch { /* ignore */ } finally { setFeedLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); loadFeed(); }, [load, loadFeed]));

  const cheer = async (a: FriendActivity) => {
    setFeed((f) => f.map((x) => x.id === a.id ? { ...x, cheered: !x.cheered, cheers: x.cheers + (x.cheered ? -1 : 1) } : x));
    try { await api.feedCheer(a.id); } catch { loadFeed(); }
  };

  const toggleComments = async (a: FriendActivity) => {
    if (expanded === a.id) { setExpanded(null); return; }
    setExpanded(a.id); setComments([]); setCommentText("");
    try { setComments((await api.feedComments(a.id)).comments); } catch { /* ignore */ }
  };

  const postComment = async (a: FriendActivity) => {
    const txt = commentText.trim();
    if (!txt || commentBusy) return;
    setCommentBusy(true);
    try {
      const c = await api.feedAddComment(a.id, txt);
      setComments((cs) => [...cs, c]);
      setCommentText("");
      setFeed((f) => f.map((x) => x.id === a.id ? { ...x, comment_count: x.comment_count + 1 } : x));
    } catch { /* ignore */ } finally { setCommentBusy(false); }
  };

  const search = async (text: string) => {
    setQ(text);
    if (text.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    try { setResults(await api.friendsSearch(text.trim())); } catch { /* ignore */ } finally { setSearching(false); }
  };

  const act = async (id: string, fn: () => Promise<any>) => {
    setBusy(id);
    try { await fn(); await load(); if (q.trim()) await search(q); } catch { /* ignore */ } finally { setBusy(null); }
  };

  const Row = ({ item, action }: { item: Rel; action: React.ReactNode }) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <AvatarInitials name={item.display_name} size={40} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.onSurface }]}>{item.display_name}</Text>
        {item.handle ? <Text numberOfLines={1} style={[styles.handle, { color: colors.muted }]}>{item.handle}</Text> : null}
      </View>
      {busy === item.id ? <ActivityIndicator size="small" color={colors.brand} /> : action}
    </View>
  );

  const relBtn = (item: Rel) => {
    if (item.relation === "friends") return <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.tagText, { color: colors.muted }]}>Friends</Text></View>;
    if (item.relation === "outgoing") return <View style={[styles.tag, { backgroundColor: colors.surfaceSecondary }]}><Text style={[styles.tagText, { color: colors.muted }]}>Requested</Text></View>;
    if (item.relation === "incoming") return <Pressable testID={`accept-${item.id}`} onPress={() => act(item.id, () => api.friendAccept(item.id))} style={[styles.addBtn, { backgroundColor: colors.brand }]}><Text style={[styles.addText, { color: colors.onBrandPrimary }]}>Accept</Text></Pressable>;
    return <Pressable testID={`add-${item.id}`} onPress={() => act(item.id, () => api.friendRequest(item.id))} style={[styles.addBtn, { backgroundColor: colors.brand }]}><MaterialCommunityIcons name="account-plus" size={15} color={colors.onBrandPrimary} /><Text style={[styles.addText, { color: colors.onBrandPrimary }]}>Add</Text></Pressable>;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="friends-back"><MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Friends</Text>
          <Eyebrow>Find and connect with people</Eyebrow>
        </View>
      </View>

      <View style={styles.tabRow}>
        {(["people", "activity"] as const).map((tk) => (
          <Pressable key={tk} testID={`friends-tab-${tk}`} onPress={() => setTab(tk)} style={[styles.tabBtn, { borderBottomColor: tab === tk ? colors.brand : "transparent" }]}>
            <MaterialCommunityIcons name={tk === "people" ? "account-group" : "pulse"} size={17} color={tab === tk ? colors.brand : colors.muted} />
            <Text style={[styles.tabLabel, { color: tab === tk ? colors.brand : colors.muted }]}>{tk === "people" ? "People" : "Activity"}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "activity" ? (
        <FlatList
          data={feed}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingVertical: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => {
            const img = item.image_path ? fileUrl(item.image_path) : item.image_url;
            const isOpen = expanded === item.id;
            return (
              <View style={[styles.feedItem, { borderBottomColor: colors.border }]}>
                <Pressable testID={`feed-${item.id}`} onPress={() => item.route && router.push(item.route as any)} style={styles.feedRow}>
                  <View style={[styles.feedIcon, { backgroundColor: colors.surfaceTertiary }]}>
                    <MaterialCommunityIcons name={VERB_ICON[item.verb] ?? "star"} size={18} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.feedText, { color: colors.onSurface }]}>
                      <Text style={{ fontFamily: fonts.bodyBold }}>{item.actor}</Text>
                      {` ${item.verb} ${item.what}`}
                    </Text>
                    {item.title ? <Text numberOfLines={1} style={[styles.feedTitle, { color: colors.muted }]}>{item.title}</Text> : null}
                    <Text style={[styles.feedTime, { color: colors.muted }]}>{timeAgo(item.created_at)}</Text>
                  </View>
                  {img ? <Image source={{ uri: img }} style={styles.feedThumb} contentFit="cover" transition={200} /> : null}
                </Pressable>
                <View style={styles.feedActions}>
                  <Pressable testID={`cheer-${item.id}`} onPress={() => cheer(item)} hitSlop={8} style={styles.actionBtn}>
                    <MaterialCommunityIcons name={item.cheered ? "hand-clap" : "hand-clap"} size={18} color={item.cheered ? colors.brand : colors.muted} />
                    <Text style={[styles.actionText, { color: item.cheered ? colors.brand : colors.muted }]}>Cheer{item.cheers ? ` ${item.cheers}` : ""}</Text>
                  </Pressable>
                  <Pressable testID={`comment-${item.id}`} onPress={() => toggleComments(item)} hitSlop={8} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="comment-outline" size={17} color={isOpen ? colors.brand : colors.muted} />
                    <Text style={[styles.actionText, { color: isOpen ? colors.brand : colors.muted }]}>Comment{item.comment_count ? ` ${item.comment_count}` : ""}</Text>
                  </Pressable>
                </View>
                {isOpen ? (
                  <View style={styles.commentBox}>
                    {comments.map((c) => (
                      <View key={c.id} style={styles.commentRow}>
                        <Text style={[styles.commentAuthor, { color: colors.onSurface }]}>{c.author}</Text>
                        <Text style={[styles.commentText, { color: colors.muted }]}>{c.text}</Text>
                      </View>
                    ))}
                    <View style={[styles.commentInputRow, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
                      <TextInput testID={`comment-input-${item.id}`} value={commentText} onChangeText={setCommentText} placeholder="Add a comment…" placeholderTextColor={colors.muted} style={[styles.commentInput, { color: colors.onSurface }]} />
                      <Pressable testID={`comment-send-${item.id}`} onPress={() => postComment(item)} disabled={!commentText.trim() || commentBusy} hitSlop={8}>
                        <MaterialCommunityIcons name="send" size={20} color={commentText.trim() ? colors.brand : colors.muted} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{feedLoading ? "Loading…" : "No friend activity yet. Add friends to see what they create and save."}</Text>}
        />
      ) : (
      <>
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
        <TextInput testID="friend-search" value={q} onChangeText={search} placeholder="Search by name or handle…" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.onSurface }]} autoCapitalize="none" />
        {q ? <Pressable onPress={() => search("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
      </View>

      {q.trim() ? (
        <FlatList
          data={results}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Row item={item} action={relBtn(item)} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{searching ? "Searching…" : "No people found."}</Text>}
        />
      ) : (
        <FlatList
          data={data.friends}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Row item={item} action={<Pressable testID={`remove-${item.id}`} onPress={() => act(item.id, () => api.friendRemove(item.id))} hitSlop={8}><MaterialCommunityIcons name="account-remove-outline" size={22} color={colors.muted} /></Pressable>} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          ListHeaderComponent={
            data.incoming.length ? (
              <View>
                <Text style={[styles.section, { color: colors.onSurface }]}>Requests ({data.incoming.length})</Text>
                {data.incoming.map((item) => (
                  <Row key={item.id} item={item} action={
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Pressable testID={`accept-${item.id}`} onPress={() => act(item.id, () => api.friendAccept(item.id))} style={[styles.addBtn, { backgroundColor: colors.brand }]}><Text style={[styles.addText, { color: colors.onBrandPrimary }]}>Accept</Text></Pressable>
                      <Pressable testID={`decline-${item.id}`} onPress={() => act(item.id, () => api.friendDecline(item.id))} style={[styles.declineBtn, { borderColor: colors.border }]}><Text style={[styles.addText, { color: colors.muted }]}>Ignore</Text></Pressable>
                    </View>
                  } />
                ))}
                <Text style={[styles.section, { color: colors.onSurface, marginTop: spacing.md }]}>Your friends</Text>
              </View>
            ) : <Text style={[styles.section, { color: colors.onSurface }]}>Your friends</Text>
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No friends yet. Search above to add some.</Text>}
        />
      )}
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  tabRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.xl },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: spacing.md, borderBottomWidth: 2 },
  tabLabel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  feedItem: { borderBottomWidth: 1 },
  feedRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  feedIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  feedText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20 },
  feedTitle: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 2 },
  feedTime: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 3 },
  feedThumb: { width: 48, height: 48, borderRadius: radius.sm },
  feedActions: { flexDirection: "row", gap: spacing.xl, paddingHorizontal: spacing.lg + 50, paddingVertical: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  commentBox: { paddingHorizontal: spacing.lg + 50, paddingBottom: spacing.md, gap: spacing.xs },
  commentRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  commentAuthor: { fontFamily: fonts.bodyBold, fontSize: 13 },
  commentText: { fontFamily: fonts.body, fontSize: 13, flexShrink: 1 },
  commentInputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, height: 40, marginTop: spacing.xs },
  commentInput: { flex: 1, fontFamily: fonts.body, fontSize: 14 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, margin: spacing.lg, marginBottom: spacing.sm, height: 46, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  section: { fontFamily: fonts.displaySemi, fontSize: 15, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  name: { fontFamily: fonts.displaySemi, fontSize: 15 },
  handle: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  addText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  declineBtn: { height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tag: { height: 30, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  empty: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", padding: spacing.xxl },
});
