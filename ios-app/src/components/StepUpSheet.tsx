/**
 * Port of webapp/components/security/StepUpSheet.tsx and PhraseBadge.tsx. "Confirm it's you": shown before high-risk
 * actions (big or first-time sends, new API keys, raising budgets and limits, changing where mail goes). Your
 * anti-phishing phrase is on it, so a fake screen can't pass for it. PIN when you have one, otherwise a wallet
 * signature (the Privy embedded wallet for Google or email accounts, your mobile wallet otherwise). Good for 5 minutes.
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Icon from "./Icon";
import { PinPad } from "./PinPad";
import { api, setStepUpHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { usePrivySigner } from "@/lib/privyMethods";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { Btn, F, GRAPE, WSheet, useC } from "@/web/kit";

type Info = { method: "pin" | "wallet"; phrase: string; session: string; until: number };
type Ask = { what: string; done: (ok: boolean) => void };
type Signer = (message: string) => Promise<string>;

/** Your anti-phishing phrase on sensitive sheets. If it's missing or wrong, it isn't the real Lexari. */
export function PhraseBadge({ phrase, loading = false }: { phrase?: string; loading?: boolean }) {
  const k = useC();
  if (loading) return <View style={{ height: 52, borderRadius: 16, backgroundColor: k.tint }} />;
  if (!phrase) return (
    <View testID="phrase-badge-none" style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 16, backgroundColor: k.tint, padding: 12 }}>
      <View style={{ marginTop: 2 }}><Icon name="info" size={16} color={k.ink60} /></View>
      <Text style={{ flex: 1, fontFamily: F.reg, fontSize: 12.5, lineHeight: 17.2, color: k.ink60 }}>Add a security phrase in <Text style={{ fontFamily: F.semi, color: k.ink, textDecorationLine: "underline" }}>Settings &gt; Security</Text>. It shows here so you can tell a real Lexari screen from a fake one.</Text>
    </View>
  );
  return (
    <View testID="phrase-badge" style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, backgroundColor: "rgba(91,43,255,0.10)", borderWidth: 1, borderColor: "rgba(91,43,255,0.30)", padding: 12 }}>
      <Icon name="verified" size={16} color={GRAPE} />
      <Text style={{ flex: 1, minWidth: 0, fontFamily: F.reg, fontSize: 12.5, lineHeight: 17.2, color: k.ink75 }}>Your security phrase: <Text style={{ fontFamily: F.bold, color: k.ink }}>{phrase}</Text></Text>
    </View>
  );
}

/** Hands the Privy signer up without calling Privy hooks when Privy isn't configured. */
function PrivyBridge({ into }: { into: { current: Signer | null } }) {
  const sign = usePrivySigner();
  into.current = sign;
  return null;
}

export default function StepUpSheet() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const privy = useRef<Signer | null>(null);
  useEffect(() => {
    let queue: Promise<boolean> = Promise.resolve(true);
    setStepUpHandler((what) => (queue = queue.then(() => new Promise<boolean>((done) => setAsk({ what, done })))));
    return () => setStepUpHandler(null);
  }, []);
  const finish = (ok: boolean) => { ask?.done(ok); setAsk(null); };
  return (
    <>
      {env.privyOn ? <PrivyBridge into={privy} /> : null}
      {ask ? <Body key={ask.what} what={ask.what} privy={privy} onDone={finish} /> : null}
    </>
  );
}

function Body({ what, privy, onDone }: { what: string; privy: { current: Signer | null }; onDone: (ok: boolean) => void }) {
  const k = useC();
  const { token, wallet } = useSession();
  const { me } = useData();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");
  const [errKey, setErrKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const fail = (m: string) => { setErr(m); setErrKey((n) => n + 1); };
  useEffect(() => { api<Info>("/api/security/stepup", {}, token).then(setInfo, (e) => fail((e as Error).message || "Couldn't load this. Try again.")); }, [token]);
  const send = async (body: Record<string, string>) => {
    setBusy(true); setErr("");
    try { await api("/api/security/stepup", { method: "POST", body: JSON.stringify(body) }, token, true); onDone(true); }
    catch (e) { fail((e as Error).message || "That didn't work. Try again."); }
    finally { setBusy(false); }
  };
  const viaWallet = async () => {
    if (!info) return;
    setBusy(true); setErr("");
    try {
      const message = `Lexari: confirm it's you\nSession: ${info.session}\nTime: ${Date.now()}`;
      let signature: string;
      if (me?.user.method === "google" || me?.user.method === "email") {
        if (!privy.current) throw new Error("Your wallet isn't ready on this device yet.");
        signature = await privy.current(message);
      } else {
        const addr = wallet || me?.user.wallet;
        if (!addr) throw new Error("Your wallet isn't ready on this device yet.");
        const { signMessage } = await import("@/lib/mwa");
        signature = await signMessage(addr, message);
      }
      setBusy(false);
      await send({ message, signature });
    } catch (e) { setBusy(false); const m = (e as Error).message || ""; fail(/reject|cancel|denied|declined/i.test(m) ? "You didn't confirm." : m || "Couldn't confirm."); }
  };
  const label = what.replace(/\.$/, "");
  return (
    <WSheet open title="Confirm it's you" sub={`To ${label}.`} icon="lock" onClose={() => { if (!busy) onDone(false); }}
      footer={info?.method === "wallet" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Btn h={44} kind="line" label="Cancel" onPress={() => onDone(false)} /></View>
          <View style={{ flex: 1 }}><Btn h={44} kind="brand" label={busy ? "Confirming…" : "Confirm with wallet"} onPress={() => { if (!busy) void viaWallet(); }} /></View>
        </View>
      ) : undefined}>
      <View testID="stepup" style={{ gap: 12, paddingBottom: 8 }}>
        <PhraseBadge phrase={info?.phrase} loading={!info && !err} />
        {!info && !err ? <View style={{ alignItems: "center", paddingVertical: 24 }}><ActivityIndicator color={k.brandInk} /></View> : null}
        {info?.method === "pin" ? <View style={{ paddingVertical: 8 }}><PinPad title="Enter your PIN" sub="Only you know it. Lexari never asks for it in chat." error={err} errorKey={errKey} busy={busy} onDone={(pin) => void send({ pin })} /></View> : null}
        {info?.method === "wallet" ? (
          <View style={{ borderRadius: 16, backgroundColor: k.tint, padding: 16 }}>
            <Text style={{ fontFamily: F.reg, fontSize: 13.5, lineHeight: 18.6, color: k.ink75 }}>Your wallet signs a short message. Nothing is sent and it costs nothing. <Text style={{ fontFamily: F.semi, color: k.ink }}>Tip:</Text> set an app PIN in Settings so this asks for your PIN instead.</Text>
          </View>
        ) : null}
        {err && info?.method !== "pin" ? <Text accessibilityRole="alert" style={{ fontFamily: F.semi, fontSize: 13, color: "#e5484d" }}>{err}</Text> : null}
        <Text style={{ fontFamily: F.reg, fontSize: 12, color: k.ink45 }}>This stays confirmed for 5 minutes on this device.</Text>
      </View>
    </WSheet>
  );
}
