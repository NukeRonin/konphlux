import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && enrolled;
  } catch {
    return false;
  }
}

export async function authenticateBiometric(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    if (!(await biometricAvailable())) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Treasury",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
