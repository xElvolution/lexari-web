/**
 * Port of webapp/components/brain/Brain.tsx. The brain itself is the web's own three.js scene with its HTML area chips
 * (src/brain: a WebView on the phone, an iframe on web), so the sphere, rings, motion and labels match exactly.
 * Around it: the heading with agent switching, the hint pill, and the area panel.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, PanResponder, Pressable, ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import BrainStage from "@/brain/BrainStage";
import BrainNotes, { TeachBar } from "@/components/BrainNotes";
import Icon from "@/components/Icon";
import { ROSTER } from "@/content/roster";
import { AgentTile, GRAPE, Label, T, useC } from "@/web/kit";
import { useData } from "@/web/data";

const CATS = [
  { id: "About you", anchor: [0, 0.6, 0.72], dark: "#d9ccff", light: "#5b2bff" },
  { id: "Preferences", anchor: [-0.55, 0.22, 0.55], dark: "#a78bfa", light: "#6d28d9" },
  { id: "People", anchor: [0.64, -0.08, 0.12], dark: "#93c5fd", light: "#1d4ed8" },
  { id: "Tools", anchor: [-0.46, 0.62, -0.22], dark: "#818cf8", light: "#4338ca" },
  { id: "Habits", anchor: [0.05, 0.32, -0.96], dark: "#e9d5ff", light: "#7e22ce" },
  { id: "Files", anchor: [-0.64, -0.16, -0.08], dark: "#ffffff", light: "#0a0a0a" },
  { id: "Hired agents", anchor: [0, -0.46, -0.72], dark: "#c084fc", light: "#a21caf" },
  { id: "Skills", anchor: [0.52, 0.5, -0.42], dark: "#7dd3fc", light: "#0369a1" },
] as const;
const EDITABLE = new Set(["About you", "Preferences", "People", "Tools", "Habits"]);
const BLURB: Record<string, string> = {
  "About you": "Who you are and how you like to be addressed.", Preferences: "How you like work done and delivered.", People: "Who is on your team and what they own.",
  Tools: "The apps and formats you use.", Habits: "Your routines and deadlines.", Files: "Outputs your agent saved from finished jobs.",
  "Hired agents": "Specialists working in your seats.", Skills: "What this agent can do.",
};
/** webapp/content/appData.ts AGENT_SKILLS */
const SKILLS: Record<string, { label: string; desc: string }> = {
  web: { label: "Browse the web", desc: "Open pages, read and compare them." }, files: { label: "Read and write files", desc: "Work with docs and save results to Files." },
  code: { label: "Run code", desc: "Use the terminal on its computer." }, sheets: { label: "Spreadsheets", desc: "Clean, sum and chart tables." },
  images: { label: "Make images", desc: "Draft simple graphics and cards." }, email: { label: "Draft emails", desc: "Write emails for you to send." },
  calendar: { label: "Plans and reminders", desc: "Keep dates, steps and check ins." }, wallet: { label: "Use its wallet", desc: "Pay for tools inside a limit (demo)." },
};
export default function Brain() {
  const k = useC();
  const { me } = useData();
  const [focus, setFocus] = useState(-1);
  const list = (me?.agents ?? []).filter((a) => a.kind === "home" || a.kind === "custom");
  const [at, setAt] = useState(0);
  const who = list[at] ?? list[0];
  // swipe the heading sideways to switch agent, like the web
  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3,
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 40) stepRef.current(g.dx < 0 ? 1 : -1); },
  }), []);
  const step = (d: number) => { if (list.length < 2) return; setAt((at + d + list.length) % list.length); setFocus(-1); };
  const stepRef = useRef(step); stepRef.current = step;
  const [reduce, setReduce] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {}); }, []);
  const [failed, setFailed] = useState(false);
  const mem = (me?.memories ?? []).filter((m) => ((m as { agent?: string }).agent || "home") === (who?.slug ?? "home"));
  const hired = (me?.agents ?? []).filter((a) => a.kind === "hired");
  const skills = who?.slug === "home" ? (who.skills?.length ? who.skills : ["web", "files", "code", "calendar"]) : who?.skills ?? [];
  const fileList = (me?.jobs ?? []).map((j, i) => ({ j, i })).filter(({ j }) => j.status !== "running" && (j.assignee || "home") === (who?.slug ?? "home") && j.output).map(({ j, i }) => {
    const title = j.title || j.prompt.slice(0, 80);
    const name = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "output"}.md`;
    const body = `# ${title}\n\nAsked: ${j.prompt}\n\n${j.output}\n`;
    return { name, job: i + 1, size: `${Math.max(1, Math.round(body.length / 1024))} KB`, body };
  });
  const files = fileList.length;
  const count = (id: string) => (id === "Files" ? files : id === "Hired agents" ? hired.length : id === "Skills" ? skills.length : mem.filter((m) => (m as { tag?: string }).tag === id).length);
  const counts = CATS.map((c) => count(c.id));
  // a new memory anywhere in the app fires a write into its region (web: scene.write)
  const seen = useRef<Set<string> | null>(null);
  const [write, setWrite] = useState<{ cat: number; n: number } | null>(null);
  useEffect(() => {
    const all = me?.memories ?? []; const ids = new Set(all.map((m) => String((m as { id: string }).id)));
    if (seen.current) { const fresh = all.find((m) => !seen.current!.has(String((m as { id: string }).id))); const i = fresh ? CATS.findIndex((c) => c.id === (fresh as { tag?: string }).tag) : -1; if (i >= 0) setWrite((w) => ({ cat: i, n: (w?.n ?? 0) + 1 })); }
    seen.current = ids;
  }, [me?.memories]);
  const col = (i: number) => (k.dark ? CATS[i].dark : CATS[i].light);
  const name = who?.name ?? "Your agent";

  return (
    <View style={{ flex: 1, overflow: "hidden", backgroundColor: k.bg }}>
      {/* the web stage stops 9px above the tab bar (712 of 721 at 390x844); same box, so the brain sits at the same spot */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 9 }}>
        <BrainStage dark={k.dark} counts={counts} focus={focus} reduce={reduce} write={write} onOpen={(i) => setFocus(focus === i ? -1 : i)} onFailed={() => setFailed(true)} />
      </View>

      <View pointerEvents="box-none" style={{ position: "absolute", left: 20, right: 20, top: 20, zIndex: 10 }} {...swipe.panHandlers}>
        <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GRAPE }} /><Label s={11} style={{ lineHeight: 16.5, letterSpacing: 0.44 }}>Memory</Label></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "flex-start", maxWidth: "100%", paddingRight: 16 }}>
          {list.length > 1 ? <Pressable accessibilityLabel="Previous agent's brain" hitSlop={8} onPress={() => step(-1)} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}><Icon name="left" size={14} color={k.ink45} /></Pressable> : null}
          <T f="display" s={22} lines={1} style={{ letterSpacing: -0.99, lineHeight: 22, flexShrink: 1 }}>{`${name}'s brain`}</T>
          {list.length > 1 ? <Pressable accessibilityLabel="Next agent's brain" hitSlop={8} onPress={() => step(1)} style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}><Icon name="right" size={14} color={k.ink45} /></Pressable> : null}
        </View>
        <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8, paddingVertical: 4 }}>
          <T f="bold" s={14} style={{ lineHeight: 21 }}>{String(mem.length)}</T><T s={14} c={k.ink75} style={{ lineHeight: 21 }}>{`memories in ${CATS.length - 1} areas`}</T>
          {list.length > 1 ? <View style={{ flexDirection: "row", gap: 4 }} accessibilityLabel={`Agent ${at + 1} of ${list.length}. Swipe to switch.`}>{list.map((a, i) => <View key={a.slug} style={{ height: 6, width: i === at ? 16 : 6, borderRadius: 3, backgroundColor: i === at ? GRAPE : k.dark ? "rgba(255,255,255,0.25)" : "rgba(10,10,10,0.25)" }} />)}</View> : null}
        </View>
        {list.length > 1 ? <Label s={8.5} c={k.ink45} style={{ marginTop: 6 }}>Swipe to switch agent</Label> : null}
      </View>

      {failed ? <T s={15} c={k.ink75} style={{ position: "absolute", left: 20, right: 20, top: "50%", textAlign: "center" }}>Your phone could not draw the 3D brain. Tap an area below to open it.</T> : null}
      {failed ? (
        <View style={{ position: "absolute", left: 20, right: 20, top: "58%", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {CATS.map((c, i) => <Pressable key={c.id} onPress={() => setFocus(i)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: k.card, borderWidth: 1, borderColor: k.line }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col(i) }} /><Label s={11} c={k.ink}>{c.id}</Label><Label s={11} c={k.ink60}>{String(counts[i])}</Label></Pressable>)}
        </View>
      ) : null}

      {focus < 0 ? <View pointerEvents="none" style={{ position: "absolute", bottom: 25, alignSelf: "center", maxWidth: "92%", borderRadius: 999, backgroundColor: k.dark ? "rgba(19,16,31,0.85)" : "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: k.line, paddingHorizontal: 14, paddingVertical: 8, zIndex: 10 }}><Label s={11} c={k.ink75} style={{ lineHeight: 16.5, letterSpacing: 0.44, textAlign: "center" }}>Drag to turn · tap a label to open it</Label></View> : null}

      {focus >= 0 ? (() => { const c = CATS[focus]; const notes = mem.filter((m) => (m as { tag?: string }).tag === c.id); return (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 21, maxHeight: "62%", borderRadius: 26, backgroundColor: k.dark ? "rgba(19,16,31,0.95)" : "rgba(255,255,255,0.96)", borderWidth: 1, borderColor: k.line, zIndex: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, borderBottomWidth: 1, borderBottomColor: k.line, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 }}>
            <View style={{ marginTop: 6, width: 12, height: 12 }}><View style={{ position: "absolute", left: -4, top: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: k.tint }} /><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: col(focus) }} /></View>
            <View style={{ flex: 1 }}><T f="display" s={22} style={{ letterSpacing: -0.99, lineHeight: 21 }}>{c.id}</T><T s={14} c={k.ink75} style={{ marginTop: 6, lineHeight: 21 }}>{BLURB[c.id]}</T></View>
            <Pressable accessibilityLabel="Close" onPress={() => setFocus(-1)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: k.tint, alignItems: "center", justifyContent: "center" }}><Icon name="x" size={16} color={k.ink} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12.8, gap: 8 }}>
            {EDITABLE.has(c.id) ? <BrainNotes notes={notes as never} tag={c.id} whoName={name} /> : null}
            {c.id === "Files" && fileList.length ? fileList.map((f) => (
              <View key={`${f.job}-${f.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.alt, borderWidth: 1, borderColor: k.line, padding: 12 }}>
                <View style={{ width: 32, height: 36, borderRadius: 6, backgroundColor: GRAPE, alignItems: "center", justifyContent: "center" }}><T f="bold" s={9} c="#fff">MD</T></View>
                <View style={{ flex: 1 }}><T f="mono" s={13} lines={1}>{f.name}</T><Label s={9} c={k.ink60} style={{ marginTop: 4 }}>{`Job #${String(f.job).padStart(3, "0")} · ${f.size}`}</Label></View>
                <Pressable accessibilityLabel={`Download ${f.name}`} onPress={() => void Share.share({ title: f.name, message: f.body })} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><Icon name="download" size={15} color={k.ink75} /></Pressable>
              </View>
            )) : null}
            {c.id === "Files" && !fileList.length ? <View style={{ borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: k.line, padding: 20 }}><T s={14} c={k.ink75} style={{ textAlign: "center" }}>No files yet. Finished jobs save them here.</T></View> : null}
            {c.id === "Skills" && !skills.length ? <View style={{ borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: k.line, padding: 20 }}><T s={14} c={k.ink75} style={{ textAlign: "center" }}>{`${name} has no skills yet. Add them from its ID card.`}</T></View> : null}
            {c.id === "Skills" ? skills.map((s) => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.alt, borderWidth: 1, borderColor: k.line, padding: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: col(focus), alignItems: "center", justifyContent: "center" }}><Icon name="check" size={15} stroke={3} color="#fff" /></View>
                <View style={{ flex: 1 }}><T f="bold" s={16} style={{ lineHeight: 20 }}>{SKILLS[s]?.label ?? s}</T>{SKILLS[s]?.desc ? <T s={13} c={k.ink75} style={{ lineHeight: 17.9 }}>{SKILLS[s].desc}</T> : null}</View>
              </View>
            )) : null}
            {c.id === "Hired agents" ? (hired.length ? hired.map((h) => (
              <Pressable key={h.slug} onPress={() => router.push(`/marketplace/${h.slug}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: k.alt, borderWidth: 1, borderColor: k.line, padding: 10 }}>
                <AgentTile slug={h.slug} size={44} dot={false} />
                <View style={{ flex: 1 }}><T f="bold" s={15}>{h.name}</T><T s={13} c={k.ink75}>{ROSTER.find((r) => r.slug === h.slug)?.job ?? h.role ?? ""}</T></View>
                <Icon name="arrow" size={16} color={k.ink60} />
              </Pressable>
            )) : <View style={{ borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: k.line, padding: 20 }}><T s={14} c={k.ink75} style={{ textAlign: "center" }}>{"No one hired yet. "}<T f="bold" s={14} c={k.brandInk} onPress={() => router.push("/marketplace")}>Add an agent</T></T></View>) : null}
          </ScrollView>
          {EDITABLE.has(c.id) ? <TeachBar tag={c.id} who={who?.slug ?? "home"} whoName={name} /> : null}
        </View>
      ); })() : null}
    </View>
  );
}

export { default as ErrorBoundary } from "@/components/ScreenError";
