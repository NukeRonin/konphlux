import { Alert } from "react-native";
import * as StoreReview from "expo-store-review";

import { storage } from "@/src/utils/storage";

const OPENS_KEY = "konphlux.rate.opens";
const ASKED_KEY = "konphlux.rate.asked";
const THRESHOLD = 3; // ask after the 3rd meaningful visit

/**
 * Best-effort rating flow. Counts Feed visits and, once the user has returned a
 * few times, shows a gentle "Enjoying Konphlux?" prompt:
 *   • "I love it!"  → the native App Store / Play rating sheet (real builds only)
 *   • "Not really"  → onDecline() so we can offer the in-app Contact form instead
 * Shown only once. Never disrupts the app if anything fails.
 */
export async function maybeRequestReview(onDecline?: () => void): Promise<void> {
  try {
    if ((await storage.getItem<string>(ASKED_KEY, "")) === "1") return;

    const opens = (parseInt((await storage.getItem<string>(OPENS_KEY, "0")) || "0", 10) || 0) + 1;
    await storage.setItem(OPENS_KEY, String(opens));
    if (opens < THRESHOLD) return;

    // Only ask once, regardless of the answer.
    await storage.setItem(ASKED_KEY, "1");

    Alert.alert(
      "Enjoying Konphlux?",
      "Are you having a good time exploring the districts?",
      [
        {
          text: "Not really",
          style: "cancel",
          onPress: () => onDecline?.(),
        },
        {
          text: "I love it!",
          onPress: async () => {
            try {
              if ((await StoreReview.isAvailableAsync()) && (await StoreReview.hasAction())) {
                await StoreReview.requestReview();
              }
            } catch {
              /* no-op */
            }
          },
        },
      ],
      { cancelable: true },
    );
  } catch {
    /* never disrupt the app for a review prompt */
  }
}
