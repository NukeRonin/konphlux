import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const CATEGORIES = ["Instruments", "Aetherworks", "Tools", "Furniture", "Paper Goods", "eBooks", "Audio Books", "Other"];
const DURATIONS = [
  { label: "24 hours", hours: 24 },
  { label: "2 days", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

export default function SellScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Instruments");
  const [kind, setKind] = useState<"fixed" | "auction">("fixed");
  const [price, setPrice] = useState("");
  const [durationHours, setDurationHours] = useState(48);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    let perm = await ImagePicker.getCameraPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access to photograph your listing.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) setImageUri(res.assets[0].uri);
  };

  const submit = async () => {
    setError("");
    if (!imageUri) return setError("Add a photo of your item.");
    if (title.trim().length < 3) return setError("Give your item a title (3+ characters).");
    if (!description.trim()) return setError("Add a short description.");
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!priceCents || priceCents < 100) return setError(kind === "auction" ? "Set a starting price (min $1)." : "Set a price (min $1).");

    setBusy(true);
    try {
      const image = await uploadImage(imageUri, Platform.OS === "web");
      const payload =
        kind === "auction"
          ? { title: title.trim(), description: description.trim(), category, image, kind, starting_price_cents: priceCents, duration_hours: durationHours }
          : { title: title.trim(), description: description.trim(), category, image, kind, price_cents: priceCents };
      const listing = await api.createListing(payload as any);
      router.replace(`/product/${listing.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post your listing. Try again.");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="sell-close">
          <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>List an Item</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={40} showsVerticalScrollIndicator={false}>
        <Eyebrow>Photo</Eyebrow>
        <Pressable
          testID="sell-image"
          onPress={pickFromLibrary}
          style={[styles.imageBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons name="image-plus" size={40} color={colors.muted} />
              <Text style={[styles.imageHint, { color: colors.muted }]}>Tap to add a photo</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.imageBtns}>
          <ForgeButton label="Library" variant="outline" size="sm" onPress={pickFromLibrary} testID="sell-library" icon={<MaterialCommunityIcons name="image-multiple" size={15} color={colors.brand} />} />
          <ForgeButton label="Camera" variant="ghost" size="sm" onPress={takePhoto} testID="sell-camera" icon={<MaterialCommunityIcons name="camera" size={15} color={colors.onSurface} />} />
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>Title</Eyebrow>
        <TextInput
          testID="sell-title"
          value={title}
          onChangeText={setTitle}
          placeholder="What are you selling?"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
          maxLength={120}
        />

        <Eyebrow style={{ marginTop: spacing.lg }}>Category</Eyebrow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              testID={`sell-cat-${c}`}
              onPress={() => setCategory(c)}
              style={[styles.chip, { backgroundColor: category === c ? colors.brand : colors.surfaceSecondary, borderColor: category === c ? colors.brand : colors.border }]}
            >
              <Text style={[styles.chipText, { color: category === c ? colors.onBrandPrimary : colors.onSurface }]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Eyebrow style={{ marginTop: spacing.lg }}>Description</Eyebrow>
        <TextInput
          testID="sell-description"
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the condition, materials, story…"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.multiline, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        />

        <Eyebrow style={{ marginTop: spacing.lg }}>Sale type</Eyebrow>
        <View style={styles.toggleRow}>
          {(["fixed", "auction"] as const).map((k) => (
            <Pressable
              key={k}
              testID={`sell-kind-${k}`}
              onPress={() => setKind(k)}
              style={[styles.toggle, { backgroundColor: kind === k ? colors.brand : colors.surfaceSecondary, borderColor: kind === k ? colors.brand : colors.border }]}
            >
              <MaterialCommunityIcons name={k === "fixed" ? "tag" : "gavel"} size={16} color={kind === k ? colors.onBrandPrimary : colors.brand} />
              <Text style={[styles.toggleText, { color: kind === k ? colors.onBrandPrimary : colors.onSurface }]}>
                {k === "fixed" ? "Fixed price" : "Auction"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Eyebrow style={{ marginTop: spacing.lg }}>{kind === "auction" ? "Starting price (USD)" : "Price (USD)"}</Eyebrow>
        <View style={[styles.priceWrap, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.dollar, { color: colors.muted }]}>$</Text>
          <TextInput
            testID="sell-price"
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            style={[styles.priceInput, { color: colors.onSurface }]}
          />
        </View>

        {kind === "auction" ? (
          <>
            <Eyebrow style={{ marginTop: spacing.lg }}>Auction length</Eyebrow>
            <View style={styles.durationRow}>
              {DURATIONS.map((d) => (
                <Pressable
                  key={d.hours}
                  testID={`sell-duration-${d.hours}`}
                  onPress={() => setDurationHours(d.hours)}
                  style={[styles.durationChip, { backgroundColor: durationHours === d.hours ? colors.brand : colors.surfaceSecondary, borderColor: durationHours === d.hours ? colors.brand : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: durationHours === d.hours ? colors.onBrandPrimary : colors.onSurface }]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {error ? <Text testID="sell-error" style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <ForgeButton
          label={kind === "auction" ? "Start auction" : "Post listing"}
          fullWidth
          size="lg"
          loading={busy}
          onPress={submit}
          testID="sell-submit"
          style={{ marginTop: spacing.xl }}
        />
      </KeyboardAwareScrollView>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 17 },
  body: { padding: spacing.lg, gap: spacing.sm },
  imageBox: { height: 200, borderRadius: radius.md, borderWidth: 1, overflow: "hidden", marginTop: spacing.sm },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  imageHint: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  imageBtns: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  toggleRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  toggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 46, borderRadius: radius.md, borderWidth: 1 },
  toggleText: { fontFamily: fonts.bodyBold, fontSize: 14 },
  priceWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  dollar: { fontFamily: fonts.displaySemi, fontSize: 18, marginRight: 4 },
  priceInput: { flex: 1, paddingVertical: spacing.md, fontFamily: fonts.body, fontSize: 18 },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  durationChip: { height: 38, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
});
