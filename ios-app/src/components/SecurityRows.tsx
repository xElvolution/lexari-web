/** Port of webapp/components/lock/LockSettings.tsx: turn the app lock on, change the PIN or turn it off (server PIN). */
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./Icon";
import { PinPad } from "./PinPad";
import { Btn, F, WToggle, useC } from "@/web/kit";
import { usePrefs } from "@/state/prefs";
import { useSession } from "@/state/session";
import { useData } from "@/web/data";
import { bioInfo, bioUnlock, type Bio } from "@/lib/bio";
import { markUnlocked, removePin, savePin } from "@/lib/lock";

type Step = null | { mode: "set" | "change" | "off"; stage: "current" | "new" | "repeat"; current?: string; first?: string };

const SmallBtn = ({ label, onPress, brand }: { label: string; onPress: () => void; brand?: boolean }) => <Btn h={40} kind={brand ? "brand" : "line"} label={label} onPress={onPress} />;

export function SecurityRows() {
  const k = useC();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const { me, reload } = useData();
  const { lockOn: cached, setLock, bioOn, setBio } = usePrefs();
  const on = me ? !!me.lockOn : cached;
  const [step, setStep] = useState<Step>(null);
  const [err, setErrText] = useState("");
  const [errKey, setErrKey] = useState(0);
  const setErr = (m: string) => { setErrText(m); if (m) setErrKey((n) => n + 1); };
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [bio, setBioInfo] = useState<Bio | null>(null);
  useEffect(() => { bioInfo().then(setBioInfo).catch(() => {}); }, []);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(""), 2600); return () => clearTimeout(t); }, [note]);

  const setOn = (v: boolean) => { setLock(v); void reload(); };
  const close = () => { setStep(null); setErr(""); };
  const done = async (pin: string) => {
    if (!step || !token) return;
    setErr("");
    if (step.stage === "current") {
      if (step.mode === "off") {
        setBusy(true);
        try { await removePin(pin, token); setOn(false); setBio(false); close(); setNote("App lock is off"); }
        catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
        return;
      }
      setStep({ ...step, stage: "new", current: pin }); return;
    }
    if (step.stage === "new") { setStep({ ...step, stage: "repeat", first: pin }); return; }
    if (pin !== step.first) { setErr("Those didn't match. Start again."); setStep({ ...step, stage: "new", first: undefined }); return; }
    setBusy(true);
    try {
      await savePin(pin, token, step.current);
      setOn(true); markUnlocked(); close(); setNote(step.mode === "set" ? "App lock is on" : "PIN changed");
    } catch (e) { setErr((e as Error).message); setStep({ mode: step.mode, stage: step.mode === "change" ? "current" : "new" }); }
    finally { setBusy(false); }
  };
  const title = !step ? "" : step.stage === "current" ? "Enter your current PIN" : step.stage === "new" ? "Choose a 4-digit PIN" : "Enter it again";
  const toggleBio = async (v: boolean) => {
    if (v && !(await bioUnlock(`Turn on ${bio?.label || "biometrics"}`))) return;
    setBio(v);
  };

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={17} color={k.brandInk} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontFamily: F.semi, fontSize: 14.5, lineHeight: 21.75, color: k.ink }}>App lock {on ? "· on" : "· off"}</Text>
          <Text style={{ fontFamily: F.reg, fontSize: 13, lineHeight: 19.5, color: k.ink60 }}>{on ? "Lexari asks for your PIN when you open it and after 5 minutes away. It's also needed to view card details." : "Ask for a PIN when Lexari opens on this phone."}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 }}>
        {!on ? <SmallBtn brand label="Set a PIN" onPress={() => setStep({ mode: "set", stage: "new" })} /> : <>
          <SmallBtn label="Change PIN" onPress={() => setStep({ mode: "change", stage: "current" })} />
          <SmallBtn label="Turn off" onPress={() => setStep({ mode: "off", stage: "current" })} />
        </>}
      </View>
      {on && bio?.ok ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="finger" size={17} color={k.brandInk} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: F.semi, fontSize: 15, color: k.ink }}>{bio.label}</Text>
            <Text style={{ fontFamily: F.reg, fontSize: 13, lineHeight: 19.5, color: k.ink60 }}>Open Lexari with {bio.label} on this phone. Your PIN still works.</Text>
          </View>
          <WToggle on={bioOn} onChange={(v) => void toggleBio(v)} label={`Unlock with ${bio?.label || "biometrics"}`} />
        </View>
      ) : null}
      {note ? <View style={{ alignSelf: "flex-start", borderRadius: 14, backgroundColor: k.ink, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8 }}><Text style={{ fontFamily: F.semi, fontSize: 12.5, color: k.bg }}>{note}</Text></View> : null}
      <Modal transparent visible={!!step} animationType="fade" onRequestClose={() => { if (!busy) close(); }}>
        <Pressable onPress={() => { if (!busy) close(); }} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end", alignItems: "center" }}>
          <Pressable onPress={() => {}} accessibilityRole="none" style={{ width: "100%", maxWidth: 400, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: k.card, borderWidth: 1, borderColor: k.line, padding: 24, paddingBottom: 24 + insets.bottom }}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <Pressable accessibilityLabel="Close" onPress={close} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={18} color={k.ink75} /></Pressable>
            </View>
            {step ? <PinPad key={`${step.mode}-${step.stage}`} title={title} sub={step.stage === "new" ? "You'll use it to open Lexari and to view card details." : undefined} error={err} errorKey={errKey} busy={busy} onDone={(p) => void done(p)} /> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
