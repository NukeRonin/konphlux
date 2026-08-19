import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Cart } from "@/src/api/client";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Panel } from "@/src/components/Panel";
import { EmptyState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, spacing } from "@/src/theme/tokens";

const RETURN_BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

export default function CartScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<Cart | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setCart(await api.getCart());
    } finally {
      setStatus("ready");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeQty = async (itemId: string, qty: number) => {
    setCart((c) => (c ? { ...c, items: c.items.map((i) => (i.item_id === itemId ? { ...i, qty } : i)) } : c));
    try {
      const updated = qty <= 0 ? await api.removeFromCart(itemId) : await api.setCartQty(itemId, qty);
      setCart(updated);
    } catch {
      load();
    }
  };

  const pollStatus = async (sessionId: string) => {
    for (let i = 0; i < 8; i++) {
      try {
        const res = await api.checkoutStatus(sessionId);
        if (res.paid) return true;
      } catch {
        /* keep trying */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };

  const checkout = async () => {
    if (!cart || cart.items.length === 0 || paying) return;
    setPaying(true);
    setNotice("");
    try {
      const { checkout_url, session_id } = await api.checkout(RETURN_BASE);
      await WebBrowser.openBrowserAsync(checkout_url);
      const paid = await pollStatus(session_id);
      if (paid) {
        router.replace("/orders?justPaid=1");
      } else {
        setNotice("Payment not completed. Your cart is still here when you're ready.");
        load();
      }
    } catch {
      setNotice("Couldn't start checkout. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const subtotal = cart?.subtotal_cents ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="cart-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Your Cart</Text>
        <Pressable onPress={() => router.push("/orders")} hitSlop={12} testID="cart-orders">
          <MaterialCommunityIcons name="receipt" size={22} color={colors.brand} />
        </Pressable>
      </View>

      {status === "loading" ? (
        <Loading label="Tallying your wares…" />
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState icon="cart-outline" title="Your cart is empty" subtitle="Add wares from the Bazaar to fill your basket." />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {cart.items.map((it) => (
              <Panel key={it.item_id} style={styles.row} padded={false} testID={`cart-item-${it.item_id}`}>
                <Image source={{ uri: it.image }} style={[styles.thumb, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
                <View style={styles.rowBody}>
                  <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.onSurface }]}>{it.title}</Text>
                  <Text style={[styles.rowPrice, { color: colors.brandSecondary }]}>{formatPrice(it.price_cents)}</Text>
                  <View style={styles.qtyRow}>
                    <Pressable onPress={() => changeQty(it.item_id, it.qty - 1)} testID={`qty-dec-${it.item_id}`} style={[styles.qtyBtn, { borderColor: colors.border }]}>
                      <MaterialCommunityIcons name={it.qty <= 1 ? "trash-can-outline" : "minus"} size={16} color={colors.onSurface} />
                    </Pressable>
                    <Text style={[styles.qtyText, { color: colors.onSurface }]}>{it.qty}</Text>
                    <Pressable onPress={() => changeQty(it.item_id, it.qty + 1)} testID={`qty-inc-${it.item_id}`} style={[styles.qtyBtn, { borderColor: colors.border }]}>
                      <MaterialCommunityIcons name="plus" size={16} color={colors.onSurface} />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    <Text style={[styles.lineTotal, { color: colors.onSurface }]}>{formatPrice(it.line_cents)}</Text>
                  </View>
                </View>
              </Panel>
            ))}

            <Panel style={{ marginTop: spacing.sm }}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: colors.onSurface }]}>{formatPrice(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>Shipping</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>Free</Text>
              </View>
              <Hairline style={{ marginVertical: spacing.md }} />
              <View style={styles.summaryRow}>
                <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Total</Text>
                <Text style={[styles.totalValue, { color: colors.brandSecondary }]}>{formatPrice(subtotal)}</Text>
              </View>
            </Panel>
            {notice ? <Text testID="cart-notice" style={[styles.notice, { color: colors.muted }]}>{notice}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>
            <View>
              <Eyebrow>Total</Eyebrow>
              <Text style={[styles.footerTotal, { color: colors.onSurface }]}>{formatPrice(subtotal)}</Text>
            </View>
            <ForgeButton
              label={paying ? "Opening Stripe…" : "Checkout"}
              onPress={checkout}
              loading={paying}
              testID="checkout-btn"
              icon={<MaterialCommunityIcons name="lock" size={16} color={colors.onBrandPrimary} />}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontFamily: fonts.display, fontSize: 20 },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md, overflow: "hidden" },
  thumb: { width: 92, height: 110 },
  rowBody: { flex: 1, paddingVertical: spacing.md, paddingRight: spacing.md, gap: 4 },
  rowTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 20 },
  rowPrice: { fontFamily: fonts.bodyBold, fontSize: 14 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyText: { fontFamily: fonts.bodyBold, fontSize: 15, minWidth: 20, textAlign: "center" },
  lineTotal: { fontFamily: fonts.displaySemi, fontSize: 15 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  summaryLabel: { fontFamily: fonts.body, fontSize: 14 },
  summaryValue: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  totalLabel: { fontFamily: fonts.displaySemi, fontSize: 17 },
  totalValue: { fontFamily: fonts.display, fontSize: 20 },
  notice: { fontFamily: fonts.body, fontSize: 13, marginTop: spacing.md, textAlign: "center" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  footerTotal: { fontFamily: fonts.displaySemi, fontSize: 20, marginTop: 2 },
});
