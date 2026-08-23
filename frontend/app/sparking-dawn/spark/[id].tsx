import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, SparkCard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const FLIRT_LINE = "Is it warm in here, or is that just the spark between us? 😏";
const SEX_LINE = "I can't stop thinking about you. Care to make some heat together tonight? 🔥";

// Peach for women, eggplant for men, both for anyone else.
function sexEmoji(gender: string | null): string {
  if (gender === "woman") return "🍑";
  if (gender === "man") return "🍆";
  return "🍑🍆";
}

export default function SparkDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [spark, setSpark] = useState<SparkCard | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try { setStatus("loading"); setSpark(await api.datingProfile(id)); setStatus("ready"); }
    catch { setStatus("error"); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sendPreset = async (kind: "flirt" | "sex_request", line: string) => {
    if (!id || sending) return;
    setSending(kind);
    try {
      await api.datingThreadSend(id, line, kind);
      router.push(`/sparking-dawn/chat/${id}`);
    } catch { /* ignore */ } finally { setSending(null); }
  };

  const manage = () => {
    if (!id) return;
    const opts: any[] = [];
    if (spark?.matched) opts.push({ text: "Unmatch", style: "destructive", onPress: async () => { try { await api.datingUnmatch(id); } catch { /* ignore */ } router.back(); } });
    opts.push({ text: "Block", style: "destructive", onPress: async () => { try { await api.datingBlock(id); } catch { /* ignore */ } router.back(); } });
    opts.push({ text: "Cancel", style: "cancel" });
    Alert.alert(spark?.display_name ?? "Manage", "Quietly remove this connection?", opts);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      {status === "loading" ? (
        <><View style={{ height: insets.top }} /><Loading label="Opening their spark…" /></>
      ) : status === "error" || !spark ? (
        <><View style={{ height: insets.top }} /><ErrorState onRetry={load} /></>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
          <View style={styles.photoWrap}>
            {spark.photo ? <Image source={{ uri: spark.photo }} style={styles.photo} contentFit="cover" /> : <View style={[styles.photo, { backgroundColor: colors.surfaceTertiary }]} />}
            <LinearGradient colors={["rgba(20,16,10,0.6)", "transparent", "rgba(20,16,10,0.9)"]} style={StyleSheet.absoluteFill} />
            <Pressable onPress={() => router.back()} hitSlop={12} testID="spark-back" style={[styles.backBtn, { top: insets.top + spacing.sm }]}>
              <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
            </Pressable>
            <Pressable onPress={manage} hitSlop={12} testID="spark-manage" style={[styles.manageBtn, { top: insets.top + spacing.sm }]}>
              <MaterialCommunityIcons name="dots-horizontal" size={24} color="#fff" />
            </Pressable>
            {spark.matched ? (
              <View style={[styles.matchTag, { backgroundColor: colors.brandSecondary, top: insets.top + spacing.sm + 52 }]}>
                <MaterialCommunityIcons name="heart" size={13} color={colors.onBrandPrimary} />
                <Text style={[styles.matchTagText, { color: colors.onBrandPrimary }]}>Matched</Text>
              </View>
            ) : null}
            <View style={styles.photoInfo}>
              <Text style={styles.name}>{spark.display_name}{spark.age ? <Text style={styles.age}>  {spark.age}</Text> : null}</Text>
              {spark.tagline ? <Text style={styles.tagline}>{spark.tagline}</Text> : null}
            </View>
          </View>

          <View style={styles.body}>
            {spark.bio ? (
              <>
                <Eyebrow>About</Eyebrow>
                <Text style={[styles.bio, { color: colors.onSurface }]}>{spark.bio}</Text>
              </>
            ) : null}

            <Eyebrow style={{ marginTop: spacing.lg }}>Reach out</Eyebrow>
            <Pressable
              testID="spark-message"
              onPress={() => router.push(`/sparking-dawn/chat/${id}`)}
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
            >
              <LinearGradient colors={colors.brassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryGrad}>
                <MaterialCommunityIcons name="message-text" size={20} color={colors.onBrandPrimary} />
                <Text style={[styles.primaryText, { color: colors.onBrandPrimary }]}>Message</Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.dualRow}>
              <Pressable
                testID="spark-flirt"
                disabled={sending !== null}
                onPress={() => sendPreset("flirt", FLIRT_LINE)}
                style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brandSecondary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.secondaryEmoji}>{sending === "flirt" ? "💌" : "😏"}</Text>
                <Text style={[styles.secondaryText, { color: colors.onSurface }]}>Send Flirt</Text>
              </Pressable>
              <Pressable
                testID="spark-sex-request"
                disabled={sending !== null}
                onPress={() => sendPreset("sex_request", SEX_LINE)}
                style={({ pressed }) => [styles.secondaryBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={styles.secondaryEmoji}>{sexEmoji(spark.gender)}</Text>
                <Text style={[styles.secondaryText, { color: colors.onSurface }]}>Sex Request</Text>
              </Pressable>
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>A flirt or request opens your chat with a playful opener.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  photoWrap: { width: "100%", height: 460 },
  photo: { width: "100%", height: "100%" },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  manageBtn: { position: "absolute", right: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  matchTag: { position: "absolute", right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 4, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  matchTagText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  photoInfo: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  name: { fontFamily: fonts.display, fontSize: 30, color: "#F6F1E7" },
  age: { fontFamily: fonts.displayReg, fontSize: 24, color: "#F6F1E7" },
  tagline: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#E7CD94", marginTop: 4 },
  body: { padding: spacing.lg, gap: spacing.sm },
  bio: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: 4 },
  primaryBtn: { marginTop: spacing.sm, borderRadius: radius.pill, overflow: "hidden" },
  primaryGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 54 },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  dualRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  secondaryBtn: { flex: 1, height: 60, borderRadius: radius.md, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 2 },
  secondaryEmoji: { fontSize: 22 },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  hint: { fontFamily: fonts.body, fontSize: 12.5, marginTop: spacing.sm, textAlign: "center" },
});
