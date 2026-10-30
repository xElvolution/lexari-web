# Lexari for Linux

Native touches: frameless window with Lexari window controls (double-click titlebar to maximize), system tray
with quick chat and sections, `x-scheme-handler/lexari` in the .desktop entry, Ctrl+Shift+L summon, libnotify
notifications, Wayland window decorations.

```
npm install
npm start
npm run dist   # dist/Lexari-<v>.AppImage and dist/lexari-desktop-linux_<v>_amd64.deb
```

Headless run (CI or servers): `APPIMAGE_EXTRACT_AND_RUN=1 xvfb-run ./Lexari-0.1.0.AppImage --no-sandbox`.
Tray needs a StatusNotifier host on GNOME (AppIndicator extension).
