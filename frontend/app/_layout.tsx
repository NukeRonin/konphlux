import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider, useAuth } from "@/src/auth/AuthContext";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeContext";
import SmartReminders from "@/src/components/SmartReminders";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { mode, colors } = useTheme();
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, ready, segments, router]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }} />;
  }

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="district/[slug]" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="bazaar/sell" options={{ presentation: "modal" }} />
        <Stack.Screen name="bazaar/mine" />
        <Stack.Screen name="bazaar/booths" />
        <Stack.Screen name="bazaar/booth/[id]" />
        <Stack.Screen name="bazaar/new-booth" options={{ presentation: "modal" }} />
        <Stack.Screen name="sparking-dawn/index" />
        <Stack.Screen name="sparking-dawn/matches" />
        <Stack.Screen name="sparking-dawn/profile" options={{ presentation: "modal" }} />
        <Stack.Screen name="anvil/index" />
        <Stack.Screen name="anvil/work/[id]" />
        <Stack.Screen name="anvil/prompts" />
        <Stack.Screen name="anvil/cowriting" />
        <Stack.Screen name="anvil/aiventure" />
        <Stack.Screen name="anvil/genoscribe" />
        <Stack.Screen name="anvil/write" options={{ presentation: "modal" }} />
        <Stack.Screen name="saved" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="chatmonger/[slug]" options={{ presentation: "card" }} />
        <Stack.Screen name="roundtable/index" />
        <Stack.Screen name="roundtable/communities" />
        <Stack.Screen name="roundtable/my-threads" />
        <Stack.Screen name="roundtable/community/[id]" />
        <Stack.Screen name="roundtable/thread/[id]" />
        <Stack.Screen name="roundtable/new-community" options={{ presentation: "modal" }} />
        <Stack.Screen name="roundtable/new-thread" options={{ presentation: "modal" }} />
        <Stack.Screen name="answerfier/index" />
        <Stack.Screen name="answerfier/question/[id]" />
        <Stack.Screen name="answerfier/new-question" options={{ presentation: "modal" }} />
        <Stack.Screen name="brainboost/index" />
        <Stack.Screen name="brainboost/courses" />
        <Stack.Screen name="brainboost/course/[id]" />
        <Stack.Screen name="brainboost/quizzes" />
        <Stack.Screen name="brainboost/quiz/[id]" />
        <Stack.Screen name="brainboost/facts" />
        <Stack.Screen name="brainboost/videos" />
        <Stack.Screen name="brainboost/lexicon" />
        <Stack.Screen name="brainboost/repair" />
        <Stack.Screen name="pictureshow/index" />
        <Stack.Screen name="pictureshow/videos" />
        <Stack.Screen name="pictureshow/video/[id]" />
        <Stack.Screen name="pictureshow/upload" options={{ presentation: "modal" }} />
        <Stack.Screen name="pictureshow/channels" />
        <Stack.Screen name="pictureshow/channel/[id]" />
        <Stack.Screen name="pictureshow/subscriptions" />
        <Stack.Screen name="pictureshow/playlists" />
        <Stack.Screen name="pictureshow/playlist/[id]" />
        <Stack.Screen name="pictureshow/ai" />
        <Stack.Screen name="pictureshow/characters" />
        <Stack.Screen name="pictureshow/projects" />
        <Stack.Screen name="profession/index" />
        <Stack.Screen name="profession/post" />
        <Stack.Screen name="profession/[id]" />
        <Stack.Screen name="profession/manage/[id]" />
        <Stack.Screen name="profession/alerts" />
        <Stack.Screen name="profession/marketplace/index" />
        <Stack.Screen name="profession/marketplace/edit" />
        <Stack.Screen name="profession/marketplace/freelancer/[id]" />
        <Stack.Screen name="evention/interviews" />
        <Stack.Screen name="evention/index" />
        <Stack.Screen name="evention/agenda" />
        <Stack.Screen name="evention/lists" />
        <Stack.Screen name="evention/list/[id]" />
        <Stack.Screen name="profession/contract/[id]" />
        <Stack.Screen name="retrospections/index" />
        <Stack.Screen name="retrospections/submit" />
        <Stack.Screen name="retrospections/map" />
        <Stack.Screen name="retrospections/business/[id]" />
        <Stack.Screen name="pictureshow/streamora/index" />
        <Stack.Screen name="pictureshow/streamora/golive" options={{ presentation: "modal" }} />
        <Stack.Screen name="pictureshow/streamora/watch" />
        <Stack.Screen name="chatterbox/index" />
        <Stack.Screen name="chatterbox/inbox" />
        <Stack.Screen name="chatterbox/new" options={{ presentation: "modal" }} />
        <Stack.Screen name="chatterbox/new-group" options={{ presentation: "modal" }} />
        <Stack.Screen name="chatterbox/conversation/[id]" />
        <Stack.Screen name="chatterbox/call" />
        <Stack.Screen name="bluepaint/index" />
        <Stack.Screen name="bluepaint/design/[id]" />
        <Stack.Screen name="bluepaint/estimator" />
        <Stack.Screen name="bluepaint/cost" />
        <Stack.Screen name="bluepaint/review" />
        <Stack.Screen name="dreambacker/index" />
        <Stack.Screen name="dreambacker/new" />
        <Stack.Screen name="dreambacker/[id]" />
        <Stack.Screen name="dreambacker/edit/[id]" />
        <Stack.Screen name="dreambacker/backings" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="frankenstein-lab/audio" />
        <Stack.Screen name="frankenstein-lab/visual" />
        <Stack.Screen name="frankenstein-lab/vault" />
        <Stack.Screen name="compose" options={{ presentation: "modal" }} />
      </Stack>
      {user ? <SmartReminders /> : null}
    </>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    "Cinzel-Regular": require("../assets/fonts/Cinzel-Regular.ttf"),
    "Cinzel-SemiBold": require("../assets/fonts/Cinzel-SemiBold.ttf"),
    "Cinzel-Bold": require("../assets/fonts/Cinzel-Bold.ttf"),
    "Karla-Regular": require("../assets/fonts/Karla-Regular.ttf"),
    "Karla-Medium": require("../assets/fonts/Karla-Medium.ttf"),
    "Karla-Bold": require("../assets/fonts/Karla-Bold.ttf"),
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
