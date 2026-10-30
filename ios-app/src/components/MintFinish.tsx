/**
 * Port of webapp/components/agent/MintFinish.tsx: after making an agent, its ID card, the "Onchain ID card" panel
 * (webapp/components/agent/OnchainCard.tsx) and Later. The card drops in with back-ease, the copy rises in a stagger.
 * Minting (Metaplex Core + Arweave upload) runs in the web app with the same wallet, so the phone hands off there.
 */
import { Linking, Text, View } from "react-native";
import AgentIdCard, { type IdInfo } from "./AgentIdCard";
import Icon from "./Icon";
import { env } from "@/lib/env";
import { useData } from "@/web/data";
import { Btn, F, Rise, short, useC } from "@/web/kit";

type Nft = { tokenId?: string; tx?: string };
const isAsset = (id?: string) => !!id && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id);

export function OnchainCard({ id, name, prominent }: { id: string; name: string; prominent?: boolean }) {
  const k = useC();
  const { me, hub } = useData();
  const chain = env.cluster === "mainnet-beta" ? "Solana" : "Solana Devnet";
  const nft = (me?.agents.find((a) => a.slug === id)?.meta as { nft?: Nft } | undefined)?.nft;
  const rec = nft && isAsset(nft.tokenId) ? nft : undefined;
  const live = hub?.program ? hub.program.live : null;
  const status = live === null ? { tone: "muted", text: "Checking the Lexari program…" }
    : live === false ? { tone: "warn", text: `The Lexari program is not on ${chain} yet.` }
    : rec ? { tone: "ok", text: `Minted on ${chain}. Up to date.` }
    : { tone: "muted", text: `Minting uses a little SOL on ${chain}. You sign it with ${me?.user.wallet ? short(me.user.wallet) : "your wallet"} on lexari.ai.` };
  const explorer = (a: string) => `https://explorer.solana.com/address/${a}${env.cluster === "mainnet-beta" ? "" : "?cluster=devnet"}`;
  return (
    <View style={{ borderRadius: 22, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 12.8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 0.38, textTransform: "uppercase", color: k.ink45 }}>Onchain ID card</Text>
        <View style={{ borderRadius: 999, backgroundColor: k.tint, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontFamily: F.mono, fontSize: 8.5, letterSpacing: 0.34, textTransform: "uppercase", color: k.ink60 }}>{chain}</Text></View>
      </View>
      <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: k.ink75 }}>Mint this card as an NFT you own. The picture is stored on Arweave. Solana keeps the name, role and face recipe, and you can update them later.</Text>
      <View accessibilityRole="text" style={{ marginTop: 12, flexDirection: "row", gap: 8, borderRadius: 16, padding: 12, backgroundColor: status.tone === "ok" ? "rgba(31,157,85,0.12)" : status.tone === "warn" ? "rgba(245,165,36,0.15)" : k.tint }}>
        <View style={{ marginTop: 1 }}><Icon name={status.tone === "ok" ? "check" : "info"} size={16} color={status.tone === "muted" ? k.ink60 : k.ink} /></View>
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 13, lineHeight: 17, color: status.tone === "muted" ? k.ink60 : k.ink }}>{status.text}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
        {rec ? <Btn full kind="ghost" h={prominent ? 48 : 40} fs={prominent ? 15.5 : 13.5} icon="globe" label={`View card ${short(rec.tokenId)}`} onPress={() => void Linking.openURL(explorer(rec.tokenId!))} />
          : <Btn full kind="brand" h={prominent ? 48 : 40} fs={prominent ? 15.5 : 13.5} drop={prominent ? 5 : 0} icon="idcard" disabled={live !== true} label="Mint on chain" onPress={() => void Linking.openURL(`${env.apiUrl}/agents`)} />}
      </View>
      {!rec && live ? <Text style={{ marginTop: 8, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: k.ink45, textAlign: "center" }}>{`Opens ${name}'s card on lexari.ai to sign the mint.`}</Text> : null}
    </View>
  );
}

export default function MintFinish({ info, title, sub, later, laterLabel = "Later" }: { info: IdInfo; title: string; sub: string; later: () => void; laterLabel?: string }) {
  const k = useC();
  return (
    <View style={{ gap: 24, paddingBottom: 16 }}>
      <Rise y={-40} ms={800} back={1.5}><AgentIdCard info={info} /></Rise>
      <View style={{ gap: 16 }}>
        <Rise y={22} ms={550} back={0} delay={90}>
          <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: k.brandInk }}>{`Done · desk ${String(info.desk).padStart(2, "0")}`}</Text>
          <Text style={{ marginTop: 8, fontFamily: F.display, fontSize: 22, lineHeight: 22, letterSpacing: -1, color: k.ink }}>{title}</Text>
          <Text style={{ marginTop: 8, fontFamily: F.sans, fontSize: 14, lineHeight: 19, color: k.ink75 }}>{sub}</Text>
        </Rise>
        <Rise y={22} ms={550} back={0} delay={180}><OnchainCard id={info.id} name={info.name} prominent /></Rise>
        <Rise y={22} ms={550} back={0} delay={270}><Btn full kind="line" h={40} fs={13.5} label={laterLabel} iconRight="arrow" onPress={later} /></Rise>
      </View>
    </View>
  );
}
