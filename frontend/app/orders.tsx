import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, Order } from "@/src/api/client";
import { Eyebrow, Hairline } from "@/src/components/BrassText";
import { Panel } from "@/src/components/Panel";
import { EmptyState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { formatPrice, fonts, spacing, timeAgo } from "@/src/theme/tokens";

export default function OrdersScreen() {
  const { justPaid } = useLocalSearchParams<{ justPaid?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const load = useCallback(async () => {
    try {
      setOrders(await api.getOrders());
    } finally {
      setStatus("ready");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="orders-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>My Orders</Text>
        <View style={{ width: 26 }} />
      </View>

      {status === "loading" ? (
        <Loading label="Fetching your receipts…" />
      ) : orders.length === 0 ? (
        <EmptyState icon="receipt" title="No orders yet" subtitle="Your completed Bazaar purchases will appear here." />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {justPaid ? (
            <View style={[styles.banner, { backgroundColor: colors.success }]} testID="paid-banner">
              <MaterialCommunityIcons name="check-decagram" size={20} color="#fff" />
              <Text style={styles.bannerText}>Payment complete — thank you!</Text>
            </View>
          ) : null}
          {orders.map((o) => (
            <Panel key={o.id} style={{ marginBottom: spacing.md }} testID={`order-${o.id}`}>
              <View style={styles.orderHead}>
                <View>
                  <Eyebrow>Order · {o.id.slice(0, 8).toUpperCase()}</Eyebrow>
                  <Text style={[styles.orderDate, { color: colors.muted }]}>{timeAgo(o.paid_at || o.created_at)}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.surfaceTertiary }]}>
                  <MaterialCommunityIcons name="check-circle" size={13} color={colors.success} />
                  <Text style={[styles.badgeText, { color: colors.success }]}>Paid</Text>
                </View>
              </View>
              <Hairline style={{ marginVertical: spacing.md }} />
              {o.lines.map((l) => (
                <View key={l.item_id} style={styles.line}>
                  <Image source={{ uri: l.image }} style={[styles.lineImg, { backgroundColor: colors.surfaceTertiary }]} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.lineTitle, { color: colors.onSurface }]}>{l.title}</Text>
                    <Text style={[styles.lineMeta, { color: colors.muted }]}>Qty {l.qty} · {formatPrice(l.unit_amount)}</Text>
                  </View>
                  <Text style={[styles.linePrice, { color: colors.onSurface }]}>{formatPrice(l.unit_amount * l.qty)}</Text>
                </View>
              ))}
              <Hairline style={{ marginVertical: spacing.md }} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.onSurface }]}>Total paid</Text>
                <Text style={[styles.totalValue, { color: colors.brandSecondary }]}>{formatPrice(o.amount_cents)}</Text>
              </View>
            </Panel>
          ))}
        </ScrollView>
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
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: spacing.md, marginBottom: spacing.md },
  bannerText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#fff" },
  orderHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderDate: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 11 },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  lineImg: { width: 44, height: 44, borderRadius: 8 },
  lineTitle: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  lineMeta: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  linePrice: { fontFamily: fonts.bodyBold, fontSize: 14 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontFamily: fonts.displaySemi, fontSize: 16 },
  totalValue: { fontFamily: fonts.display, fontSize: 19 },
});
