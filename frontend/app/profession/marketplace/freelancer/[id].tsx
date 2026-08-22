import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Freelancer } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { RESUME_THEMES, shareResumePdf } from "@/src/utils/resumePdf";

export default function FreelancerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [f, setF] = useState<Freelancer | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setF(await api.freelancerGet(id));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const message = async () => {
    if (!f) return;
    try {
      const conv = await api.cbStartDm(f.user_id);
      router.push(`/chatterbox/conversation/${conv.id}`);
    } catch {
      Alert.alert("Couldn't open chat", "Try again.");
    }
  };

  const download = async () => {
    if (!f) return;
    Alert.alert("Choose a résumé theme", undefined, [
      ...RESUME_THEMES.map((t) => ({
        text: t.label,
        onPress: async () => {
          setDownloading(true);
          try { await shareResumePdf(f, t.key); } catch { Alert.alert("Couldn't create PDF", "Please try again."); } finally { setDownloading(false); }
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const submitReview = async () => {
    if (!f) return;
    try {
      await api.freelancerReview(f.id, rating, comment.trim(), "");
      setReviewing(false); setComment(""); setRating(5);
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't submit", e?.message || "Try again.");
    }
  };

  if (loading) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Opening profile…" /></View>;
  if (!f) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.xxl }}>Profile not found.</Text></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="fd-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Freelancer</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          {f.avatar_url ? (
            <Image source={{ uri: f.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surfaceTertiary }]}>
              <MaterialCommunityIcons name="account" size={34} color={colors.muted} />
            </View>
          )}
          <Text style={[styles.name, { color: colors.onSurface }]}>{f.name}</Text>
          {f.headline ? <Text style={[styles.headline, { color: colors.brand }]}>{f.headline}</Text> : null}
          <Text style={[styles.meta, { color: colors.muted }]}>{[f.location, f.hourly_rate ? `$${f.hourly_rate}/hr` : "", f.category].filter(Boolean).join(" · ")}</Text>
          {(f.review_count || 0) > 0 ? (
            <Text style={[styles.ratingLine, { color: colors.brand }]}>★ {f.avg_rating} · {f.review_count} review{f.review_count === 1 ? "" : "s"}</Text>
          ) : null}
          {f.available ? <View style={[styles.availBadge, { backgroundColor: "#2F855A22", borderColor: "#2F855A" }]}><Text style={[styles.availText, { color: "#2F855A" }]}>● Available for work</Text></View> : null}
        </View>

        {f.bio ? (<><Section title="About" /><Text style={[styles.body, { color: colors.onSurface }]}>{f.bio}</Text></>) : null}

        {(f.skills || []).length > 0 ? (
          <><Section title="Skills" />
          <View style={styles.chipWrap}>
            {f.skills.map((s) => (
              <View key={s} style={[styles.skill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={[styles.skillText, { color: colors.brand }]}>{s}</Text>
              </View>
            ))}
          </View></>
        ) : null}

        {(f.experience || []).filter((e) => e.role || e.org || e.detail).length > 0 ? (
          <><Section title="Experience" />
          {f.experience.filter((e) => e.role || e.org || e.detail).map((e, i) => (
            <View key={i} style={{ marginBottom: spacing.md }}>
              <Text style={[styles.expHead, { color: colors.onSurface }]}>{[e.role, e.org].filter(Boolean).join(" · ")}</Text>
              {e.detail ? <Text style={[styles.expDetail, { color: colors.muted }]}>{e.detail}</Text> : null}
            </View>
          ))}</>
        ) : null}

        {(f.links || []).length > 0 ? (
          <><Section title="Links" />
          {f.links.map((l) => (
            <Pressable key={l} onPress={() => Linking.openURL(l.startsWith("http") ? l : `https://${l}`).catch(() => {})}>
              <Text style={[styles.link, { color: colors.brand }]}>{l}</Text>
            </Pressable>
          ))}</>
        ) : null}

        <View style={styles.reviewHead}>
          <Text style={[styles.section, { color: colors.onSurface, marginTop: 0 }]}>Reviews</Text>
          {f.can_review ? (
            <Pressable onPress={() => setReviewing((v) => !v)} testID="fd-review-toggle"><Text style={[styles.reviewToggle, { color: colors.brand }]}>{reviewing ? "Cancel" : "Leave a review"}</Text></Pressable>
          ) : null}
        </View>
        {reviewing ? (
          <View style={[styles.reviewForm, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} testID={`fd-star-${n}`}>
                  <MaterialCommunityIcons name={n <= rating ? "star" : "star-outline"} size={28} color={colors.brand} />
                </Pressable>
              ))}
            </View>
            <TextInput value={comment} onChangeText={setComment} placeholder="Share how the gig went…" placeholderTextColor={colors.muted} multiline style={[styles.reviewInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="fd-review-input" />
            <ForgeButton label="Submit review" fullWidth onPress={submitReview} testID="fd-review-submit" style={{ marginTop: spacing.sm }} />
          </View>
        ) : null}
        {(f.reviews || []).length === 0 ? (
          <Text style={[styles.noReviews, { color: colors.muted }]}>No reviews yet.</Text>
        ) : (
          (f.reviews || []).map((r) => (
            <View key={r.id} style={[styles.reviewCard, { borderColor: colors.border }]}>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewer, { color: colors.onSurface }]}>{r.reviewer_name}</Text>
                <Text style={[styles.reviewStars, { color: colors.brand }]}>{"★".repeat(r.rating)}</Text>
              </View>
              {r.comment ? <Text style={[styles.reviewComment, { color: colors.muted }]}>{r.comment}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="fd-pdf" onPress={download} disabled={downloading} style={[styles.pdfBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <MaterialCommunityIcons name="file-download-outline" size={18} color={colors.brand} />
          <Text style={[styles.pdfText, { color: colors.onSurface }]}>{downloading ? "Preparing…" : "PDF"}</Text>
        </Pressable>
        {!f.is_me ? (
          <View style={{ flex: 1 }}>
            <ForgeButton label="Message" fullWidth onPress={message} testID="fd-message" />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <ForgeButton label="Edit résumé" variant="outline" fullWidth onPress={() => router.push("/profession/marketplace/edit")} testID="fd-edit" />
          </View>
        )}
      </View>
    </View>
  );
}

function Section({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.section, { color: colors.onSurface }]}>{title}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 18 },
  top: { alignItems: "center" },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.display, fontSize: 24, marginTop: spacing.md, textAlign: "center" },
  headline: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 4, textAlign: "center" },
  meta: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: 6, textAlign: "center" },
  ratingLine: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 6 },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xl, marginBottom: spacing.sm },
  reviewToggle: { fontFamily: fonts.bodyBold, fontSize: 13 },
  reviewForm: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  stars: { flexDirection: "row", gap: 4, marginBottom: spacing.sm },
  reviewInput: { minHeight: 70, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, fontFamily: fonts.body, fontSize: 14, textAlignVertical: "top" },
  noReviews: { fontFamily: fonts.body, fontSize: 13.5 },
  reviewCard: { borderTopWidth: 1, paddingVertical: spacing.md },
  reviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewer: { fontFamily: fonts.bodyBold, fontSize: 14 },
  reviewStars: { fontFamily: fonts.body, fontSize: 14 },
  reviewComment: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  availBadge: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, marginTop: spacing.md },
  availText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  section: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: spacing.xl, marginBottom: spacing.sm },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  skill: { paddingHorizontal: spacing.md, height: 34, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  skillText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  expHead: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  expDetail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 2 },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, marginBottom: 6 },
  actionBar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: spacing.lg, flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.lg, height: 50, borderRadius: radius.md, borderWidth: 1 },
  pdfText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
