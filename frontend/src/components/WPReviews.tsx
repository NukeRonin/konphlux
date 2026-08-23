import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api, WPReview } from "@/src/api/client";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

function Stars({ value, size, color, dim, onChange }: { value: number; size: number; color: string; dim: string; onChange?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = <MaterialCommunityIcons name={filled ? "star" : "star-outline"} size={size} color={filled ? color : dim} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} testID={`wp-star-${n}`}>{star}</Pressable>
        ) : <View key={n}>{star}</View>;
      })}
    </View>
  );
}

export function WPReviews({ stayId, canReview, onPosted }: { stayId: string; canReview: boolean; onPosted?: () => void }) {
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<WPReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try { setReviews(await api.wpStayReviews(stayId)); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [stayId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (sending) return;
    setSending(true);
    try {
      await api.wpAddReview(stayId, { rating, text: text.trim() });
      setText(""); setComposing(false);
      await load();
      onPosted?.();
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.onSurface }]}>Guest &amp; Host Reviews{reviews.length ? ` · ${reviews.length}` : ""}</Text>

      {canReview ? (
        composing ? (
          <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <Stars value={rating} size={28} color={colors.brand} dim={colors.muted} onChange={setRating} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Tell other travellers about your stay…"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, { color: colors.onSurface }]}
              testID="wp-review-input"
            />
            <Text style={[styles.syncNote, { color: colors.muted }]}>Your review will also appear in Retrospections.</Text>
            <View style={styles.composerRow}>
              <Pressable onPress={() => setComposing(false)} hitSlop={8}><Text style={[styles.cancel, { color: colors.muted }]}>Cancel</Text></Pressable>
              <Pressable onPress={submit} disabled={sending} style={[styles.postBtn, { backgroundColor: colors.brand }]} testID="wp-review-submit">
                {sending ? <ActivityIndicator size="small" color={colors.onBrandPrimary} /> : <Text style={[styles.postText, { color: colors.onBrandPrimary }]}>Post review</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setComposing(true)} style={[styles.writeBtn, { borderColor: colors.brand, backgroundColor: colors.surfaceSecondary }]} testID="wp-write-review">
            <MaterialCommunityIcons name="star-plus-outline" size={18} color={colors.brand} />
            <Text style={[styles.writeText, { color: colors.brand }]}>Write a review</Text>
          </Pressable>
        )
      ) : null}

      {loading ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.brand} /> :
       reviews.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>No reviews yet. Stay here and be the first to write one.</Text> :
       reviews.map((r) => (
         <View key={r.id} style={[styles.review, { borderTopColor: colors.border }]}>
           <View style={styles.reviewHead}>
             <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
               <Text style={[styles.avatarText, { color: colors.brand }]}>{(r.author_name || "?").charAt(0).toUpperCase()}</Text>
             </View>
             <View style={{ flex: 1 }}>
               <Text style={[styles.author, { color: colors.onSurface }]}>{r.author_name}</Text>
               <Stars value={r.rating} size={13} color={colors.brand} dim={colors.muted} />
             </View>
           </View>
           {r.text ? <Text style={[styles.reviewText, { color: colors.onSurface }]}>{r.text}</Text> : null}
         </View>
       ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  heading: { fontFamily: fonts.displaySemi, fontSize: 18, marginBottom: spacing.md },
  writeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: radius.md, borderWidth: 1.5, marginBottom: spacing.md },
  writeText: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  composer: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  input: { fontFamily: fonts.body, fontSize: 15, minHeight: 60, lineHeight: 21, textAlignVertical: "top" },
  syncNote: { fontFamily: fonts.body, fontSize: 12 },
  composerRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.lg },
  cancel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  postBtn: { height: 38, minWidth: 108, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  postText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  empty: { fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm },
  review: { borderTopWidth: 1, paddingTop: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  author: { fontFamily: fonts.bodyBold, fontSize: 14 },
  reviewText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
});
