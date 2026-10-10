import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { usePrefs } from "@/state/prefs";
import { env } from "@/lib/env";
import { networkBadge } from "@/lib/network";
import { grape } from "@/theme/colors";

export function NetworkBanner() {
  const badge = networkBadge(env.cluster);
  const bg = badge.tone === "test" ? "#3a2a00" : grape;
  return (
    <View style={{ backgroundColor: bg, paddingVertical: 4, paddingHorizontal: 12 }}>
      <Text style={{ color: "#fff", fontSize: 11, textAlign: "center" }}>{badge.label}</Text>
    </View>
  );
}

/** Local biometric gate. The server still requires its own step-up for money. */
export function LockGate({ children }: { children: ReactNode }) {
  const { lockOn, palette } = usePrefs();
  const [open, setOpen] = useState(!lockOn);

  useEffect(() => { setOpen(!lockOn); }, [lockOn]);

  const unlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Lexari", cancelLabel: "Cancel" });
    if (result.success) setOpen(true);
  };

  if (open) return children;
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Text style={{ color: palette.ink, fontSize: 16 }}>Lexari is locked</Text>
      <Pressable onPress={unlock} style={{ backgroundColor: grape, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Text style={{ color: "#fff", fontSize: 13 }}>Unlock</Text>
      </Pressable>
    </View>
  );
}

export async function biometricGate(reason: string): Promise<boolean> {
  const has = await LocalAuthentication.hasHardwareAsync();
  const enrolled = has && await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return true;
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
  return result.success;
}
