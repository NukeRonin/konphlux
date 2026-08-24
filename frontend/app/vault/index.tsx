import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, VaultCollection, VaultItem, VaultSharedBoard } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { EmptyState, ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const SOURCE_META: Record<string, { icon: IconName; label: string }> = {
  bazaar: { icon: "storefront", label: "Bazaar" },
  frankenstein: { icon: "flask-round-bottom", label: "Frankenstein Lab" },
  bluepaint: { icon: "floor-plan", label: "Bluepaint" },
  other: { icon: "bookmark", label: "Saved" },
};
// Deterministic tile heights for a masonry feel.
const HEIGHTS = [190, 150, 230, 170, 210, 160, 200, 240];

export function VaultTile({ item, colors, onPress, onLong }: { item: VaultItem; colors: any; onPress: () => void; onLong: () => void }) {
  const meta = SOURCE_META[item.source] || SOURCE_META.other;
  const h = HEIGHTS[(parseInt(item.id.slice(-2), 16) || 0) % HEIGHTS.length];
  const isText = !item.image_url && !!item.text;
  if (isText) {
    return (
      <Pressable testID={`vault-tile-${item.id}`} onPress={onPress} onLongPress={onLong} delayLongPress={250} style={[styles.textTile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        <MaterialCommunityIcons name={item.category === "Quotes" ? "format-quote-open" : "emoticon-happy-outline"} size={20} color={colors.brand} />
        <Text style={[styles.textBody, { color: colors.onSurface }]}>{item.text}</Text>
        <Text style={[styles.textCat, { color: colors.muted }]}>{item.category || item.subtitle}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable testID={`vault-tile-${item.id}`} onPress={onPress} onLongPress={onLong} delayLongPress={250} style={[styles.tile, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={[styles.tileImg, { height: h }]} contentFit="cover" transition={180} />
      ) : (
        <View style={[styles.tileImg, { height: h, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }]}>
          <MaterialCommunityIcons name={meta.icon} size={40} color={colors.muted} />
        </View>
      )}
      <View style={styles.tileBody}>
        <View style={styles.sourceRow}>
          <MaterialCommunityIcons name={meta.icon} size={12} color={colors.brand} />
          <Text style={[styles.sourceText, { color: colors.brand }]} numberOfLines={1}>{item.category || meta.label}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.onSurface }]}>{item.title}</Text>
      </View>
      {item.is_favorite ? (
        <View style={styles.pinBadge}><MaterialCommunityIcons name="star" size={13} color="#F1C40F" /></View>
      ) : null}
    </Pressable>
  );
}

const CATEGORIES: { key: string; icon: IconName }[] = [
  { key: "All", icon: "view-grid-outline" },
  { key: "Jokes", icon: "emoticon-lol-outline" },
  { key: "Video Game Cheats", icon: "controller-classic-outline" },
  { key: "Hints & Walkthrus", icon: "map-legend" },
  { key: "Images", icon: "image-outline" },
  { key: "TV Show Recommendations", icon: "television-classic" },
  { key: "Movie Recommendations", icon: "movie-open-outline" },
  { key: "Music Recommendations", icon: "music-note-outline" },
  { key: "Video Game Recommendations", icon: "google-controller" },
  { key: "Logos", icon: "shield-star-outline" },
  { key: "GIFs", icon: "animation-play-outline" },
  { key: "Memes", icon: "emoticon-happy-outline" },
  { key: "Sound Effects", icon: "waveform" },
  { key: "Artwork", icon: "palette-outline" },
  { key: "Quotes", icon: "format-quote-close" },
  { key: "Recipes", icon: "silverware-fork-knife" },
  { key: "DIY Projects", icon: "hammer-screwdriver" },
  { key: "Magic Tricks", icon: "auto-fix" },
  { key: "Life Hacks", icon: "lightbulb-on-outline" },
  { key: "Crafts", icon: "scissors-cutting" },
  { key: "Decor Ideas", icon: "sofa-outline" },
  { key: "Fashion", icon: "hanger" },
  { key: "Travel Ideas", icon: "airplane" },
  { key: "Reading List", icon: "book-open-page-variant-outline" },
  { key: "Tutorials", icon: "school-outline" },
];
const TEXT_CATS = ["Jokes", "Quotes"];

function TextCard({ item, colors, onPress, onLong }: { item: VaultItem; colors: any; onPress: () => void; onLong: () => void }) {
  return (
    <Pressable testID={`vault-card-${item.id}`} onPress={onPress} onLongPress={onLong} delayLongPress={250} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={item.category === "Quotes" ? "format-quote-open" : "emoticon-lol-outline"} size={22} color={colors.brand} />
      <Text style={[styles.cardBody, { color: colors.onSurface }]}>{item.text || item.title}</Text>
      {item.title && item.text ? <Text style={[styles.cardTitle, { color: colors.muted }]}>{item.title}</Text> : null}
    </Pressable>
  );
}

export default function VaultHub() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(params.category && CATEGORIES.some((c) => c.key === params.category) ? params.category : "All");
  const [items, setItems] = useState<VaultItem[]>([]);
  const [collections, setCollections] = useState<VaultCollection[]>([]);
  const [shared, setShared] = useState<VaultSharedBoard[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [modal, setModal] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      setStatus("loading");
      const [its, colls, shd] = await Promise.all([api.vaultItems(q.trim(), "", cat === "All" ? "" : cat), api.vaultCollections(), api.vaultShared()]);
      setItems(its); setCollections(colls); setShared(shd); setStatus("ready");
    } catch { setStatus("error"); }
  }, [q, cat]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createCollection = async () => {
    const name = newName.trim();
    if (!name) return;
    try { await api.vaultCreateCollection(name); setNewName(""); setModal(false); load(); } catch { /* ignore */ }
  };

  const itemActions = (item: VaultItem) => {
    const buttons: any[] = [];
    buttons.push({ text: item.is_favorite ? "★ Unpin favourite" : "☆ Pin to top", onPress: async () => { try { await api.vaultToggleFavorite(item.id); load(); } catch { /* ignore */ } } });
    if (collections.length) {
      buttons.push({ text: "Add to a collection…", onPress: () => moveMenu(item) });
    }
    buttons.push({ text: "Remove from Vault", style: "destructive", onPress: async () => { try { await api.vaultDeleteItem(item.id); load(); } catch { /* ignore */ } } });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert(item.title, item.subtitle || "Saved item", buttons);
  };

  const moveMenu = (item: VaultItem) => {
    const buttons: any[] = collections.map((c) => ({ text: c.name, onPress: async () => { try { await api.vaultMoveItem(item.id, c.id); load(); } catch { /* ignore */ } } }));
    if (item.collection_id) buttons.push({ text: "Remove from collection", onPress: async () => { try { await api.vaultMoveItem(item.id, null); load(); } catch { /* ignore */ } } });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Add to collection", item.title, buttons);
  };

  const openItem = (item: VaultItem) => {
    if (item.route) router.push(item.route as any);
    else router.push(`/vault/item/${item.id}`);
  };

  const cols: VaultItem[][] = [[], []];
  items.forEach((it, i) => cols[i % 2].push(it));
  const textLayout = TEXT_CATS.includes(cat);

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="vault-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>The Vault</Text>
          <Eyebrow>Everything you've saved, in one place</Eyebrow>
        </View>
        <Pressable testID="vault-add" onPress={() => router.push(cat !== "All" ? `/vault/add?category=${encodeURIComponent(cat)}` : "/vault/add")} style={[styles.iconBtn, { backgroundColor: colors.brand }]}>
          <MaterialCommunityIcons name="plus" size={21} color={colors.onBrandPrimary} />
        </Pressable>
        <Pressable testID="vault-new-collection" onPress={() => setModal(true)} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="folder-plus-outline" size={19} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={load} returnKeyType="search" placeholder="Search saved items…" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.onSurface }]} testID="vault-search" />
          {q ? <Pressable onPress={() => setQ("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
      </View>

      {status === "loading" ? <Loading label="Opening the Vault…" /> :
       status === "error" ? <ErrorState onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const active = cat === c.key;
              return (
                <Pressable key={c.key} testID={`vault-cat-${c.key}`} onPress={() => setCat(c.key)} style={[styles.catChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                  <MaterialCommunityIcons name={c.icon} size={15} color={active ? colors.onBrandPrimary : colors.muted} />
                  <Text style={[styles.catText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{c.key}</Text>
                </Pressable>
              );
            })}
          </View>
          {collections.length > 0 && !q && cat === "All" ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Collections</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collRow}>
                {collections.map((c) => (
                  <Pressable key={c.id} testID={`vault-collection-${c.id}`} onPress={() => router.push(`/vault/collection/${c.id}`)} style={styles.collCard}>
                    <View style={[styles.collCover, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      {c.cover_url ? <Image source={{ uri: c.cover_url }} style={StyleSheet.absoluteFill as any} contentFit="cover" /> : <MaterialCommunityIcons name="folder-multiple-image" size={30} color={colors.muted} />}
                    </View>
                    <Text numberOfLines={1} style={[styles.collName, { color: colors.onSurface }]}>{c.name}</Text>
                    <Text style={[styles.collCount, { color: colors.muted }]}>{c.count} item{c.count !== 1 ? "s" : ""}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {shared.length > 0 && !q && cat === "All" ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Shared with you</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collRow}>
                {shared.map((s) => (
                  <Pressable key={s.share_id} testID={`vault-shared-${s.share_id}`} onPress={() => router.push(`/vault/shared/${s.share_id}`)} style={styles.collCard}>
                    <View style={[styles.collCover, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                      {s.cover_url ? <Image source={{ uri: s.cover_url }} style={StyleSheet.absoluteFill as any} contentFit="cover" /> : <MaterialCommunityIcons name="account-multiple" size={30} color={colors.muted} />}
                      <View style={[styles.sharedTag, { backgroundColor: colors.brand }]}>
                        <MaterialCommunityIcons name="account-arrow-left" size={11} color={colors.onBrandPrimary} />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={[styles.collName, { color: colors.onSurface }]}>{s.board_name}</Text>
                    <Text numberOfLines={1} style={[styles.collCount, { color: colors.muted }]}>from {s.owner_name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{q ? "Results" : cat === "All" ? "All saved" : cat}</Text>
          {items.length === 0 ? (
            <EmptyState icon="bookmark-multiple-outline" title={q ? "Nothing found" : `No ${cat === "All" ? "saved items" : cat.toLowerCase()} yet`} subtitle={q ? "Try a different search." : "Save items from the Bazaar, Frankenstein Lab and Bluepaint to see them here."} />
          ) : textLayout ? (
            <View style={styles.cardList}>
              {items.map((it) => <TextCard key={it.id} item={it} colors={colors} onPress={() => itemActions(it)} onLong={() => itemActions(it)} />)}
            </View>
          ) : (
            <View style={styles.masonry}>
              {cols.map((col, ci) => (
                <View key={ci} style={styles.col}>
                  {col.map((it) => <VaultTile key={it.id} item={it} colors={colors} onPress={() => openItem(it)} onLong={() => itemActions(it)} />)}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModal(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.onSurface }]}>New collection</Text>
            <TextInput value={newName} onChangeText={setNewName} autoFocus placeholder="e.g. Workshop ideas" placeholderTextColor={colors.muted} style={[styles.sheetInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]} testID="vault-collection-name" />
            <View style={styles.sheetRow}>
              <Pressable onPress={() => setModal(false)} hitSlop={8}><Text style={[styles.cancel, { color: colors.muted }]}>Cancel</Text></Pressable>
              <Pressable onPress={createCollection} disabled={!newName.trim()} style={[styles.createBtn, { backgroundColor: newName.trim() ? colors.brand : colors.surfaceTertiary }]} testID="vault-collection-create">
                <Text style={[styles.createText, { color: newName.trim() ? colors.onBrandPrimary : colors.muted }]}>Create</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 22 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 46, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  catRow: { paddingTop: spacing.md },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1 },
  catText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  cardList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: { borderRadius: radius.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  cardBody: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 12.5 },
  textTile: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  textBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  textCat: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.3 },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 18, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  collRow: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  collCard: { width: 120 },
  collCover: { width: 120, height: 90, borderRadius: radius.md, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  collName: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: 6 },
  collCount: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
  sharedTag: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  masonry: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
  col: { flex: 1, gap: spacing.md },
  tile: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  pinBadge: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  tileImg: { width: "100%" },
  tileBody: { padding: spacing.sm, gap: 3 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sourceText: { fontFamily: fonts.bodyBold, fontSize: 10.5, letterSpacing: 0.2 },
  tileTitle: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.xl },
  sheet: { borderRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.displaySemi, fontSize: 19, marginBottom: spacing.md },
  sheetInput: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.lg },
  cancel: { fontFamily: fonts.bodyBold, fontSize: 14 },
  createBtn: { height: 40, minWidth: 96, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  createText: { fontFamily: fonts.bodyBold, fontSize: 14 },
});
