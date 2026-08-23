import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, District } from "@/src/api/client";
import { BrassText, Eyebrow } from "@/src/components/BrassText";
import { ChatmongerCard } from "@/src/components/ChatmongerCard";
import { ForgeButton } from "@/src/components/ForgeButton";
import { Gear } from "@/src/components/Gear";
import { Panel } from "@/src/components/Panel";
import { ErrorState, Loading } from "@/src/components/States";
import { useTheme } from "@/src/theme/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Districts that have a dedicated functional hub (not just the Chatmonger chat).
const DISTRICT_HUBS: Record<string, { route: string; label: string }> = {
  roundtable: { route: "/roundtable", label: "Enter the Roundtable" },
  answerfier: { route: "/answerfier", label: "Enter Answerfier" },
  bazaar: { route: "/(tabs)/bazaar", label: "Enter the Bazaar" },
  "sparking-dawn": { route: "/sparking-dawn", label: "Enter Sparking Dawn" },
  "author-anvil": { route: "/anvil", label: "Enter Author Anvil" },
  brainboost: { route: "/brainboost", label: "Enter BrainBoost" },
  "pictureshow-theatre": { route: "/pictureshow", label: "Enter PictureShow" },
  chatterbox: { route: "/chatterbox", label: "Enter Chatterbox" },
  dreambacker: { route: "/dreambacker", label: "Enter Dreambacker" },
  "frankenstein-lab": { route: "/frankenstein-lab/audio", label: "Open Audio Studio" },
  "profession-plaza": { route: "/profession", label: "Open the Job Board" },
  "evention-center": { route: "/evention", label: "Open the Calendar" },
  retrospections: { route: "/retrospections", label: "Enter Retrospections" },
  treasury: { route: "/treasury", label: "Open Konphlux Balance" },
  "entrepreneur-lobby": { route: "/lobby", label: "Open Workspaces" },
  telegraph: { route: "/telegraph", label: "Enter the Telegraph" },
  waypoint: { route: "/waypoint", label: "Open the Booking Engine" },
  vault: { route: "/vault", label: "Open the Vault" },
};

// Author Anvil — every feature opens a real writing/publishing destination.
const ANVIL_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Stories": { route: "/anvil?kind=story", icon: "book-open-variant" },
  "Scripts": { route: "/anvil?kind=script", icon: "script-text" },
  "Prompts": { route: "/anvil/prompts", icon: "lightbulb-on" },
  "Write & Submit Stories": { route: "/anvil/write?kind=story", icon: "feather" },
  "Write & Submit Scripts": { route: "/anvil/write?kind=script", icon: "script-text-play" },
  "Story Categories": { route: "/anvil", icon: "shape-outline" },
  "GenoScribe": { route: "/anvil/genoscribe", icon: "auto-fix" },
  "Co-writing": { route: "/anvil/cowriting", icon: "account-multiple" },
  "AIventure": { route: "/anvil/aiventure", icon: "compass-rose" },
};

// Sparking Dawn — the two feature buttons open the discovery deck filtered by who you seek.
const SPARKING_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "I'm looking for men": { route: "/sparking-dawn?seeking=man", icon: "gender-male" },
  "I'm looking for women": { route: "/sparking-dawn?seeking=woman", icon: "gender-female" },
};

// For the Bazaar district, every feature chip opens a working destination.
const BAZAAR_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Buy": { route: "/(tabs)/bazaar", icon: "cart" },
  "Sell": { route: "/bazaar/sell", icon: "tag-plus" },
  "Booths": { route: "/bazaar/booths", icon: "storefront" },
  "Setup Booth": { route: "/bazaar/new-booth", icon: "store-plus" },
  "You Might Be Interested In": { route: "/(tabs)/bazaar", icon: "lightbulb-on" },
  "Your Posts": { route: "/bazaar/mine", icon: "package-variant" },
  "Your Saves": { route: "/saved", icon: "bookmark-multiple" },
  "Seller ratings": { route: "/bazaar/mine", icon: "star-circle" },
  "eBooks": { route: "/(tabs)/bazaar?category=eBooks", icon: "book-open-page-variant" },
  "Audio Books": { route: "/(tabs)/bazaar?category=Audio Books", icon: "headphones" },
  "Wish lists": { route: "/saved", icon: "heart" },
  "Shopping cart": { route: "/cart", icon: "cart-outline" },
  "Checkout": { route: "/cart", icon: "credit-card-outline" },
};

