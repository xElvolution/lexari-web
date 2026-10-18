/**
 * The memory notes inside a Brain area panel (webapp/components/brain/Brain.tsx NoteRow + the teach form):
 * read your sealed notes with the memory key kept on this phone, edit or forget them, and teach a new one.
 * Notes are sealed and opened on the phone (src/lib/vaultCore.ts); the server only stores ciphertext.
 */
import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
import { memoryKeys } from "@/lib/onboard";
import { openNote, savedKeys, sealNote } from "@/lib/vault";
import type { Keys } from "@/lib/vaultCore";
import { useData } from "@/web/data";
import { F, GRAPE, Label, T, useC } from "@/web/kit";
import { useSession } from "@/state/session";

type Raw = { id: string; agent?: string; tag?: string; source?: string; at: number; ciphertext?: string; iv?: string; chainHash?: string | null; onchainPda?: string | null };

/** webapp/components/ui.tsx ago() */
export function ago(ms: number, now: number) {
  const d = Math.max(0, now - ms), m = Math.round(d / 6e4);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); return days === 1 ? "yesterday" : `${days} days ago`;
}

/** The memory key on this phone, if it has one (never prompts). */
export function useMemoryKeys() {
  const { me } = useData();
  const { wallet } = useSession();
  const w = me?.user.wallet || wallet || undefined;
  const [keys, setKeys] = useState<Keys | null>(null);
  useEffect(() => { let on = true; savedKeys(w).then((k) => { if (on) setKeys(k); }).catch(() => {}); return () => { on = false; }; }, [w]);
  return { keys, setKeys, wallet: w };
}

export default function BrainNotes({ notes, tag, whoName }: { notes: Raw[]; tag: string; whoName: string }) {
  const k = useC();
  const { token } = useSession();
  const { reload } = useData();
  const { keys, setKeys, wallet } = useMemoryKeys();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  const opened = useMemo(() => {
    const m = new Map<string, string>();
    if (keys) for (const n of notes) { if (n.ciphertext && n.iv) { try { m.set(n.id, openNote(keys, n.ciphertext, n.iv)); } catch { /* sealed with another key */ } } }
    return m;
  }, [keys, notes]);
  const locked = notes.some((n) => !opened.has(n.id));
  const now = Date.now();

  const getKeys = async () => {
    if (keys) return keys;
    try { const got = await memoryKeys(wallet); if (got) setKeys(got); return got; } catch (e) { setMsg((e as Error).message || "Could not open your memories."); return null; }
  };
  const unlock = async () => { setBusy("unlock"); const got = await getKeys(); setBusy(""); if (!got) setMsg("Open the wallet you signed in with to read your memories, or read them on the web."); };
  const save = async () => {
    if (!edit || !token) return;
    const text = edit.text.trim(); const n = notes.find((x) => x.id === edit.id);
    if (!text || !n || text === opened.get(n.id)) { setEdit(null); return; }
    const kk = await getKeys(); if (!kk) { setMsg("This phone does not have your memory key yet."); return; }
    setBusy(n.id);
    try { await api(`/api/memories/${n.id}`, { method: "PATCH", body: JSON.stringify({ tag, ...sealNote(kk, text) }) }, token); setEdit(null); setMsg("Memory updated"); await reload(); }
    catch (e) { setMsg((e as Error).message || "Could not save that."); }
    setBusy("");
  };
  const forget = async (n: Raw) => {
    if (!token || busy) return;
    if (n.chainHash || n.onchainPda) { setMsg("This memory is recorded on Solana. Delete it on the web with the wallet that owns it."); return; }
    setBusy(n.id);
    try { await api(`/api/memories/${n.id}`, { method: "DELETE" }, token); setMsg("Forgotten"); await reload(); }
    catch (e) { setMsg((e as Error).message || "Could not forget that."); }
    setBusy("");
  };

  return (
    <View style={{ gap: 8 }}>
      {locked && notes.length ? (
        <Pressable onPress={() => void unlock()} disabled={busy === "unlock"} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 16, backgroundColor: k.tint, paddingHorizontal: 14, paddingVertical: 10 }}>
          <T s={13} c={k.ink75}>These are encrypted on this device.</T><T f="bold" s={13} c={k.brandInk}>{busy === "unlock" ? "Opening…" : "Open"}</T>
        </Pressable>
      ) : null}
      {notes.length ? notes.map((n) => {
        const text = opened.get(n.id);
        return (
          <View key={n.id} style={{ borderRadius: 16, backgroundColor: k.alt, borderWidth: 1, borderColor: k.line, padding: 14, opacity: busy === n.id ? 0.5 : 1 }}>
            {edit?.id === n.id ? (
              <View>
                <TextInput autoFocus value={edit.text} onChangeText={(t) => setEdit({ id: n.id, text: t })} multiline maxLength={120} accessibilityLabel="Edit memory" onSubmitEditing={() => void save()}
                  style={{ minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: k.line, backgroundColor: k.card, padding: 10, fontFamily: F.sans, fontSize: 15, color: k.ink, textAlignVertical: "top" }} />
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => setEdit(null)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><T f="bold" s={13} c={k.ink75}>Cancel</T></Pressable>
                  <Pressable onPress={() => void save()} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: GRAPE }}><T f="bold" s={13} c="#fff">Save</T></Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  {text ? <T f="semi" s={15} style={{ lineHeight: 20 }}>{text}</T> : <T f="semi" s={15} c={k.ink45} style={{ lineHeight: 20 }}>Encrypted. Open your memories to read it.</T>}
                  <Label s={9} c={k.ink60} style={{ marginTop: 6 }}>{`${n.source ?? "You"} · ${ago(n.at, now)}${n.chainHash ? " · on Solana" : ""}`}</Label>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {text ? <Pressable accessibilityLabel="Edit memory" onPress={() => setEdit({ id: n.id, text })} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={15} color={k.ink75} /></Pressable> : null}
                  <Pressable accessibilityLabel="Forget memory" disabled={!!busy} onPress={() => void forget(n)} style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", opacity: busy ? 0.4 : 1 }}><Icon name="trash" size={15} color={k.ink75} /></Pressable>
                </View>
              </View>
            )}
          </View>
        );
      }) : <View style={{ borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: k.line, padding: 20 }}><T s={14} c={k.ink75} style={{ textAlign: "center" }}>{`Nothing here yet. Teach ${whoName} something below.`}</T></View>}
      {msg ? <T s={13} c={k.ink75} style={{ textAlign: "center" }}>{msg}</T> : null}
    </View>
  );
}

