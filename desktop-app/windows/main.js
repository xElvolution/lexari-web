// Lexari for Windows: Mica backdrop, native caption buttons via titleBarOverlay, jump list, taskbar badge, AppUserModelID for toasts.
const { app } = require("electron");
const { start, ROUTES } = require("./shared-build/core");
app.setAppUserModelId("ai.lexari.desktop");
start({
  hideOnClose: false,
  windowExtras: { frame: false, titleBarStyle: "hidden", titleBarOverlay: { color: "#00000000", symbolColor: "#ece8ff", height: 44 }, backgroundMaterial: "mica", backgroundColor: "#00000000" },
  onReady: () => {
    // Jump list: right-click the taskbar icon to jump straight to a section via a lexari:// deep link.
    app.setUserTasks(["agents", "wallets", "hub", "marketplace"].map((r) => ({
      program: process.execPath, arguments: `lexari://open/${r}`, iconPath: process.execPath, iconIndex: 0,
      title: r[0].toUpperCase() + r.slice(1), description: `Open ${r} in Lexari`,
    })));
  },
});