// For the Answerfier district, each feature chip opens the Q&A board with a filter.
const ANSWERFIER_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "New Questions": { route: "/answerfier?filter=new", icon: "clock-outline" },
  "Popular Questions": { route: "/answerfier?filter=popular", icon: "fire" },
  "Trending Questions": { route: "/answerfier?filter=trending", icon: "trending-up" },
  "Unanswered Questions": { route: "/answerfier?filter=unanswered", icon: "help-circle-outline" },
  "Categories": { route: "/answerfier", icon: "shape-outline" },
};

// BrainBoost — every feature opens a real learning destination.
const BRAINBOOST_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Courses": { route: "/brainboost/courses", icon: "book-education" },
  "Fun Facts": { route: "/brainboost/facts", icon: "lightbulb-on" },
  "Dictionary": { route: "/brainboost/lexicon?mode=dictionary", icon: "book-alphabet" },
  "Thesaurus": { route: "/brainboost/lexicon?mode=thesaurus", icon: "book-search" },
  "Quizzes": { route: "/brainboost/quizzes", icon: "help-circle" },
  "Video lessons": { route: "/brainboost/videos", icon: "play-circle" },
  "Saved progress": { route: "/brainboost/courses", icon: "progress-check" },
  "AI tutoring": { route: "/chatmonger/brainboost", icon: "school" },
  "Repair Guy": { route: "/brainboost/repair", icon: "wrench" },
};

// For the Roundtable district, each feature chip is a working shortcut.
const ROUNDTABLE_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Create Community": { route: "/roundtable/new-community", icon: "account-multiple-plus" },
  "Browse Communities": { route: "/roundtable/communities?filter=all", icon: "account-group" },
  "Recently Visited": { route: "/roundtable/communities?filter=recent", icon: "history" },
  "Joined Communities": { route: "/roundtable/communities?filter=joined", icon: "account-check" },
  "Discussion threads": { route: "/roundtable", icon: "forum" },
  "Discussions I Started": { route: "/roundtable/my-threads", icon: "feather" },
  "Site-wide discussion routing": { route: "/roundtable", icon: "sitemap" },
};

// PictureShow — every feature opens a real destination. Streamora is a branch.
const PICTURESHOW_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Videos": { route: "/pictureshow/videos", icon: "movie-open" },
  "Upload videos": { route: "/pictureshow/upload", icon: "upload" },
  "Categories": { route: "/pictureshow/videos", icon: "shape-outline" },
  "Streamora": { route: "/pictureshow/streamora", icon: "video-wireless" },
  "Subscriptions": { route: "/pictureshow/subscriptions", icon: "bell-ring" },
  "Playlists": { route: "/pictureshow/playlists", icon: "playlist-play" },
  "Channels": { route: "/pictureshow/channels", icon: "account-group" },
  "Trending": { route: "/pictureshow/videos", icon: "fire" },
  "Create AI Video": { route: "/pictureshow/ai?kind=video", icon: "movie-filter" },
  "Create AI Animation": { route: "/pictureshow/ai?kind=animation", icon: "animation-play" },
};

// Chatterbox — messaging district.
const CHATTERBOX_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Private messaging": { route: "/chatterbox/inbox", icon: "message-text" },
  "Group chats": { route: "/chatterbox/inbox?filter=group", icon: "account-multiple" },
  "Voice calls": { route: "/chatterbox/new?call=voice", icon: "phone" },
  "Video calls": { route: "/chatterbox/new?call=video", icon: "video" },
};

// Bluepaint — Space Designer replaces Floor Plan Studio + Room Planner.
const BLUEPAINT_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Space Designer": { route: "/bluepaint", icon: "floor-plan" },
  "Materials Estimator": { route: "/bluepaint/estimator", icon: "cube-scan" },
  "Construction Cost Estimator": { route: "/bluepaint/cost", icon: "calculator-variant" },
  "Design Reviews with Iris": { route: "/bluepaint/review", icon: "eye-check" },
  "Saved Blueprints": { route: "/bluepaint", icon: "folder-multiple-image" },
};

