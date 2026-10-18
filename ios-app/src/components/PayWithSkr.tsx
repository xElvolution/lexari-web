/** Pay with SKR, as on the web Confirm sheet (BalancePaySheet.tsx): send SKR to your own deposit address, it is credited
 * to your USD balance with the SKR bonus, then you confirm the purchase from your balance as usual. */
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import TopUpFlow, { SKR_BONUS } from "@/components/TopUpFlow";
import { useData } from "@/web/data";
import { T, useC } from "@/web/kit";

const MIN = 5;

/** Dollars of SKR to send: what's missing (or the whole price when the balance already covers it), less the bonus, at least the $5 top up minimum. */
export function skrTopUpUsd(priceUsd: number, balanceMicros: number | null) {
  const have = (balanceMicros ?? 0) / 1e6;
  const need = have < priceUsd ? priceUsd - have : priceUsd;
  return Math.max(MIN, Math.ceil((need / (1 + SKR_BONUS)) * 100) / 100);
}

export default function PayWithSkr({ usd, disabled }: { usd: number; disabled?: boolean }) {
  const k = useC();
  const { wallet } = useData();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable accessibilityLabel="Pay with SKR" disabled={disabled} onPress={() => setOpen(true)} style={{ height: 44, borderRadius: 16, borderWidth: 1, borderColor: k.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.6 : 1 }}>
        <Image source={require("../../assets/coins/skr.png")} style={{ width: 20, height: 20, borderRadius: 10 }} />
        <T f="bold" s={14}>{`Pay with SKR · ${Math.round(SKR_BONUS * 100)}% bonus`}</T>
      </Pressable>
      {open ? <TopUpFlow open onClose={() => setOpen(false)} coin="SKR" usd={skrTopUpUsd(usd, wallet?.balance ?? null)} /> : null}
    </View>
  );
}
