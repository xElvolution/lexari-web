/** Port of shared/components/BgArt.tsx + shared/lib/backgrounds.ts: the ID-card backgrounds (cover, like object-fit). */
import { useId } from "react";
import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import data from "@/content/backgrounds.json";

export type Background = { id: string; label: string; svg: string; ink: string };
export const BACKGROUNDS = data as Background[];
export const bgById = (id?: string) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
export const bgMarkup = (id: string | undefined, uid: string) => bgById(id).svg.split("{U}").join(uid);

/** Fills its parent (absolute) with the background tile. */
export default function BgArt({ id, opacity = 1 }: { id?: string; opacity?: number }) {
  const uid = "bg" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${bgMarkup(id, uid)}</svg>`;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, opacity }}>
      <SvgXml xml={xml} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    </View>
  );
}