// Dreambacker — crowdfunding. Fundraiser-related features open the funding hub / creator flow.
const DREAMBACKER_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Start a Fundraiser": { route: "/dreambacker/new", icon: "rocket-launch" },
  "All Fundraisers": { route: "/dreambacker?filter=all", icon: "hand-heart" },
  "New Fundraisers": { route: "/dreambacker?filter=new", icon: "new-box" },
  "Trending Fundraisers": { route: "/dreambacker?filter=trending", icon: "trending-up" },
  "Popular Fundraisers": { route: "/dreambacker?filter=popular", icon: "fire" },
  "Near Deadline Fundraisers": { route: "/dreambacker?filter=deadline", icon: "clock-alert-outline" },
  "Fundraisers I Created": { route: "/dreambacker?filter=mine", icon: "account-star" },
};

// Frankenstein Lab — AI creation studio. Audio tools open the Audio Creation Studio.
const FRANKENSTEIN_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  GenoTune: { route: "/frankenstein-lab/audio?mode=music", icon: "music-clef-treble" },
  GenoFX: { route: "/frankenstein-lab/audio?mode=sfx", icon: "waveform" },
  GenoPic: { route: "/frankenstein-lab/visual?type=pic", icon: "image" },
  GenoLogo: { route: "/frankenstein-lab/visual?type=logo", icon: "shield-star" },
  GenoGIF: { route: "/frankenstein-lab/visual?type=gif", icon: "animation-play" },
  GenoMeme: { route: "/frankenstein-lab/visual?type=meme", icon: "emoticon-lol" },
};

// Profession Plaza — Job Board. Job features open the board; the rest open the plaza assistant.
const PROFESSION_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Find jobs": { route: "/profession", icon: "briefcase-search" },
  "Post jobs": { route: "/profession/post", icon: "briefcase-plus" },
  "Job Categories": { route: "/profession", icon: "shape-outline" },
  "Apply & track applications": { route: "/profession?tab=applications", icon: "clipboard-check-outline" },
  "Find Freelance Gigs": { route: "/profession/marketplace?tab=gigs", icon: "account-hard-hat" },
  "Freelancer marketplace": { route: "/profession/marketplace?tab=freelancers", icon: "storefront-outline" },
  "Resumés": { route: "/profession/marketplace/edit", icon: "file-account-outline" },
  "Interview scheduling": { route: "/chatmonger/profession-plaza", icon: "calendar-clock" },
};

// Evention Center — the calendar district. Interviews open the live schedule.
const EVENTION_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Upcoming Interviews": { route: "/evention/interviews", icon: "calendar-account" },
  "Calendar view": { route: "/evention", icon: "calendar-month" },
  "Meetings": { route: "/evention", icon: "account-group" },
  "Upcoming Flights & Trips": { route: "/evention", icon: "airplane" },
  "Reminders": { route: "/evention", icon: "bell-outline" },
  "Appointments": { route: "/evention", icon: "clock-outline" },
  "Events": { route: "/evention", icon: "calendar-star" },
  "Birthdays & Special Days": { route: "/evention", icon: "cake-variant" },
  "Agendas": { route: "/evention/agenda", icon: "clipboard-list" },
  "Lists": { route: "/evention/lists", icon: "format-list-bulleted" },
  "Create a List": { route: "/evention/lists", icon: "playlist-plus" },
};

// Retrospections — the reviews district. Features open the review system.
const RETRO_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Reviews": { route: "/retrospections", icon: "star-box" },
  "Submit Review": { route: "/retrospections/submit", icon: "star-plus" },
  "Review Categories": { route: "/retrospections", icon: "shape" },
  "Browse nearby": { route: "/retrospections/map", icon: "map-search-outline" },
  "Save favourite places": { route: "/saved", icon: "heart-outline" },
  "Opening Soon": { route: "/retrospections/status?tab=opening", icon: "storefront-outline" },
  "Recently Opened": { route: "/retrospections/status?tab=recent", icon: "storefront-check-outline" },
  "Health Inspection Updates": { route: "/retrospections/status?tab=health", icon: "clipboard-pulse-outline" },
  "Put a Business Up for Sale": { route: "/retrospections/marketplace/sell", icon: "tag-plus" },
  "Businesses For Sale": { route: "/retrospections/marketplace", icon: "store-search-outline" },
  "Save Favorite Places": { route: "/retrospections/favorites", icon: "heart-outline" },
};