/** The teach form under an editable area: seal the note on the phone and file it under this area. */
export function TeachBar({ tag, who, whoName }: { tag: string; who: string; whoName: string }) {
  const k = useC();
  const { token } = useSession();
  const { reload } = useData();
  const { keys, setKeys, wallet } = useMemoryKeys();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const teach = async () => {
    const t = draft.trim(); if (!t || !token || busy) return;
    setBusy(true); setMsg("");
    try {
      let kk = keys;
      if (!kk) { kk = await memoryKeys(wallet); if (kk) setKeys(kk); }
      if (!kk) { setMsg("This phone does not have your memory key yet. Sign in again to add memories here."); return; }
      await api("/api/memories", { method: "POST", body: JSON.stringify({ agentSlug: who, tag, source: "You", ...sealNote(kk, t) }) }, token);
      setDraft(""); await reload();
    } catch (e) { setMsg((e as Error).message || "Could not save that."); }
    finally { setBusy(false); }
  };
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: k.line, padding: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={draft} onChangeText={setDraft} placeholder={tag === "About you" ? `Tell ${whoName} about you` : `Add to ${tag.toLowerCase()}`} placeholderTextColor={k.ink45} accessibilityLabel="New memory" maxLength={120} returnKeyType="done" onSubmitEditing={() => void teach()}
          style={{ flex: 1, height: 44, borderRadius: 999, borderWidth: 1, borderColor: k.line, backgroundColor: k.alt, paddingHorizontal: 16, fontFamily: F.sans, fontSize: 15, color: k.ink }} />
        <Pressable accessibilityLabel="Remember this" disabled={!draft.trim() || busy} onPress={() => void teach()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center", opacity: !draft.trim() || busy ? 0.4 : 1 }}>
          <Icon name="plus" size={18} color="#fff" />
        </Pressable>
      </View>
      {msg ? <T s={13} c={k.ink75} style={{ marginTop: 8 }}>{msg}</T> : null}
    </View>
  );
}
