import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

export type Bio = { ok: boolean; label: "Face ID" | "Fingerprint" | "Biometrics"; face: boolean };

/** What biometric this phone offers. Web preview has none. */
export async function bioInfo(): Promise<Bio> {
  if (Platform.OS === "web") return { ok: false, label: "Fingerprint", face: false };
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = has && await LocalAuthentication.isEnrolledAsync();
    const types = has ? await LocalAuthentication.supportedAuthenticationTypesAsync() : [];
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) && !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    return { ok: !!enrolled, label: face ? "Face ID" : types.length ? "Fingerprint" : "Biometrics", face };
  } catch { return { ok: false, label: "Fingerprint", face: false }; }
}

export async function bioUnlock(reason: string): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: "Use PIN", disableDeviceFallback: true });
    return r.success;
  } catch { return false; }
}
