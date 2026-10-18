// Lexari for macOS: hidden-inset titlebar with native traffic lights, vibrancy, app menu, dock menu, menu-bar icon.
const { app, Menu, shell } = require("electron");
const { start, ROUTES } = require("./shared-build/core");
start({
  hideOnClose: true,
  trayIcon: "trayTemplate.png",
  shortcut: "Command+Shift+L",
  windowExtras: { frame: true, titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 15 }, vibrancy: "under-window", visualEffectState: "active", backgroundColor: "#00000000" },
  onReady: ({ win, summon, toggleQuick, network }) => {
    const nav = (r) => () => { summon(); win().webContents.send("lexari:navigate", network.appUrl + "/" + r); };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: "appMenu" },
      { label: "File", submenu: [{ label: "Quick chat", accelerator: "Command+Shift+Space", click: toggleQuick }, { type: "separator" }, { role: "close" }] },
      { role: "editMenu" },
      { label: "Go", submenu: ROUTES.map((r, i) => ({ label: r[0].toUpperCase() + r.slice(1), accelerator: i < 9 ? `Command+${i + 1}` : undefined, click: nav(r) })) },
      { role: "viewMenu" },
      { role: "windowMenu" },
      { role: "help", submenu: [{ label: "Lexari docs", click: () => shell.openExternal("https://lexari.ai") }] },
    ]));
    app.dock.setMenu(Menu.buildFromTemplate([{ label: "Quick chat", click: toggleQuick }, ...["agents", "wallets", "hub"].map((r) => ({ label: r[0].toUpperCase() + r.slice(1), click: nav(r) }))]));
  },
});
