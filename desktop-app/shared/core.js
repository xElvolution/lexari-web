// Lexari desktop core: windows, tray, shortcut, deep links, notifications, updates, window state.
// Platform folders call start({ platform options }). No wallet custody logic lives here: wallets stay in the web app.
const { app, BrowserWindow, Tray, Menu, globalShortcut, Notification, shell, ipcMain, nativeImage, session, screen, net } = require("electron");
const path = require("path"), fs = require("fs");

const NET = require("./config/networks.json");
const PROTOCOL = "lexari";
const PARTITION = "persist:lexari";
const ROUTES = ["agents", "brain", "marketplace", "team", "hub", "wallets", "settings", "profile"];

function start(opts = {}) {
  const o = { shortcut: "CommandOrControl+Shift+L", windowExtras: {}, onReady: () => {}, trayIcon: "tray.png", ...opts };
  const statePath = () => path.join(app.getPath("userData"), "window-state.json");
  const prefsPath = () => path.join(app.getPath("userData"), "prefs.json");
  const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
  const prefs = readJson(prefsPath(), {});
  const netName = (process.env.LEXARI_NETWORK || prefs.network || NET.default);
  const network = { name: netName, ...(NET.networks[netName] || NET.networks.testnet) };
  let win, quick, tray, about, pendingDeepLink = null, lastNotif = 0;
  const ICON = path.join(__dirname, "assets", "icons", "256x256.png");
  const demo = process.env.LEXARI_DEMO || ""; // QA screenshots: splash | offline | error | quick | about | tray

  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  else app.setAsDefaultProtocolClient(PROTOCOL);

  function handleDeepLink(url) {
    if (!url || !url.startsWith(PROTOCOL + "://")) return;
    if (!win) { pendingDeepLink = url; return; }
    const u = new URL(url);
    // lexari://auth/callback?next=/agents  -> finish sign-in in the app session
    // lexari://open/agents/abc            -> open a route
    let target;
    if (u.host === "auth") {
      // lexari://auth/callback?code=...: trade the one-time code for a session cookie in the app session.
      const code = u.searchParams.get("code") || "";
      session.fromPartition(PARTITION).fetch(network.apiUrl + "/auth/desktop/exchange", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) })
        .then(async (r) => {
          if (r.ok) { win.webContents.send("lexari:navigate", network.appUrl + "/agents"); return; }
          const j = await r.json().catch(() => ({}));
          new Notification({ title: "Sign-in didn't finish", body: j.error || "Sign in again from the app.", icon: ICON }).show();
        })
        .catch(() => {});
      summon(); return;
    }
    if (u.host === "open") target = network.appUrl + (u.pathname || "/");
    if (target && target.startsWith(network.appUrl)) win.webContents.send("lexari:navigate", target);
    summon();
  }

  function summon() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

  function createMain() {
    const st = readJson(statePath(), { width: 1440, height: 900 });
    const visible = st.x === undefined || screen.getAllDisplays().some((d) => st.x >= d.bounds.x - 50 && st.x < d.bounds.x + d.bounds.width);
    win = new BrowserWindow({
      width: st.width, height: st.height, x: visible ? st.x : undefined, y: visible ? st.y : undefined,
      minWidth: 760, minHeight: 520, show: false, backgroundColor: "#0b0718", frame: false,
      icon: ICON,
      webPreferences: { preload: path.join(__dirname, "preload.js"), webviewTag: true, contextIsolation: true, sandbox: false },
      ...o.windowExtras,
    });
    if (st.maximized) win.maximize();
    const save = () => { if (!win || win.isDestroyed()) return; const b = win.getNormalBounds(); fs.writeFileSync(statePath(), JSON.stringify({ ...b, maximized: win.isMaximized() })); };
    ["resize", "move", "close"].forEach((e) => win.on(e, save));
    win.on("close", (e) => { if (!app.isQuitting && o.hideOnClose) { e.preventDefault(); win.hide(); } });
    win.once("ready-to-show", () => win.show());
    win.loadFile(path.join(__dirname, "renderer", "shell.html"), { query: { platform: process.platform, net: network.name, demo } });
    win.webContents.on("did-finish-load", () => { if (pendingDeepLink) { const d = pendingDeepLink; pendingDeepLink = null; handleDeepLink(d); } });
    win.on("maximize", () => win.webContents.send("lexari:max", true));
    win.on("unmaximize", () => win.webContents.send("lexari:max", false));
  }

  function createQuick() {
    quick = new BrowserWindow({
      width: 380, height: 520, icon: ICON, show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
      backgroundColor: "#120b26", webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true },
    });
    quick.loadFile(path.join(__dirname, "renderer", "quick.html"));
    quick.on("blur", () => { if (!demo) quick.hide(); });
  }

  function toggleQuick() {
    if (!quick) createQuick();
    if (quick.isVisible()) return quick.hide();
    const p = screen.getCursorScreenPoint(), wa = screen.getDisplayNearestPoint(p).workArea;
    const x = Math.min(Math.max(p.x - 190, wa.x + 8), wa.x + wa.width - 388);
    const y = process.platform === "darwin" ? wa.y + 6 : Math.max(wa.y + 8, wa.y + wa.height - 528);
    quick.setPosition(Math.round(x), Math.round(y)); quick.show(); quick.focus();
  }

  function trayMenu() { return tray && tray._menu; }
  function openAbout() {
    if (about && !about.isDestroyed()) return about.focus();
    about = new BrowserWindow({ width: 420, height: 480, resizable: false, minimizable: false, maximizable: false, frame: false, transparent: process.platform !== "linux",
      backgroundColor: process.platform === "linux" ? "#000000" : "#00000000", show: false, icon: ICON, title: "About Lexari", parent: win || undefined,
      webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true } });
    about.loadFile(path.join(__dirname, "renderer", "about.html"));
    about.once("ready-to-show", () => about.show());
  }

  function createTray() {
    // tray.png / tray@2x.png (colour) and trayTemplate.png / @2x (macOS menu bar); Electron picks the @2x on HiDPI.
    const img = nativeImage.createFromPath(path.join(__dirname, "assets", o.trayIcon));
    if (process.platform === "darwin") img.setTemplateImage(true);
    tray = new Tray(img);
    tray.setToolTip("Lexari");
    const menu = Menu.buildFromTemplate([
      { label: "Quick chat", click: toggleQuick },
      { label: "Open Lexari", click: summon },
      { type: "separator" },
      ...ROUTES.map((r) => ({ label: r[0].toUpperCase() + r.slice(1), click: () => { summon(); win.webContents.send("lexari:navigate", network.appUrl + "/" + r); } })),
      { type: "separator" },
      { label: "About Lexari", click: openAbout },
      { label: "Quit Lexari", click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu); tray._menu = menu;
    tray.on("click", toggleQuick);
  }

  // Native notifications: poll the same /api/notifications bell the web app uses.
  async function pollNotifications() {
    try {
      const res = await session.fromPartition(PARTITION).fetch(network.apiUrl + "/notifications", { headers: { accept: "application/json" } });
      if (!res.ok) return;
      const { items = [], unread = 0 } = await res.json();
      if (process.platform === "darwin") app.dock && app.dock.setBadge(unread ? String(unread) : "");
      else app.setBadgeCount && app.setBadgeCount(unread);
      const fresh = items.filter((i) => !i.read && i.at > lastNotif);
      if (lastNotif && Notification.isSupported()) fresh.slice(0, 3).forEach((i) => {
        const n = new Notification({ title: i.title || "Lexari", body: i.body || "", silent: false, icon: ICON });
        n.on("click", () => { summon(); if (i.url) win.webContents.send("lexari:navigate", new URL(i.url, network.appUrl).toString()); });
        n.show();
      });
      lastNotif = Math.max(lastNotif || Date.now(), ...items.map((i) => i.at || 0));
    } catch {}
  }

  function setupUpdates() {
    if (!app.isPackaged || process.env.LEXARI_NO_UPDATE) return;
    try {
      const { autoUpdater } = require("electron-updater");
      autoUpdater.autoDownload = true;
      autoUpdater.on("update-downloaded", (i) => new Notification({ title: "Lexari update ready", body: `Version ${i.version} installs when you restart.`, icon: ICON }).show());
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
      setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600e3);
    } catch {}
  }

  // API calls from the quick chat go through the app session in the main process (no CORS, same cookie as the web view).
  const api = (p, init) => session.fromPartition(PARTITION).fetch(network.apiUrl + p, init);
  ipcMain.handle("lexari:api", async (_e, p) => { if (!/^\/[a-z/-]+$/.test(p)) return { status: 400 }; try { const r = await api(p); return { status: r.status, json: await r.json().catch(() => null) }; } catch { return { status: 0 }; } });
  ipcMain.on("lexari:chat", async (e, reqId, body) => {
    const send = (ev) => { if (!e.sender.isDestroyed()) e.sender.send("lexari:chat-ev", reqId, ev); };
    try {
      const r = await api("/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); return send({ error: j.error || "Couldn't reach your agent.", end: true }); }
      const rd = r.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop();
        for (const p of parts) if (p.startsWith("data: ")) { try { send(JSON.parse(p.slice(6))); } catch {} } }
      send({ end: true });
    } catch { send({ error: "You're offline.", end: true }); }
  });
  ipcMain.handle("lexari:config", () => ({ network, routes: ROUTES, platform: process.platform, version: app.getVersion(), partition: PARTITION, shortcut: o.shortcut }));
  ipcMain.on("lexari:about", openAbout);
  ipcMain.on("lexari:win", (_e, a) => { if (!win) return; if (a === "min") win.minimize(); if (a === "max") win.isMaximized() ? win.unmaximize() : win.maximize(); if (a === "close") win.close(); });
  ipcMain.on("lexari:external", (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
  ipcMain.on("lexari:open-main", (_e, route) => { summon(); if (route) win.webContents.send("lexari:navigate", network.appUrl + route); if (quick) quick.hide(); });
  // System-browser sign-in (Google, and passkeys where the webview has no platform authenticator).
  ipcMain.on("lexari:signin-browser", () => shell.openExternal(network.appUrl + "/sign-in?desktop=1&return=" + encodeURIComponent(PROTOCOL + "://auth/callback")));
  ipcMain.handle("lexari:set-network", (_e, n) => { if (!NET.networks[n] || NET.networks[n].enabled === false) return false; fs.writeFileSync(prefsPath(), JSON.stringify({ ...prefs, network: n })); app.relaunch(); app.exit(0); });

  app.on("second-instance", (_e, argv) => { handleDeepLink(argv.find((a) => a.startsWith(PROTOCOL + "://"))); summon(); });
  app.on("open-url", (e, url) => { e.preventDefault(); handleDeepLink(url); });
  app.on("before-quit", () => { app.isQuitting = true; });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("activate", () => (win ? summon() : createMain()));
  app.on("web-contents-created", (_e, wc) => {
    // Links leaving Lexari open in the system browser, never inside the app.
    wc.setWindowOpenHandler(({ url }) => { if (!url.startsWith(network.appUrl)) { shell.openExternal(url); return { action: "deny" }; } return { action: "allow" }; });
  });

  app.whenReady().then(() => {
    session.fromPartition(PARTITION).setUserAgent(session.fromPartition(PARTITION).getUserAgent() + " LexariDesktop/" + app.getVersion());
    createMain();
    try { createTray(); } catch {}
    globalShortcut.register(o.shortcut, () => (win && win.isFocused() ? toggleQuick() : summon()));
    globalShortcut.register("CommandOrControl+Shift+Space", toggleQuick);
    setTimeout(pollNotifications, 8000); setInterval(pollNotifications, 60000);
    setupUpdates();
    handleDeepLink(process.argv.find((a) => a.startsWith(PROTOCOL + "://")));
    if (demo === "quick") setTimeout(() => { toggleQuick(); const b = win.getBounds(); quick.setPosition(b.x + b.width - 400, Math.max(b.y, Math.min(b.y + 56, b.y + b.height - 528))); }, 1500);
    if (demo === "about") setTimeout(openAbout, 1500);
    if (demo === "tray") setTimeout(() => trayMenu() && trayMenu().popup({ window: win, x: win.getBounds().width - 260, y: 48 }), 3000);
    o.onReady({ win: () => win, summon, toggleQuick, network, routes: ROUTES });
  });
}

module.exports = { start, ROUTES, PROTOCOL };
