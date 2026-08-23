import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadImage } from "@/src/api/client";
import { Eyebrow } from "@/src/components/BrassText";
import { ForgeButton } from "@/src/components/ForgeButton";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

const TYPES = ["Cabin", "Cottage", "Loft", "Airship", "Manor", "Studio", "Houseboat", "Tower"];

function Stepper({ label, value, min, max, onChange, colors }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.label, { color: colors.onSurface }]}>{label}</Text>
      <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} hitSlop={8} testID={`host-dec-${label}`}><MaterialCommunityIcons name="minus" size={18} color={colors.onSurface} /></Pressable>
        <Text style={[styles.stepVal, { color: colors.onSurface }]}>{value}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} hitSlop={8} testID={`host-inc-${label}`}><MaterialCommunityIcons name="plus" size={18} color={colors.onSurface} /></Pressable>
      </View>
    </View>
  );
}

export default function HostYourPlace() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [placeType, setPlaceType] = useState("Cabin");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [guests, setGuests] = useState(2);
  const [bedrooms, setBedrooms] = useState(1);
  const [description, setDescription] = useState("");
  const [amenities, setAmenities] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const priceNum = parseFloat(price);
  const canSave = title.trim().length >= 3 && location.trim().length >= 2 && priceNum > 0;

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setError("Photo access is needed to add a picture."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true); setError("");
      setImage(await uploadImage(res.assets[0].uri, Platform.OS === "web"));
    } catch { setError("Couldn't upload that image. Try another."); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true); setError("");
    try {
      const created = await api.wpCreateStay({
        title: title.trim(), place_type: placeType, location: location.trim(),
        price_cents: Math.round(priceNum * 100), max_guests: guests, bedrooms,
        description: description.trim(), image_url: image,
        amenities: amenities.split(",").map((a) => a.trim()).filter(Boolean),
      });
      router.replace(`/waypoint/${created.id}`);
    } catch (e: any) { setError(e?.message || "Couldn't publish your listing."); setSaving(false); }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="host-back">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Host Your Place</Text>
          <Eyebrow>List a stay in Waypoint</Eyebrow>
        </View>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.onSurface }]}>Photo</Text>
        {image ? (
          <View>
            <Image source={{ uri: image }} style={styles.preview} contentFit="cover" />
            <Pressable onPress={() => setImage("")} style={[styles.removeImg, { backgroundColor: colors.surface }]} hitSlop={8} testID="host-remove-img"><MaterialCommunityIcons name="close" size={18} color={colors.onSurface} /></Pressable>
          </View>
        ) : (
          <Pressable onPress={pickImage} disabled={uploading} style={[styles.imgPick, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} testID="host-pick-img">
            <MaterialCommunityIcons name={uploading ? "loading" : "camera-plus-outline"} size={24} color={colors.brand} />
            <Text style={[styles.imgPickText, { color: colors.muted }]}>{uploading ? "Uploading…" : "Add a photo of your place"}</Text>
          </Pressable>
        )}

        <Text style={[styles.label, { color: colors.onSurface }]}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. The Copperline Cabin" placeholderTextColor={colors.muted} style={inputStyle} testID="host-title" />

        <Text style={[styles.label, { color: colors.onSurface }]}>Place type</Text>
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const active = placeType === t;
            return (
              <Pressable key={t} testID={`host-type-${t}`} onPress={() => setPlaceType(t)} style={[styles.typeChip, { backgroundColor: active ? colors.brand : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}>
                <Text style={[styles.typeChipText, { color: active ? colors.onBrandPrimary : colors.muted }]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Location</Text>
        <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Copperline Woods" placeholderTextColor={colors.muted} style={inputStyle} testID="host-location" />

        <Text style={[styles.label, { color: colors.onSurface }]}>Price per night ($)</Text>
        <TextInput value={price} onChangeText={setPrice} placeholder="120" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={inputStyle} testID="host-price" />

        <View style={styles.stepGroup}>
          <Stepper label="Guests" value={guests} min={1} max={32} onChange={setGuests} colors={colors} />
          <Stepper label="Bedrooms" value={bedrooms} min={0} max={20} onChange={setBedrooms} colors={colors} />
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Describe your place and what makes it special…" placeholderTextColor={colors.muted} multiline style={[inputStyle, { minHeight: 110, textAlignVertical: "top", paddingTop: spacing.md, lineHeight: 22 }]} testID="host-desc" />

        <Text style={[styles.label, { color: colors.onSurface }]}>Amenities (comma separated)</Text>
        <TextInput value={amenities} onChangeText={setAmenities} placeholder="Wood stove, Aether lamps, Forest views" placeholderTextColor={colors.muted} style={inputStyle} testID="host-amenities" />

        {error ? <Text style={[styles.error, { color: "#E53E3E" }]}>{error}</Text> : null}
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <ForgeButton label={saving ? "Publishing…" : "Publish listing"} fullWidth size="lg" disabled={!canSave || saving} testID="host-publish" onPress={save} icon={<MaterialCommunityIcons name="home-plus" size={18} color={colors.onBrandPrimary} />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13.5, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: 15 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeChip: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  typeChipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  stepGroup: { flexDirection: "row", gap: spacing.lg },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg },
  stepVal: { fontFamily: fonts.bodyBold, fontSize: 16 },
  imgPick: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 100, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed" },
  imgPickText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  preview: { width: "100%", height: 180, borderRadius: radius.md },
  removeImg: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1 },
});
