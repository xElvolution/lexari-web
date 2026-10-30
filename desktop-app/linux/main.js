// Lexari for Linux: frameless window with Lexari window controls, system tray, x-scheme-handler for lexari:// links.
const { app } = require("electron");
const { start } = require("./shared-build/core");
app.commandLine.appendSwitch("enable-features", "WaylandWindowDecorations");
if (process.env.LEXARI_NO_SANDBOX) app.commandLine.appendSwitch("no-sandbox");
app.setName("Lexari");
start({ hideOnClose: true, windowExtras: { frame: false } });
