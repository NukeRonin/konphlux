import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, RetroBusiness } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { catMeta, fmtDistance } from "@/src/utils/retro";
import { Stars } from "@/src/components/RetroStars";

function timeAgo(iso: string) {
  try {
    const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch { return ""; }
}

export default function BusinessDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [biz, setBiz] = useState<RetroBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try { setBiz(await api.retroBusiness(id)); } catch { /* ignore */ } finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!id || rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      await api.retroAddReview(id, { rating, text: text.trim() });
      setRating(0); setText("");
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't submit", e?.message || "Try again.");
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.surface }]}>
        <View style={{ height: insets.top }} />
        <Loading label="Loading…" />
      </View>
    );
  }
  if (!biz) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.muted, fontFamily: fonts.body }}>Business not found.</Text>
      </View>
    );
  }

  const m = catMeta(biz.category);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {biz.image ? (
            <Image source={{ uri: biz.image }} style={styles.heroImg} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.heroImg, { backgroundColor: `${m.color}22`, alignItems: "center", justifyContent: "center" }]}>
              <MaterialCommunityIcons name={m.icon} size={48} color={m.color} />
            </View>
          )}
          <Pressable onPress={() => router.back()} hitSlop={12} style={[styles.backBtn, { top: insets.top + spacing.sm, backgroundColor: "rgba(0,0,0,0.45)" }]} testID="biz-back">
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={{ padding: spacing.lg }}>
          <View style={[styles.catPill, { backgroundColor: `${m.color}22`, alignSelf: "flex-start" }]}>
            <MaterialCommunityIcons name={m.icon} size={12} color={m.color} />
            <Text style={[styles.catText, { color: m.color }]}>{biz.category}</Text>
          </View>
          <Text style={[styles.name, { color: colors.onSurface }]}>{biz.name}</Text>
          <View style={styles.ratingRow}>
            <Stars rating={biz.avg_rating} size={16} />
            <Text style={[styles.ratingText, { color: colors.onSurface }]}>{biz.avg_rating.toFixed(1)}</Text>
            <Text style={[styles.ratingCount, { color: colors.muted }]}>· {biz.review_count} {biz.review_count === 1 ? "review" : "reviews"}</Text>
          </View>
          {biz.address ? (
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>{biz.address}{biz.distance_km != null ? ` · ${fmtDistance(biz.distance_km)}` : ""}</Text>
            </View>
          ) : null}
          {biz.description ? <Text style={[styles.desc, { color: colors.onSurface }]}>{biz.description}</Text> : null}

          {/* Write a review */}
          {biz.can_review ? (
            <View style={[styles.reviewBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.boxTitle, { color: colors.onSurface }]}>Rate this place</Text>
              <View style={styles.starPick}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} testID={`biz-star-${n}`}>
                    <MaterialCommunityIcons name={rating >= n ? "star" : "star-outline"} size={34} color={rating >= n ? "#D69E2E" : colors.muted} />
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={text} onChangeText={setText} placeholder="Share what you thought (optional)" placeholderTextColor={colors.muted}
                multiline style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.onSurface }]} testID="biz-review-text"
              />
              <Pressable onPress={submit} disabled={rating === 0 || submitting} style={[styles.submitBtn, { backgroundColor: rating > 0 ? colors.brand : colors.surfaceTertiary }]} testID="biz-review-submit">
                <Text style={[styles.submitText, { color: rating > 0 ? colors.onBrandPrimary : colors.muted }]}>{submitting ? "Submitting…" : "Submit review"}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.reviewedNote, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.brand} />
              <Text style={[styles.reviewedText, { color: colors.muted }]}>You&apos;ve reviewed this place. Thanks!</Text>
            </View>
          )}

          <Eyebrow style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Reviews</Eyebrow>
          {(biz.reviews || []).length === 0 ? (
            <Text style={[styles.noReviews, { color: colors.muted }]}>No reviews yet. Be the first to weigh in.</Text>
          ) : (
            (biz.reviews || []).map((r) => (
              <View key={r.id} style={[styles.review, { borderBottomColor: colors.border }]}>
                <View style={styles.reviewHead}>
                  <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={[styles.avatarText, { color: colors.brand }]}>{(r.author_name || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.author, { color: colors.onSurface }]}>{r.author_name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Stars rating={r.rating} size={12} />
                      <Text style={[styles.ago, { color: colors.muted }]}>{timeAgo(r.created_at)}</Text>
                    </View>
                  </View>
                </View>
                {r.text ? <Text style={[styles.reviewText, { color: colors.onSurface }]}>{r.text}</Text> : null}
              </View>
            ))
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { position: "relative" },
  heroImg: { width: "100%", height: 220 },
  backBtn: { position: "absolute", left: spacing.lg, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  catPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, height: 24, borderRadius: radius.pill },
  catText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  name: { fontFamily: fonts.display, fontSize: 26, marginTop: spacing.sm },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  ratingText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  ratingCount: { fontFamily: fonts.body, fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: spacing.sm },
  metaText: { fontFamily: fonts.body, fontSize: 13.5 },
  desc: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, marginTop: spacing.md },
  reviewBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  boxTitle: { fontFamily: fonts.bodyBold, fontSize: 15 },
  starPick: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md, justifyContent: "center" },
  input: { minHeight: 72, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, fontFamily: fonts.body, fontSize: 15, textAlignVertical: "top" },
  submitBtn: { height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.md },
  submitText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  reviewedNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  reviewedText: { fontFamily: fonts.bodyMedium, fontSize: 13.5 },
  noReviews: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  review: { paddingVertical: spacing.md, borderBottomWidth: 1 },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.displaySemi, fontSize: 15 },
  author: { fontFamily: fonts.bodyBold, fontSize: 14 },
  ago: { fontFamily: fonts.body, fontSize: 11.5 },
  reviewText: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, marginTop: spacing.sm },
});
