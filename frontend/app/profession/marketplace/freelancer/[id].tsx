import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Freelancer } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";
import { shareResumePdf } from "@/src/utils/resumePdf";

export default function FreelancerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [f, setF] = useState<Freelancer | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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
    setDownloading(true);
    try {
      await shareResumePdf(f);
    } catch {
      Alert.alert("Couldn't create PDF", "Please try again.");
    } finally {
      setDownloading(false);
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