// Treasury — the core wallet/ledger district.
const TREASURY_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Konphlux Balance": { route: "/treasury", icon: "bank" },
  "Payments": { route: "/treasury?tab=payments", icon: "cash-multiple" },
  "Transfers": { route: "/treasury?tab=transfers", icon: "bank-transfer" },
  "Donations in Dreambacker": { route: "/treasury/trackers?source=dreambacker", icon: "hand-heart" },
  "Spends in Bazaar": { route: "/treasury/trackers?source=bazaar", icon: "shopping" },
  "Deals in Waypoint": { route: "/treasury/trackers?source=waypoint", icon: "map-marker-radius" },
  "Deals in Retrospections": { route: "/treasury/trackers?source=retrospections", icon: "store-search-outline" },
};

// Telegraph — the articles district. Feature chips open the Article Gallery tabs.
const TELEGRAPH_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "All Articles": { route: "/telegraph?filter=all", icon: "newspaper-variant-outline" },
  "Post Something": { route: "/telegraph/new", icon: "feather" },
  "Popular": { route: "/telegraph?filter=popular", icon: "fire" },
  "Trending": { route: "/telegraph?filter=trending", icon: "trending-up" },
  "New": { route: "/telegraph?filter=new", icon: "clock-outline" },
  "Following": { route: "/telegraph?filter=following", icon: "account-heart-outline" },
  "News": { route: "/telegraph/news", icon: "newspaper-variant-multiple-outline" },
  "Reading lists": { route: "/telegraph/reading-list", icon: "bookmark-multiple-outline" },
};

const WAYPOINT_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Search stays": { route: "/waypoint", icon: "home-search-outline" },
  "Book a stay": { route: "/waypoint", icon: "calendar-check-outline" },
  "Host your place": { route: "/waypoint/host", icon: "home-plus-outline" },
  "Vacation houses": { route: "/waypoint?group=Vacation%20Houses", icon: "home-city-outline" },
  "Condos & apartments": { route: "/waypoint?group=Condos%20%26%20Apartments", icon: "office-building-outline" },
  "Cabins & cottages": { route: "/waypoint?group=Cabins%20%26%20Cottages", icon: "home-outline" },
  "Places for sale": { route: "/waypoint?kind=sale", icon: "tag-outline" },
  "Saved stays & wish lists": { route: "/waypoint/saved", icon: "heart-outline" },
  "Guest & host reviews": { route: "/waypoint", icon: "star-outline" },
  "Trip planner": { route: "/waypoint/trip", icon: "map-clock-outline" },
  "Map search": { route: "/waypoint", icon: "map-outline" },
  "Your bookings": { route: "/waypoint/bookings", icon: "bag-suitcase-outline" },
};

const VAULT_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Recipes": { route: "/vault?category=Recipes", icon: "silverware-fork-knife" },
  "DIY projects": { route: "/vault?category=DIY%20Projects", icon: "hammer-screwdriver" },
  "Magic tricks": { route: "/vault?category=Magic%20Tricks", icon: "auto-fix" },
  "Life hacks": { route: "/vault?category=Life%20Hacks", icon: "lightbulb-on-outline" },
  "Crafts": { route: "/vault?category=Crafts", icon: "scissors-cutting" },
  "Decor Ideas": { route: "/vault?category=Decor%20Ideas", icon: "sofa-outline" },
  "Travel Ideas": { route: "/vault?category=Travel%20Ideas", icon: "airplane" },
  "AI Artwork": { route: "/vault?category=Artwork", icon: "image-multiple-outline" },
  "Fashion": { route: "/vault?category=Fashion", icon: "hanger" },
  "Reading List": { route: "/vault?category=Reading%20List", icon: "book-open-page-variant-outline" },
  "Quotes": { route: "/vault?category=Quotes", icon: "format-quote-close" },
  "Collections & boards": { route: "/vault", icon: "folder-multiple-image" },
  "Tutorials": { route: "/vault?category=Tutorials", icon: "school-outline" },
};

// Streamora — the live-streaming district.
const STREAMORA_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Go live": { route: "/pictureshow/streamora/golive", icon: "video-plus" },
  "Live Now": { route: "/pictureshow/streamora", icon: "access-point" },
  "Upcoming Live Streams": { route: "/pictureshow/streamora", icon: "calendar-clock" },
  "Recent Live Streams": { route: "/pictureshow/streamora", icon: "history" },
  "Follow streamers": { route: "/pictureshow/streamora", icon: "account-heart" },
  "Clips & highlights": { route: "/pictureshow/streamora", icon: "movie-star-outline" },
};

