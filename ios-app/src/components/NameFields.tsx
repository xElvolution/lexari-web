/** webapp/components/NameFields + NameGate: full name, @username and what your agents call you. */
import { useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { api } from "@/lib/api";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { Btn, F, WSheet, useC } from "@/web/kit";

export type NameDraft = { fullName: string; username: string; callName: string };
export const USERNAME_OK = /^[a-z0-9_.]{3,20}$/;
const cleanUser = (v: string) => v.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "").slice(0, 20);
export const suggestUsername = (full: string) => cleanUser(full.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ""));
export const firstOf = (full: string) => full.trim().split(/\s+/)[0] || "";
export const namesValid = (d: NameDraft) => d.fullName.trim().length >= 2 && !d.fullName.includes("@") && USERNAME_OK.test(d.username) && !d.callName.includes("@");
/** Saves names to the profile (PATCH /api/me). Throws the server's message, e.g. "That username is taken." */
export async function saveNames(token: string, d: NameDraft) {
  await api("/api/me", { method: "PATCH", body: JSON.stringify({ names: { fullName: d.fullName.trim(), username: d.username, callName: (d.callName.trim() || firstOf(d.fullName)).slice(0, 30) } }) }, token);
}
type MeNames = { user?: { fullName?: string; username?: string; callName?: string; needsName?: boolean }; profile?: { name?: string; username?: string } };
/** A starting draft from what the account already has (never an email). */
export const draftFrom = (me: MeNames | null | undefined): NameDraft => {
  const full = me?.user?.fullName || (me?.profile?.name && !me.profile.name.includes("@") && me.profile.name !== "You" ? me.profile.name : "");
  return { fullName: full, username: me?.user?.username || me?.profile?.username || "", callName: me?.user?.callName || "" };
};

export default function NameFields({ value, onChange, error }: { value: NameDraft; onChange: (d: NameDraft) => void; error?: string }) {
  const k = useC();
  const [ownUser, setOwnUser] = useState(!!value.username);
  const small = (t: string) => <Text style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: k.dark ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.7)" }}>{t}</Text>;
  const hint = (t: string, bad = false) => <Text style={{ marginTop: 6, fontFamily: F.sans, fontSize: 12.5, color: bad ? "#e5484d" : k.ink45 }}>{t}</Text>;
  const field = { marginTop: 8, borderRadius: 14, borderWidth: 2, borderColor: k.line, backgroundColor: k.card, color: k.ink, paddingVertical: 10.4, paddingHorizontal: 14.4, fontSize: 16, fontFamily: F.semi, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null) };
  const badUser = value.username.length > 0 && !USERNAME_OK.test(value.username);
  return (
    <View style={{ gap: 16 }}>
      <View>{small("Full name")}
        <TextInput value={value.fullName} autoComplete="name" textContentType="name" placeholder="Ada Lovelace" placeholderTextColor={k.ink45} accessibilityLabel="Full name" style={field}
          onChangeText={(t) => { const fullName = t.slice(0, 60); onChange({ ...value, fullName, ...(ownUser ? {} : { username: suggestUsername(fullName) }) }); }} />
      </View>
      <View>{small("Username")}
        <View>
          <Text style={{ position: "absolute", left: 16, top: 8 + 13, zIndex: 1, fontFamily: F.semi, fontSize: 16, color: k.ink45 }}>@</Text>
          <TextInput value={value.username} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" placeholder="adalovelace" placeholderTextColor={k.ink45} accessibilityLabel="Username" style={[field, { paddingLeft: 34 }, badUser && { borderColor: "#e5484d" }]}
            onChangeText={(t) => { setOwnUser(true); onChange({ ...value, username: cleanUser(t) }); }} />
        </View>
        {hint("3 to 20 letters, numbers, dots or underscores.", badUser)}
      </View>
      <View>{small("What your agents call you")}
        <TextInput value={value.callName} placeholder={firstOf(value.fullName) || "Ada"} placeholderTextColor={k.ink45} accessibilityLabel="What your agents call you" style={field}
          onChangeText={(t) => onChange({ ...value, callName: t.replace(/@/g, "").slice(0, 30) })} />
        {hint("Leave it empty to use your first name. Agents never use your email.")}
      </View>
      {!!error && <Text accessibilityRole="alert" style={{ fontFamily: F.semi, fontSize: 13.5, color: "#e5484d" }}>{error}</Text>}
    </View>
  );
}

/** Accounts made before names were asked for: one sheet each time the app opens, until a full name and username are saved. */
export function NameGate() {
  const { token } = useSession();
  const { me, reload } = useData();
  const m = me as unknown as MeNames | null;
  const need = !!token && !!m?.user?.needsName && !!(me?.agents ?? []).some((a) => a.slug === "home");
  const [d, setD] = useState<NameDraft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(false); // closed for now: it asks again next time the app opens
  if (!need || later) return null;
  const draft = d ?? draftFrom(m);
  const save = async () => {
    if (!token || busy || !namesValid(draft)) return;
    setBusy(true); setErr("");
    try { await saveNames(token, draft); await reload(); } catch (e) { setErr(e instanceof Error && e.message ? e.message : "Couldn't save. Try again."); } finally { setBusy(false); }
  };
  return (
    <WSheet open title="What should we call you?" sub="Your agents use this name, never your email. Your username is how friends find you." onClose={() => setLater(true)}
      footer={<Btn label={busy ? "Saving…" : "Save"} full disabled={busy || !namesValid(draft)} onPress={() => void save()} />}>
      <View style={{ paddingBottom: 12 }}><NameFields value={draft} onChange={setD} error={err} /></View>
    </WSheet>
  );
}
