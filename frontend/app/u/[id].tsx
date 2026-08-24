import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, fileUrl, FriendCard, ProfileCreation, ProfileReview, UserProfile } from "@/src/api/client";
import { AvatarInitials } from "@/src/components/AvatarInitials";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const REL_LABEL: Record<string, string> = {
  friends: "Friends", outgoing: "Request sent", incoming: "Wants to be friends",
};
const KIND_ICON: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  pic: "image", logo: "shield-star", gif: "animation-play", meme: "emoticon-happy",
  music: "music", sfx: "waveform", course: "school", art: "palette",
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [creations, setCreations] = useState<ProfileCreation[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [busy, setBusy] = useState(false);
  const [mutualOpen, setMutualOpen] = useState(false);
  const [mutual, setMutual] = useState<FriendCard[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const p = await api.userProfile(id);
      setProfile(p);
      setStatus("ready");
      try { const c = await api.userCreations(id); setCreations(c.creations); setReviews(c.reviews); } catch { /* ignore */ }
    } catch { setStatus("error"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>) => {
    if (!id || busy) return;
    setBusy(true);
    try { await fn(); setProfile(await api.userProfile(id)); } catch { /* ignore */ } finally { setBusy(false); }
  };

  const message = async () => {
    if (!profile || busy) return;
    setBusy(true);
    try { const conv = await api.cbStartDm(profile.id); router.push(`/chatterbox/conversation/${conv.id}`); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  const openMutual = async () => {
    if (!id) return;
    setMutualOpen(true);
    try { setMutual(await api.userMutual(id)); } catch { /* ignore */ }
  };

  const rel = profile?.relation ?? "none";

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="user-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Profile</Text>
          <Eyebrow>Konphlux member</Eyebrow>
        </View>
      </View>

      {status === "loading" ? (
        <Loading label="Opening profile…" />
      ) : status === "error" || !profile ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
          <View style={styles.body}>
            <AvatarInitials name={profile.display_name} size={96} />
            <Text style={[styles.name, { color: colors.onSurface }]}>{profile.display_name}</Text>
            {profile.handle ? <Text style={[styles.handle, { color: colors.muted }]}>{profile.handle}</Text> : null}
            <Text style={[styles.count, { color: colors.muted }]}>{profile.friend_count} friend{profile.friend_count === 1 ? "" : "s"}</Text>
            {profile.relation !== "self" && profile.mutual_count > 0 ? (
              <Pressable testID="user-mutual" onPress={openMutual} hitSlop={8}>
                <Text style={[styles.mutual, { color: colors.brand }]}>{profile.mutual_count} mutual friend{profile.mutual_count === 1 ? "" : "s"} ›</Text>
              </Pressable>
            ) : null}

            {rel !== "none" && rel !== "self" ? (
              <View style={[styles.statusBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name={rel === "friends" ? "account-check" : rel === "incoming" ? "account-clock" : "account-arrow-right"} size={15} color={colors.brand} />
                <Text style={[styles.statusText, { color: colors.onSurface }]}>{REL_LABEL[rel]}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {busy ? (
                <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
              ) : rel === "self" ? (
                <Text style={[styles.selfNote, { color: colors.muted }]}>This is you.</Text>
              ) : rel === "none" ? (
                <Pressable testID="user-add" onPress={() => act(() => api.friendRequest(profile.id))} style={[styles.primaryBtn, { backgroundColor: colors.brand }]}>
                  <MaterialCommunityIcons name="account-plus" size={18} color={colors.onBrandPrimary} />
                  <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Send friend request</Text>
                </Pressable>
              ) : rel === "outgoing" ? (
                <Pressable testID="user-cancel" onPress={() => act(() => api.friendRemove(profile.id))} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.outlineText, { color: colors.muted }]}>Cancel request</Text>
                </Pressable>
              ) : rel === "incoming" ? (
                <View style={styles.dualRow}>
                  <Pressable testID="user-accept" onPress={() => act(() => api.friendAccept(profile.id))} style={[styles.primaryBtn, { backgroundColor: colors.brand, flex: 1 }]}>
                    <MaterialCommunityIcons name="check" size={18} color={colors.onBrandPrimary} />
                    <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Accept</Text>
                  </Pressable>
                  <Pressable testID="user-reject" onPress={() => act(() => api.friendDecline(profile.id))} style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}>
                    <Text style={[styles.outlineText, { color: colors.muted }]}>Reject</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <Pressable testID="user-message" onPress={message} style={[styles.primaryBtn, { backgroundColor: colors.brand }]}>
                    <MaterialCommunityIcons name="message-text" size={18} color={colors.onBrandPrimary} />
                    <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Message</Text>
                  </Pressable>
                  <Pressable testID="user-unfriend" onPress={() => act(() => api.friendRemove(profile.id))} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="account-remove-outline" size={17} color={colors.muted} />
                    <Text style={[styles.outlineText, { color: colors.muted }]}>Remove friend</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {/* Public creations */}
          {creations.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Creations</Text>
              <View style={styles.grid}>
                {creations.map((c) => {
                  const img = c.image_path ? fileUrl(c.image_path) : c.image_url;
                  return (
                    <Pressable key={c.id} testID={`creation-${c.id}`} onPress={() => c.route && router.push(c.route as any)} style={[styles.tile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.tileImg} contentFit="cover" transition={200} />
                      ) : (
                        <View style={[styles.tileImg, styles.tileIconWrap]}>
                          <MaterialCommunityIcons name={KIND_ICON[c.kind] ?? "star"} size={30} color={colors.brand} />
                        </View>
                      )}
                      <Text numberOfLines={1} style={[styles.tileTitle, { color: colors.onSurface }]}>{c.title || c.kind}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Reviews written */}
          {reviews.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Reviews</Text>
              {reviews.map((r) => (
                <Pressable key={r.id} testID={`review-${r.id}`} onPress={() => router.push(`/brainboost/course/${r.course_id}`)} style={[styles.reviewCard, { borderBottomColor: colors.border }]}>
                  <View style={styles.reviewHead}>
                    <Text numberOfLines={1} style={[styles.reviewCourse, { color: colors.onSurface }]}>{r.course_title}</Text>
                    <View style={{ flexDirection: "row" }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <MaterialCommunityIcons key={n} name={n <= r.rating ? "star" : "star-outline"} size={13} color={n <= r.rating ? "#E0A500" : colors.muted} />
                      ))}
                    </View>
                  </View>
                  {r.text ? <Text style={[styles.reviewText, { color: colors.muted }]}>{r.text}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {creations.length === 0 && reviews.length === 0 ? (
            <Text style={[styles.emptyNote, { color: colors.muted }]}>No public creations or reviews yet.</Text>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={mutualOpen} transparent animationType="slide" onRequestClose={() => setMutualOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMutualOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>Mutual friends</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {mutual.map((m) => (
                <Pressable key={m.id} testID={`mutual-${m.id}`} onPress={() => { setMutualOpen(false); router.push(`/u/${m.id}`); }} style={[styles.mutualRow, { borderBottomColor: colors.border }]}>
                  <AvatarInitials name={m.display_name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mutualName, { color: colors.onSurface }]}>{m.display_name}</Text>
                    {m.handle ? <Text style={[styles.mutualHandle, { color: colors.muted }]}>{m.handle}</Text> : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              ))}
              {mutual.length === 0 ? <Text style={[styles.selfNote, { color: colors.muted }]}>Loading…</Text> : null}
            </ScrollView>
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
  body: { alignItems: "center", padding: spacing.xl, gap: spacing.xs },
  name: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.md },
  handle: { fontFamily: fonts.body, fontSize: 14 },
  count: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 2 },
  mutual: { fontFamily: fonts.bodyBold, fontSize: 12.5, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md },
  statusText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  actions: { width: "100%", marginTop: spacing.lg },
  dualRow: { flexDirection: "row", gap: spacing.sm },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 50, borderRadius: radius.md },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 50, borderRadius: radius.md, borderWidth: 1 },
  outlineText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  selfNote: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: spacing.md },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 17, marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { width: "48%", borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  tileImg: { width: "100%", height: 110 },
  tileIconWrap: { alignItems: "center", justifyContent: "center" },
  tileTitle: { fontFamily: fonts.bodyMedium, fontSize: 12.5, padding: spacing.sm },
  reviewCard: { paddingVertical: spacing.md, borderBottomWidth: 1, gap: 4 },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  reviewCourse: { fontFamily: fonts.bodyBold, fontSize: 14, flex: 1 },
  reviewText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  emptyNote: { fontFamily: fonts.body, fontSize: 14, textAlign: "center", marginTop: spacing.xl },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.displaySemi, fontSize: 18, marginBottom: spacing.md },
  mutualRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  mutualName: { fontFamily: fonts.bodyBold, fontSize: 15 },
  mutualHandle: { fontFamily: fonts.body, fontSize: 12.5 },
});
