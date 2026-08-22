import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { api, DBProject } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { FUNDING_MODELS, fmtDeadline, useCountdown } from "@/src/utils/dreambacker";
import { fonts, formatPrice, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const RETURN_BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
const PRESETS = [1000, 2500, 5000, 10000]; // cents

function CountdownBanner({ deadline, colors }: { deadline: string; colors: any }) {
  const c = useCountdown(deadline);
  if (!c) return null;
  const cells: { v: number; l: string }[] = [
    { v: c.days, l: "days" }, { v: c.hours, l: "hrs" }, { v: c.minutes, l: "min" }, { v: c.seconds, l: "sec" },
  ];
  return (
    <View style={[styles.countdown, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
      <Text style={[styles.countLabel, { color: colors.muted }]}>
        {c.done ? "This fundraiser has ended" : "Time remaining"}
      </Text>
      {c.done ? null : (
        <View style={styles.countRow}>
          {cells.map((cell) => (
            <View key={cell.l} style={styles.countCell}>
              <Text style={[styles.countNum, { color: colors.brand }]}>{String(cell.v).padStart(2, "0")}</Text>
              <Text style={[styles.countUnit, { color: colors.muted }]}>{cell.l}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={[styles.countDeadline, { color: colors.muted }]}>Deadline: {fmtDeadline(deadline)}</Text>
    </View>
  );
}

export default function FundraiserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [project, setProject] = useState<DBProject | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [amount, setAmount] = useState("25");
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      setProject(await api.dbProject(id));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const amountCents = Math.round((parseFloat(amount.replace(/[^0-9.]/g, "")) || 0) * 100);

  const pollStatus = async (sessionId: string) => {
    for (let i = 0; i < 8; i++) {
      try {
        const res = await api.dbContributionStatus(sessionId);
        if (res.paid) return true;
      } catch { /* keep trying */ }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };

  const back = async () => {
    if (!project || paying || amountCents < 100) return;
    setPaying(true);
    setNotice("");
    try {
      const { checkout_url, session_id } = await api.dbBackProject(project.id, amountCents, RETURN_BASE);
      await WebBrowser.openBrowserAsync(checkout_url);
      const paid = await pollStatus(session_id);
      if (paid) {
        setNotice("Thank you! Your contribution is in.");
        load();
      } else {
        setNotice("Payment not completed. You can try again whenever you're ready.");
      }
    } catch {
      setNotice("Couldn't start the contribution. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (status === "loading") return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><Loading label="Opening the fundraiser…" /></View>;
  if (status === "error" || !project) return <View style={[styles.screen, { backgroundColor: colors.surface }]}><View style={{ height: insets.top }} /><ErrorState onRetry={load} /></View>;

  const fm = FUNDING_MODELS[project.funding_model];
  const pct = Math.round(project.progress * 100);
  const goalMet = project.raised_cents >= project.goal_cents;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="detail-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Eyebrow>Fundraiser</Eyebrow>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{project.title}</Text>
        <Text style={[styles.creator, { color: colors.muted }]}>by {project.creator_name}{project.is_creator ? " · you" : ""}</Text>

        <View style={[styles.progressCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.raised, { color: colors.brand }]}>{formatPrice(project.raised_cents)}</Text>
          <Text style={[styles.goal, { color: colors.muted }]}>raised of {formatPrice(project.goal_cents)} goal</Text>
          <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
            <View style={[styles.fill, { backgroundColor: colors.brand, width: `${Math.min(100, pct)}%` }]} />
          </View>
          <View style={styles.progRow}>
            <Text style={[styles.progStat, { color: colors.onSurface }]}>{pct}% funded</Text>
            <Text style={[styles.progStat, { color: colors.onSurface }]}>{project.backer_count} backers</Text>
          </View>
        </View>

        {project.deadline ? <CountdownBanner deadline={project.deadline} colors={colors} /> : (
          <View style={[styles.noDeadline, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="infinity" size={18} color={colors.brand} />
            <Text style={[styles.noDeadlineText, { color: colors.muted }]}>No deadline — this fundraiser stays open indefinitely.</Text>
          </View>
        )}

        <View style={[styles.fmCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand }]}>
          <View style={styles.fmHead}>
            <MaterialCommunityIcons name={fm.icon as IconName} size={20} color={colors.brand} />
            <Text style={[styles.fmTitle, { color: colors.onSurface }]}>{fm.label} funding</Text>
          </View>
          <Text style={[styles.fmBlurb, { color: colors.muted }]}>{fm.blurb}</Text>
          <View style={[styles.fmNote, { borderTopColor: colors.border }]}>
            <MaterialCommunityIcons name="cash-multiple" size={15} color={colors.brand} />
            <Text style={[styles.fmNoteText, { color: colors.onSurface }]}>
              {project.funding_model === "all_or_nothing"
                ? (goalMet ? "Goal reached — the creator receives the funds." : "Funds are released to the creator only if the goal is met by the deadline.")
                : "The creator keeps every contribution, whether or not the goal is met."}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>About this project</Text>
        <Text style={[styles.description, { color: colors.onSurface }]}>{project.description}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {notice ? <Text style={[styles.notice, { color: colors.brand }]}>{notice}</Text> : null}
        <View style={styles.presetRow}>
          {PRESETS.map((c) => (
            <Pressable key={c} testID={`detail-preset-${c}`} onPress={() => setAmount(String(c / 100))} style={[styles.preset, { backgroundColor: amountCents === c ? colors.brand : colors.surfaceSecondary, borderColor: amountCents === c ? colors.brand : colors.border }]}>
              <Text style={[styles.presetText, { color: amountCents === c ? colors.onBrandPrimary : colors.muted }]}>{formatPrice(c)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.backRow}>
          <View style={[styles.amountBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.amountCurrency, { color: colors.brand }]}>$</Text>
            <TextInput testID="detail-amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="25" placeholderTextColor={colors.muted} style={[styles.amountInput, { color: colors.onSurface }]} />
          </View>
          <ForgeButton label="Back this project" size="lg" disabled={amountCents < 100} loading={paying} onPress={back} testID="detail-back-btn" style={{ flex: 1 }} icon={<MaterialCommunityIcons name="hand-heart" size={18} color={colors.onBrandPrimary} />} />
        </View>
        <Text style={[styles.secure, { color: colors.muted }]}>Secure payment via Stripe · minimum $1.00</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  creator: { fontFamily: fonts.body, fontSize: 13.5, marginTop: 4 },
  progressCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.lg },
  raised: { fontFamily: fonts.display, fontSize: 28 },
  goal: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  track: { height: 10, borderRadius: 5, overflow: "hidden", marginTop: spacing.md },
  fill: { height: 10, borderRadius: 5 },
  progRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  progStat: { fontFamily: fonts.bodyBold, fontSize: 13.5 },
  countdown: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md, alignItems: "center" },
  countLabel: { fontFamily: fonts.bodyBold, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5 },
  countRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  countCell: { alignItems: "center", minWidth: 44 },
  countNum: { fontFamily: fonts.display, fontSize: 26 },
  countUnit: { fontFamily: fonts.body, fontSize: 11 },
  countDeadline: { fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  noDeadline: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md },
  noDeadlineText: { flex: 1, fontFamily: fonts.body, fontSize: 13 },
  fmCard: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, marginTop: spacing.md },
  fmHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fmTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  fmBlurb: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  fmNote: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.md },
  fmNoteText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: spacing.lg, marginBottom: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1 },
  notice: { fontFamily: fonts.bodyBold, fontSize: 13, textAlign: "center", marginBottom: spacing.sm },
  presetRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  preset: { flex: 1, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  presetText: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  backRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  amountBox: { flexDirection: "row", alignItems: "center", height: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, width: 110 },
  amountCurrency: { fontFamily: fonts.display, fontSize: 18, marginRight: 4 },
  amountInput: { flex: 1, fontFamily: fonts.display, fontSize: 18 },
  secure: { fontFamily: fonts.body, fontSize: 11.5, textAlign: "center", marginTop: spacing.sm },
});
