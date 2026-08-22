import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { api, DBBacker, DBProject, DBUpdate } from "@/src/api/client";
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
  const [backers, setBackers] = useState<DBBacker[]>([]);
  const [backerCount, setBackerCount] = useState(0);
  const [updates, setUpdates] = useState<DBUpdate[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [amount, setAmount] = useState("25");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");
  const [showUpdate, setShowUpdate] = useState(false);
  const [upTitle, setUpTitle] = useState("");
  const [upBody, setUpBody] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setStatus("loading");
      const [p, b, u] = await Promise.all([api.dbProject(id), api.dbBackers(id), api.dbUpdates(id)]);
      setProject(p);
      setBackers(b.backers);
      setBackerCount(b.count);
      setUpdates(u);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const amountCents = Math.round((parseFloat(amount.replace(/[^0-9.]/g, "")) || 0) * 100);

  const selectTier = (tierId: string, tierAmountCents: number) => {
    setSelectedTier(tierId);
    setAmount(String(tierAmountCents / 100));
    setNotice("");
  };

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
      const { checkout_url, session_id } = await api.dbBackProject(project.id, amountCents, RETURN_BASE, selectedTier);
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

  const postUpdate = async () => {
    if (!project || posting || upTitle.trim().length < 3 || upBody.trim().length < 5) return;
    setPosting(true);
    try {
      await api.dbCreateUpdate(project.id, upTitle.trim(), upBody.trim());
      setUpTitle("");
      setUpBody("");
      setShowUpdate(false);
      setUpdates(await api.dbUpdates(project.id));
    } catch {
      /* ignore */
    } finally {
      setPosting(false);
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
        {project.cover_url ? (
          <Image source={{ uri: project.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
        ) : null}
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

        {project.reward_tiers && project.reward_tiers.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Reward tiers</Text>
            {project.reward_tiers.map((t) => {
              const active = selectedTier === t.id;
              return (
                <Pressable key={t.id} testID={`detail-tier-${t.id}`} onPress={() => selectTier(t.id, t.amount_cents)} style={[styles.tier, { backgroundColor: colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border, borderWidth: active ? 2 : 1 }]}>
                  <View style={styles.tierTop}>
                    <Text style={[styles.tierAmount, { color: colors.brand }]}>{formatPrice(t.amount_cents)}+</Text>
                    <MaterialCommunityIcons name={active ? "check-circle" : "circle-outline"} size={20} color={active ? colors.brand : colors.muted} />
                  </View>
                  <Text style={[styles.tierTitle, { color: colors.onSurface }]}>{t.title}</Text>
                  {t.description ? <Text style={[styles.tierDesc, { color: colors.muted }]}>{t.description}</Text> : null}
                  <Text style={[styles.tierBackers, { color: colors.muted }]}>{t.backer_count} {t.backer_count === 1 ? "backer" : "backers"}</Text>
                </Pressable>
              );
            })}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>About this project</Text>
        <Text style={[styles.description, { color: colors.onSurface }]}>{project.description}</Text>

        <View style={styles.updatesHead}>
          <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 0 }]}>Updates</Text>
          {project.is_creator ? (
            <Pressable testID="detail-post-update" onPress={() => setShowUpdate(true)} style={[styles.postBtn, { borderColor: colors.brand }]}>
              <MaterialCommunityIcons name="plus" size={15} color={colors.brand} />
              <Text style={[styles.postBtnText, { color: colors.brand }]}>Post</Text>
            </Pressable>
          ) : null}
        </View>
        {updates.length === 0 ? (
          <Text style={[styles.emptyLine, { color: colors.muted }]}>No updates yet. Backers will see progress here.</Text>
        ) : (
          updates.map((u) => (
            <View key={u.id} style={[styles.update, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={[styles.updateTitle, { color: colors.onSurface }]}>{u.title}</Text>
              <Text style={[styles.updateMeta, { color: colors.muted }]}>{u.author_name} · {fmtDeadline(u.created_at)}</Text>
              <Text style={[styles.updateBody, { color: colors.onSurface }]}>{u.body}</Text>
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Backers{backerCount ? ` (${backerCount})` : ""}</Text>
        {backers.length === 0 ? (
          <Text style={[styles.emptyLine, { color: colors.muted }]}>Be the first to back this project.</Text>
        ) : (
          <>
            <View style={[styles.thankYou, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="heart" size={16} color={colors.brand} />
              <Text style={[styles.thankYouText, { color: colors.onSurface }]}>Thank you to {backerCount} {backerCount === 1 ? "backer" : "backers"} bringing this dream to life!</Text>
            </View>
            {backers.map((b, i) => (
              <View key={i} style={styles.backerRow}>
                <View style={[styles.backerAvatar, { backgroundColor: colors.surfaceTertiary }]}>
                  <Text style={[styles.backerInitial, { color: colors.brand }]}>{(b.backer_name || "?").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.backerName, { color: colors.onSurface }]}>{b.backer_name}</Text>
                  {b.tier_title ? <Text style={[styles.backerTier, { color: colors.muted }]}>{b.tier_title}</Text> : null}
                </View>
                <Text style={[styles.backerAmount, { color: colors.brand }]}>{formatPrice(b.amount_cents)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {notice ? <Text style={[styles.notice, { color: colors.brand }]}>{notice}</Text> : null}
        {selectedTier ? (
          <Pressable testID="detail-clear-tier" onPress={() => setSelectedTier(null)} style={styles.tierChosen}>
            <MaterialCommunityIcons name="gift-outline" size={14} color={colors.brand} />
            <Text style={[styles.tierChosenText, { color: colors.brand }]}>Reward: {project.reward_tiers.find((t) => t.id === selectedTier)?.title} · tap to remove</Text>
          </Pressable>
        ) : null}
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

      <Modal visible={showUpdate} transparent animationType="fade" onRequestClose={() => setShowUpdate(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowUpdate(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Post an update</Text>
            <TextInput testID="update-title" value={upTitle} onChangeText={setUpTitle} placeholder="Update title" placeholderTextColor={colors.muted} maxLength={120} style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
            <TextInput testID="update-body" value={upBody} onChangeText={setUpBody} placeholder="Share your progress with backers…" placeholderTextColor={colors.muted} multiline maxLength={4000} style={[styles.modalInput, { minHeight: 110, textAlignVertical: "top", marginTop: spacing.sm, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} />
            <ForgeButton label="Post update" fullWidth loading={posting} disabled={upTitle.trim().length < 3 || upBody.trim().length < 5} onPress={postUpdate} testID="update-submit" style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  cover: { width: "100%", height: 190, borderRadius: radius.md, marginBottom: spacing.md },
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
  tier: { borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  tierTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tierAmount: { fontFamily: fonts.display, fontSize: 18 },
  tierTitle: { fontFamily: fonts.displaySemi, fontSize: 15, marginTop: 2 },
  tierDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 4 },
  tierBackers: { fontFamily: fonts.body, fontSize: 12, marginTop: spacing.sm },
  updatesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  postBtnText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  emptyLine: { fontFamily: fonts.body, fontSize: 13.5, marginTop: spacing.xs },
  update: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.sm },
  updateTitle: { fontFamily: fonts.displaySemi, fontSize: 15 },
  updateMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  updateBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  thankYou: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  thankYouText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 19 },
  backerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  backerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  backerInitial: { fontFamily: fonts.displaySemi, fontSize: 16 },
  backerName: { fontFamily: fonts.bodyBold, fontSize: 14 },
  backerTier: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  backerAmount: { fontFamily: fonts.displaySemi, fontSize: 15 },
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
  tierChosen: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: spacing.sm },
  tierChosenText: { fontFamily: fonts.bodyMedium, fontSize: 12.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  modalCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  modalTitle: { fontFamily: fonts.display, fontSize: 18, marginBottom: spacing.md },
  modalInput: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15 },
});
