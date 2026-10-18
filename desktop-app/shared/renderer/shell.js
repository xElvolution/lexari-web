const ICONS = {
  agents: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 3 5 3 3 0 0 0 5 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-3 5 3 3 0 0 1-5 1"/>',
  marketplace: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
  team: '<circle cx="8" cy="9" r="3"/><circle cx="17" cy="9" r="3"/><path d="M2 20c.6-3 3-5 6-5s5.4 2 6 5M14 15c3 0 5.4 2 6 5"/>',
  hub: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="3" r="1.5"/><circle cx="20" cy="17" r="1.5"/><circle cx="4" cy="17" r="1.5"/><path d="M12 4.5V9M18.7 16.2l-4.1-2.5M5.3 16.2l4.1-2.5"/>',
  wallets: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2M6 6l9-3 2 3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  profile: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.3-2 3.2-3 5.5-3s4.2 1 5.5 3"/>',
};
const LABEL = { agents: "Agents", chat: "Chat", brain: "Brain", marketplace: "Marketplace", team: "Team", hub: "Hub", wallets: "Wallets", settings: "Settings", profile: "Profile" };
const $ = (id) => document.getElementById(id);
const view = $("view"), rail = $("rail"), pill = $("pill");
let cfg, current = "agents", firstLoad = true;

(async () => {
  cfg = await window.lexari.config();
  document.body.classList.add(cfg.platform);
  $("net").textContent = cfg.network.label;
  $("kbd").textContent = cfg.platform === "darwin" ? "\u2318 K" : "Ctrl K";
  const top = ["agents", "chat", "brain", "marketplace", "team", "hub", "wallets"], bottom = ["settings", "profile"];
  const mk = (r) => { const b = document.createElement("button"); b.dataset.r = r; b.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[r]}</svg><span class="tip">${LABEL[r]}</span>`; b.onclick = () => go(r); rail.appendChild(b); };
  top.forEach(mk); const g = document.createElement("div"); g.className = "gap"; rail.appendChild(g); bottom.forEach(mk);
  view.src = cfg.network.appUrl + "/agents";
  markRail("agents");
  window.lexari.onNavigate((u) => { view.src = u; });
  window.lexari.onMax(() => {});
})();

function routeUrl(r) { return cfg.network.appUrl + "/" + (r === "chat" ? "agents" : r); }
function go(r) { current = r; markRail(r); if (!navigator.onLine) return showOffline(); view.loadURL(routeUrl(r)).catch(() => {}); }
function markRail(r) {
  current = r; $("crumb").textContent = LABEL[r] || "";
  const b = rail.querySelector(`[data-r="${r}"]`);
  rail.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  if (b) { pill.style.opacity = 1; pill.style.top = b.offsetTop + "px"; } else pill.style.opacity = 0;
}

view.addEventListener("did-start-loading", () => { const l = $("loadbar"); l.className = "loadbar"; void l.offsetWidth; l.classList.add("go"); });
view.addEventListener("did-stop-loading", () => { $("loadbar").className = "loadbar done"; });
view.addEventListener("dom-ready", () => {
  view.classList.add("ready"); $("offline").classList.add("hidden");
  if (firstLoad) { firstLoad = false; setTimeout(() => $("splash").classList.add("hidden"), 450); }
  // Light desktop touch: let the web app know it runs inside the desktop shell.
  view.insertCSS("html{scrollbar-gutter:stable}::-webkit-scrollbar{width:10px}::-webkit-scrollbar-thumb{background:rgba(143,107,255,.35);border-radius:10px}");
});
view.addEventListener("did-navigate-in-page", syncRoute);
view.addEventListener("did-navigate", syncRoute);
function syncRoute(e) { try { const p = new URL(e.url).pathname.split("/")[1]; if (LABEL[p]) markRail(p); } catch {} }
view.addEventListener("did-fail-load", (e) => {
  if (!e.isMainFrame || e.errorCode === -3) return;
  showOffline(navigator.onLine ? ["Lexari can't be reached", `The server didn't answer (${e.errorDescription}). Your agents are safe. Try again in a moment.`] : null);
});
function showOffline(msg) {
  $("splash").classList.add("hidden");
  $("offTitle").textContent = msg ? msg[0] : "You're offline";
  $("offBody").textContent = msg ? msg[1] : "Lexari needs a connection to reach your agents. We'll reconnect as soon as you're back.";
  $("offline").classList.remove("hidden"); view.classList.remove("ready");
}
$("retry").onclick = () => go(current);
$("browser").onclick = () => window.lexari.external(routeUrl(current));
window.addEventListener("online", () => go(current));
window.addEventListener("offline", () => showOffline());
document.querySelectorAll(".winbtns button").forEach((b) => (b.onclick = () => window.lexari.win(b.dataset.a)));
$("titlebar").addEventListener("dblclick", (e) => { if (e.target.closest("button")) return; window.lexari.win("max"); });

// Command palette
const items = () => [
  ...Object.keys(LABEL).map((r) => ({ t: "Go to " + LABEL[r], i: ICONS[r], run: () => go(r) })),
  { t: "Sign in with the system browser (Google, passkeys)", i: ICONS.profile, run: () => window.lexari.signInBrowser() },
  { t: "Reload", i: ICONS.hub, run: () => view.reload() },
  { t: "Open this page in your browser", i: ICONS.marketplace, run: () => window.lexari.external(view.getURL()) },
];
let sel = 0, shown = [];
function render(q) {
  shown = items().filter((x) => x.t.toLowerCase().includes(q.toLowerCase())); sel = Math.min(sel, Math.max(0, shown.length - 1));
  $("plist").innerHTML = shown.map((x, k) => `<li class="${k === sel ? "sel" : ""}" data-k="${k}"><svg viewBox="0 0 24 24">${x.i}</svg>${x.t}</li>`).join("");
  $("plist").querySelectorAll("li").forEach((li) => (li.onclick = () => { shown[li.dataset.k].run(); closeP(); }));
}
function openP() { $("palette").classList.remove("hidden"); $("pq").value = ""; sel = 0; render(""); setTimeout(() => $("pq").focus(), 30); }
function closeP() { $("palette").classList.add("hidden"); }
$("openPalette").onclick = openP;
$("palette").onclick = (e) => { if (e.target.id === "palette") closeP(); };
$("pq").oninput = (e) => { sel = 0; render(e.target.value); };
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("palette").classList.contains("hidden") ? openP() : closeP(); }
  if ($("palette").classList.contains("hidden")) return;
  if (e.key === "Escape") closeP();
  if (e.key === "ArrowDown") { sel = (sel + 1) % shown.length; render($("pq").value); }
  if (e.key === "ArrowUp") { sel = (sel - 1 + shown.length) % shown.length; render($("pq").value); }
  if (e.key === "Enter" && shown[sel]) { shown[sel].run(); closeP(); }
});