// Library — purchased/downloaded books district.
const LIBRARY_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "Your Library": { route: "/library", icon: "bookshelf" },
  "eBooks": { route: "/library", icon: "book-open-page-variant" },
  "Audio Books": { route: "/library", icon: "headphones" },
  "Buy eBooks": { route: "/(tabs)/bazaar?category=eBooks", icon: "cart-plus" },
  "Buy Audio Books": { route: "/(tabs)/bazaar?category=Audio Books", icon: "cart-plus" },
};

// Home — the social hub district; each feature opens the matching destination.
const HOME_ACTIONS: Record<string, { route: string; icon: IconName }> = {
  "News Feed": { route: "/(tabs)", icon: "newspaper-variant-outline" },
  "Posts & Comments": { route: "/(tabs)", icon: "comment-text-outline" },
  "Reactions & Sharing": { route: "/(tabs)", icon: "heart-outline" },
  "Photo Albums": { route: "/(tabs)/profile", icon: "image-multiple-outline" },
  "Stories": { route: "/compose", icon: "camera-plus-outline" },
  "Groups": { route: "/roundtable/communities?filter=all", icon: "account-group" },
  "Events": { route: "/evention", icon: "calendar-star" },
  "Pages": { route: "/(tabs)/profile", icon: "file-account-outline" },
  "Marketplace shortcuts": { route: "/(tabs)/bazaar", icon: "storefront-outline" },
  "Trending topics": { route: "/roundtable", icon: "fire" },
  "Friend suggestions": { route: "/chatterbox", icon: "account-plus-outline" },
  "Messaging shortcuts": { route: "/chatterbox", icon: "message-text-outline" },
  "Profile pages": { route: "/(tabs)/profile", icon: "account-circle-outline" },
};

const ACTIONS_BY_SLUG: Record<string, Record<string, { route: string; icon: IconName }>> = {
  home: HOME_ACTIONS,
  streamora: STREAMORA_ACTIONS,
  library: LIBRARY_ACTIONS,
  retrospections: RETRO_ACTIONS,
  treasury: TREASURY_ACTIONS,
  "entrepreneur-lobby": {
    "Business workspaces": { route: "/lobby", icon: "office-building" },
    "Add Workspace": { route: "/lobby", icon: "plus-box" },
    "Add Teammates": { route: "/lobby", icon: "account-multiple-plus" },
    "My Team": { route: "/lobby", icon: "account-group" },
  },
  roundtable: ROUNDTABLE_ACTIONS,
  answerfier: ANSWERFIER_ACTIONS,
  bazaar: BAZAAR_ACTIONS,
  "sparking-dawn": SPARKING_ACTIONS,
  "author-anvil": ANVIL_ACTIONS,
  brainboost: BRAINBOOST_ACTIONS,
  "pictureshow-theatre": PICTURESHOW_ACTIONS,
  chatterbox: CHATTERBOX_ACTIONS,
  bluepaint: BLUEPAINT_ACTIONS,
  dreambacker: DREAMBACKER_ACTIONS,
  "frankenstein-lab": FRANKENSTEIN_ACTIONS,
  "profession-plaza": PROFESSION_ACTIONS,
  "evention-center": EVENTION_ACTIONS,
  telegraph: TELEGRAPH_ACTIONS,
  waypoint: WAYPOINT_ACTIONS,
  vault: VAULT_ACTIONS,
};

