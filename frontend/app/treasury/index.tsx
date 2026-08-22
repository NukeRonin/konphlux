import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Transaction, WalletSummary } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const money = (c: number) => `£${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function txnDate(iso: string) {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; }
}

function txnIcon(t: Transaction): keyof typeof MaterialCommunityIcons.glyphMap {
  if (t.type === "transfer") return t.direction === "credit" ? "arrow-bottom-left" : "arrow-top-right";
  if (t.category === "Top-up") return "plus-circle-outline";
  if (t.category === "Subscription") return "card-account-details-outline";
  if (t.category === "Donation") return "hand-heart-outline";
  if (t.category === "Shopping") return "shopping-outline";
  return t.direction === "credit" ? "cash-plus" : "cash-minus";
}

const TABS = [{ key: "all", label: "All" }, { key: "payment", label: "Payments" }, { key: "transfer", label: "Transfers" }];

export default function Treasury() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initial = tab === "payments" ? "payment" : tab === "transfers" ? "transfer" : "all";
  const [active, setActive] = useState(initial);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<null | "topup" | "transfer">(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (type: string) => {
    try {
      const [s, t] = await Promise.all([api.treasuryBalance(), api.treasuryTransactions(type)]);
      setSummary(s); setTxns(t);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(active); }, [active, load]));

  const closeModal = () => { setModal(null); setAmount(""); setRecipient(""); setNote(""); };

  const submitTopup = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!cents || cents <= 0 || busy) return;
    setBusy(true);
    try { await api.treasuryTopup(cents); closeModal(); await load(active); }
    catch (e: any) { Alert.alert("Couldn't add funds", e?.message || "Try again."); }
    finally { setBusy(false); }
  };

  const submitTransfer = async () => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (!recipient.trim() || !cents || cents <= 0 || busy) return;
    setBusy(true);
    try { await api.treasuryTransfer(recipient.trim(), cents, note.trim()); closeModal(); await load(active); }
    catch (e: any) { Alert.alert("Transfer failed", e?.message || "Try again."); }
    finally { setBusy(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="treasury-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Konphlux Balance</Text>
          <Eyebrow>Treasury ledger</Eyebrow>
        </View>
      </View>

      {loading || !summary ? (
        <Loading label="Balancing the books…" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Balance card */}
          <View style={[styles.balanceCard, { backgroundColor: colors.brand }]}>
            <View style={styles.balanceTop}>
              <MaterialCommunityIcons name="bank" size={18} color={colors.onBrandPrimary} />
              <Text style={[styles.balanceLabel, { color: colors.onBrandPrimary }]}>Current funds</Text>
            </View>
            <Text style={[styles.balanceValue, { color: colors.onBrandPrimary }]}>{money(summary.balance_cents)}</Text>
            <View style={styles.balanceStats}>
              <View style={styles.balanceStat}>
                <MaterialCommunityIcons name="arrow-bottom-left" size={14} color={colors.onBrandPrimary} />
                <Text style={[styles.balanceStatText, { color: colors.onBrandPrimary }]}>In {money(summary.total_in_cents)}</Text>
              </View>
              <View style={styles.balanceStat}>
                <MaterialCommunityIcons name="arrow-top-right" size={14} color={colors.onBrandPrimary} />
                <Text style={[styles.balanceStatText, { color: colors.onBrandPrimary }]}>Out {money(summary.total_out_cents)}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable onPress={() => setModal("topup")} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="treasury-add">
              <MaterialCommunityIcons name="plus-circle" size={22} color={colors.brand} />
              <Text style={[styles.actionText, { color: colors.onSurface }]}>Add funds</Text>
            </Pressable>
            <Pressable onPress={() => setModal("transfer")} style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="treasury-send">
              <MaterialCommunityIcons name="bank-transfer" size={22} color={colors.brand} />
              <Text style={[styles.actionText, { color: colors.onSurface }]}>Send / Transfer</Text>
            </Pressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {TABS.map((t) => {
              const on = active === t.key;
              return (
                <Pressable key={t.key} onPress={() => setActive(t.key)} style={[styles.tab, { backgroundColor: on ? colors.brand : colors.surfaceSecondary, borderColor: on ? colors.brand : colors.border }]} testID={`treasury-tab-${t.key}`}>
                  <Text style={[styles.tabText, { color: on ? colors.onBrandPrimary : colors.onSurface }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Transactions */}
          {txns.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialCommunityIcons name="book-open-variant" size={38} color={colors.muted} />
              <Text style={[styles.empty, { color: colors.muted }]}>No entries in this ledger yet.</Text>
            </View>
          ) : (
            txns.map((t) => {
              const credit = t.direction === "credit";
              const color = credit ? "#38A169" : "#E53E3E";
              return (
                <View key={t.id} style={[styles.txn, { borderBottomColor: colors.border }]}>
                  <View style={[styles.txnIcon, { backgroundColor: `${color}1A` }]}>
                    <MaterialCommunityIcons name={txnIcon(t)} size={20} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.txnTitle, { color: colors.onSurface }]} numberOfLines={1}>{t.title}</Text>
                    <Text style={[styles.txnMeta, { color: colors.muted }]}>{txnDate(t.created_at)} · {t.category}{t.note ? ` · ${t.note}` : ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.txnAmt, { color }]}>{credit ? "+" : "−"}{money(t.amount_cents)}</Text>
                    <Text style={[styles.txnBal, { color: colors.muted }]}>{money(t.balance_after_cents)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add funds / Transfer modal */}
      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable style={styles.backdrop} onPress={closeModal} />
        <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} keyboardShouldPersistTaps="handled">
          <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>{modal === "topup" ? "Add funds" : "Send funds"}</Text>

            {modal === "transfer" ? (
              <>
                <Text style={[styles.label, { color: colors.onSurface }]}>Recipient</Text>
                <TextInput value={recipient} onChangeText={setRecipient} placeholder="Email or @handle" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="treasury-recipient" />
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.onSurface }]}>Amount (£)</Text>
            <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="treasury-amount" />

            {modal === "transfer" ? (
              <>
                <Text style={[styles.label, { color: colors.onSurface }]}>Note (optional)</Text>
                <TextInput value={note} onChangeText={setNote} placeholder="What's it for?" placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="treasury-note" />
              </>
            ) : null}

            <Pressable onPress={modal === "topup" ? submitTopup : submitTransfer} disabled={busy} style={[styles.confirmBtn, { backgroundColor: colors.brand }]} testID="treasury-confirm">
              <Text style={[styles.confirmText, { color: colors.onBrandPrimary }]}>{busy ? "Processing…" : modal === "topup" ? "Add funds" : "Send"}</Text>
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  balanceCard: { borderRadius: radius.lg, padding: spacing.lg },
  balanceTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  balanceLabel: { fontFamily: fonts.bodyBold, fontSize: 13, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.5 },
  balanceValue: { fontFamily: fonts.display, fontSize: 40, marginTop: spacing.sm },
  balanceStats: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  balanceStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  balanceStatText: { fontFamily: fonts.bodyMedium, fontSize: 13, opacity: 0.95 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: radius.md, borderWidth: 1 },
  actionText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  tabs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.sm },
  tab: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tabText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  txn: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txnTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5 },
  txnMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  txnAmt: { fontFamily: fonts.bodyBold, fontSize: 15 },
  txnBal: { fontFamily: fonts.body, fontSize: 11.5, marginTop: 2 },
  emptyWrap: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl },
  empty: { fontFamily: fonts.body, fontSize: 14, textAlign: "center" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.display, fontSize: 20, marginBottom: spacing.sm },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 16 },
  confirmBtn: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  confirmText: { fontFamily: fonts.bodyBold, fontSize: 15.5 },
});
