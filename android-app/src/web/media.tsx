/** Your profile picture and cover photo, from the same /api/media/{avatar,cover} the web app reads (webapp/lib/store.ts mediaUrl / setMedia). */
import { useEffect, useState } from "react";
import { Image, View, type ImageStyle, type ViewStyle } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { env } from "@/lib/env";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { T, useC } from "@/web/kit";

export type MediaKind = "avatar" | "cover";
/** The profile stores when the picture last changed (a number, like the web's `?v=` cache key). */
export const mediaAt = (v: unknown) => (typeof v === "number" && v > 0 ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0);

/** Bumped after an upload or removal so every picture on screen refetches. */
let bump = 0;
const subs = new Set<() => void>();
export function mediaChanged() { bump = Date.now(); subs.forEach((f) => f()); }
function useBump() { const [, set] = useState(0); useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []); return bump; }

export function useMediaSource(kind: MediaKind, at: unknown) {
  const { token } = useSession();
  const b = useBump();
  // The profile's timestamp when it has one; otherwise ask anyway (a 404 falls back to initials), as an older profile may lack it.
  const v = Math.max(mediaAt(at), b) || "0";
  if (!token) return null;
  return { uri: `${env.apiUrl}/api/media/${kind}?v=${v}`, headers: { Authorization: `Bearer ${token}` }, cache: "force-cache" as const };
}

/** Round picture, or initials on ink when there's none (or it fails to load). */
export function Avatar({ at, initials, size, style, fs }: { at: unknown; initials: string; size: number; style?: ViewStyle; fs?: number }) {
  const k = useC();
  const src = useMediaSource("avatar", at);
  const [bad, setBad] = useState<string | null>(null);
  const show = src && bad !== src.uri;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: k.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" }, style]}>
      {show ? <Image source={src} onError={() => setBad(src.uri)} style={{ width: size, height: size } as ImageStyle} resizeMode="cover" accessibilityIgnoresInvertColors /> : <T f="bold" s={fs ?? Math.round(size * 0.3)} c={k.bg}>{initials || "Y"}</T>}
    </View>
  );
}

/** Cover photo filling its parent, over the default gradient. */
export function Cover({ at }: { at: unknown }) {
  const src = useMediaSource("cover", at);
  const [bad, setBad] = useState<string | null>(null);
  if (!src || bad === src.uri) return null;
  return <Image source={src} onError={() => setBad(src.uri)} resizeMode="cover" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, width: "100%", height: "100%" }} />;
}

/**
 * Pick, crop and upload a new picture or cover, same sizes as the web ImageCrop (512x512 picture, 1500x500 cover, JPEG).
 * Returns false when you cancel.
 */
export async function pickAndUpload(kind: MediaKind, token: string | null): Promise<boolean> {
  if (!token) return false;
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Allow photo access to choose a picture.");
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: kind === "avatar" ? [1, 1] : [3, 1], quality: 1 });
  if (r.canceled || !r.assets?.[0]) return false;
  const out = kind === "avatar" ? { width: 512, height: 512 } : { width: 1500, height: 500 };
  let q = 0.85, b64 = "";
  for (let i = 0; i < 4; i++) {
    const m = await manipulateAsync(r.assets[0].uri, [{ resize: out }], { compress: q, format: SaveFormat.JPEG, base64: true });
    b64 = m.base64 ?? "";
    if (b64.length * 0.75 < 850_000) break;
    q -= 0.2;
  }
  await api(`/api/media/${kind}`, { method: "PUT", body: JSON.stringify({ data: `data:image/jpeg;base64,${b64}` }) }, token);
  mediaChanged();
  return true;
}
export async function removeMedia(kind: MediaKind, token: string | null) {
  if (token) { await api(`/api/media/${kind}`, { method: "DELETE" }, token); mediaChanged(); }
}