export default function DistrictDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [district, setDistrict] = useState<District | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      setStatus("loading");
      const res = await api.getDistrict(slug);
      setDistrict(res);
      setSaved(!!res.saved);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavourite = async () => {
    setSaved((s) => !s);
    try {
      await api.toggleSave("district", slug!);
    } catch {
      setSaved((s) => !s);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      {status === "loading" ? (
        <>
          <View style={{ height: insets.top }} />
          <Loading label="Entering the district…" />
        </>
      ) : status === "error" || !district ? (
        <>
          <View style={{ height: insets.top }} />
          <ErrorState onRetry={load} />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient
            colors={[colors.surfaceTertiary, colors.surface]}
            style={[styles.hero, { paddingTop: insets.top + spacing.md, borderBottomColor: colors.border }]}
          >
            <Gear size={220} opacity={0.09} style={{ right: -60, top: -40 }} />
            <Gear size={120} opacity={0.08} reverse style={{ left: -30, top: 120 }} />
            <View style={styles.heroTopRow}>
              <Pressable onPress={() => router.back()} hitSlop={12} testID="district-back" style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="chevron-left" size={24} color={colors.onSurface} />
              </Pressable>
              <Pressable onPress={toggleFavourite} hitSlop={12} testID="district-favourite" style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: saved ? colors.brand : colors.border }]}>
                <MaterialCommunityIcons name={saved ? "star" : "star-outline"} size={22} color={saved ? colors.brandPrimary : colors.onSurface} />
              </Pressable>
            </View>

            <View style={[styles.heroIcon, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderStrong }]}>
              <MaterialCommunityIcons name={district.icon as IconName} size={30} color={colors.brand} />
            </View>
            <Eyebrow style={{ marginTop: spacing.lg }}>District</Eyebrow>
            <BrassText size={38} style={{ marginTop: 6 }}>{district.name}</BrassText>
            <Text style={[styles.tagline, { color: colors.brand }]}>{district.tagline}</Text>
            <Text style={[styles.description, { color: colors.muted }]}>{district.description}</Text>
            <ForgeButton
              label={DISTRICT_HUBS[district.slug]?.label ?? `Enter & chat with ${district.chatmonger.name}`}
              style={{ marginTop: spacing.lg }}
              testID="district-enter"
              icon={<MaterialCommunityIcons name="arrow-right-bold-box" size={18} color={colors.onBrandPrimary} />}
              onPress={() =>
                DISTRICT_HUBS[district.slug]
                  ? router.push(DISTRICT_HUBS[district.slug].route as any)
                  : router.push(`/chatmonger/${district.slug}`)
              }
            />
            {district.slug !== "roundtable" ? (
              <ForgeButton
                label={`Discuss ${district.name} at the Roundtable`}
                variant="outline"
                fullWidth
                style={{ marginTop: spacing.sm }}
                testID="district-discuss"
                icon={<MaterialCommunityIcons name="forum-outline" size={18} color={colors.brand} />}
                onPress={() => router.push(`/roundtable/discuss?category=${encodeURIComponent(district.name)}`)}
              />
            ) : null}
          </LinearGradient>

          {/* Features */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Inside {district.name}</Text>
            <View style={{ gap: spacing.sm }}>
              {district.features.map((f) => {
                const mapped = ACTIONS_BY_SLUG[district.slug]?.[f];
                const route = mapped?.route
                  ?? DISTRICT_HUBS[district.slug]?.route
                  ?? `/chatmonger/${district.slug}`;
                const icon: IconName = mapped?.icon ?? "arrow-right-circle-outline";
                return (
                  <Pressable
                    key={f}
                    testID={`feature-${f}`}
                    onPress={() => router.push(route as any)}
                    style={({ pressed }) => [
                      styles.featureRow,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={[styles.featureRowIcon, { backgroundColor: colors.surfaceTertiary }]}>
                      <MaterialCommunityIcons name={icon} size={18} color={colors.brand} />
                    </View>
                    <Text style={[styles.featureRowText, { color: colors.onSurface }]}>{f}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Chatmonger */}
          <View style={styles.section}>
            <ChatmongerCard
              chatmonger={district.chatmonger}
              district={district.name}
              onPress={() => router.push(`/chatmonger/${district.slug}`)}
            />
          </View>

          {/* Nearby districts */}
          {district.nearby && district.nearby.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Nearby districts</Text>
              <View style={{ gap: spacing.sm }}>
                {district.nearby.map((d) => (
                  <Pressable
                    key={d.slug}
                    testID={`nearby-${d.slug}`}
                    onPress={() => router.push(`/district/${d.slug}`)}
                  >
                    <Panel style={styles.nearbyRow}>
                      <View style={[styles.nearbyIcon, { backgroundColor: colors.surfaceTertiary }]}>
                        <MaterialCommunityIcons name={d.icon as IconName} size={20} color={colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.nearbyName, { color: colors.onSurface }]}>{d.name}</Text>
                        <Text numberOfLines={1} style={[styles.nearbyTagline, { color: colors.muted }]}>
                          {d.tagline}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="arrow-right" size={18} color={colors.brand} />
                    </Panel>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomWidth: 1, overflow: "hidden" },
  heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tagline: { fontFamily: fonts.displaySemi, fontSize: 16, marginTop: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.sm },

  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, marginBottom: spacing.md },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureText: { fontFamily: fonts.bodyMedium, fontSize: 13 },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  featureRowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  featureRowText: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 15 },

  nearbyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nearbyIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  nearbyName: { fontFamily: fonts.displaySemi, fontSize: 15 },
  nearbyTagline: { fontFamily: fonts.body, fontSize: 12, marginTop: 1 },
});
