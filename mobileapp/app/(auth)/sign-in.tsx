import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useLoginWithEmail, useLoginWithOAuth, useEmbeddedSolanaWallet, usePrivy } from "@privy-io/expo";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Screen, Title, Muted, ErrorText } from "@/components/ui";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { env } from "@/lib/env";
import { nonceFor, signInWithServer } from "@/lib/authFlow";
import { authorizeWallet, signMessage } from "@/lib/mwa";
import { setUserAgent } from "@/lib/api";
import { isSolanaMobile, userAgent } from "@/lib/device";
import { grape } from "@/theme/colors";
import { biometricGate } from "@/components/Gates";

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: grape, borderRadius: 14, paddingVertical: 12, alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function PrivyBlock({ onDone }: { onDone: (session: { token: string; expires: string; wallet?: string }) => void }) {
  const { palette } = usePrefs();
  const emailLogin = useLoginWithEmail();
  const oauth = useLoginWithOAuth();
  const privy = usePrivy();
  const solana = useEmbeddedSolanaWallet();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const finish = async () => {
    const wallet = solana.wallets?.[0];
    let provider = wallet ? await wallet.getProvider() : null;
    if (!provider && solana.create) provider = await solana.create();
    if (!provider) throw new Error("Privy did not create a Solana wallet.");
    const address = wallet?.address || provider._publicKey;
    if (!address) throw new Error("Privy did not create a Solana wallet.");
    const message = await nonceFor(address);
    const signed = await provider.request({ method: "signMessage", params: { message } });
    const token = await privy.getAccessToken();
    const session = await signInWithServer({ wallet: address, message, signature: signed.signature, privyToken: token || undefined, email: email || undefined });
    onDone(session);
    return session;
  };

  return (
    <View style={{ gap: 8 }}>
      <Btn label="Continue with Google" onPress={() => oauth.login({ provider: "google" }).then(() => finish()).catch((e: Error) => setErr(e.message))} />
      <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={palette.muted} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 12, color: palette.ink, padding: 10, fontSize: 14 }} />
      {sent ? <TextInput value={code} onChangeText={setCode} placeholder="Code" placeholderTextColor={palette.muted} style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 12, color: palette.ink, padding: 10, fontSize: 14 }} /> : null}
      <Btn label={sent ? "Verify email" : "Email me a code"} onPress={() => {
        setErr("");
        if (!sent) emailLogin.sendCode({ email }).then(() => setSent(true)).catch((e: Error) => setErr(e.message));
        else emailLogin.loginWithCode({ code, email }).then(() => finish()).catch((e: Error) => setErr(e.message));
      }} />
      {err ? <ErrorText text={err} /> : null}
    </View>
  );
}

export default function SignIn() {
  const { palette } = usePrefs();
  const { accept } = useSession();
  const [err, setErr] = useState("");
  const seeker = isSolanaMobile({ brand: Device.brand, manufacturer: Device.manufacturer, model: Device.modelName });
  const version = Constants.expoConfig?.version || "1.0.0";

  const withMwa = async () => {
    setErr("");
    setUserAgent(userAgent(version, Device.modelName || "Android"));
    const ok = await biometricGate("Confirm it's you");
    if (!ok) return;
    try {
      const wallet = await authorizeWallet();
      const message = await nonceFor(wallet.address);
      const signature = await signMessage(wallet.address, message);
      const session = await signInWithServer({ wallet: wallet.address, message, signature });
      await accept(session);
      router.replace("/(tabs)/hub");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  return (
    <Screen>
      <Title>Lexari</Title>
      <Muted>AI employees with a wallet. {seeker ? "Seed Vault is ready on this phone." : "Works with Phantom, Solflare, or an embedded wallet."}</Muted>
      <View style={{ height: 16 }} />
      <Btn label={seeker ? "Seed Vault" : "Wallet app"} onPress={withMwa} />
      <View style={{ height: 16 }} />
      {env.privyOn ? <PrivyBlock onDone={async (session) => { await accept(session); router.replace("/(tabs)/hub"); }} /> : <Text style={{ color: palette.muted, fontSize: 12 }}>Google and email turn on when EXPO_PUBLIC_PRIVY_APP_ID and the Android client id are set in the build.</Text>}
      {err ? <ErrorText text={err} /> : null}
    </Screen>
  );
}
