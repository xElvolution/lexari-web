# Lexari for Windows

Native touches: Mica backdrop (Windows 11), native caption buttons via titleBarOverlay drawn over the Lexari
titlebar, jump list tasks (Agents, Wallets, Hub, Marketplace as `lexari://open/...`), taskbar badge, toast
notifications with AppUserModelID `ai.lexari.desktop`, tray quick chat, Ctrl+Shift+L summon.

```
npm install
npm start
npm run dist   # dist/Lexari Setup <v>.exe (nsis, x64+arm64) and dist/Lexari <v>.msi
```

Build on Windows (msi needs WiX, which electron-builder downloads). Unsigned builds show SmartScreen. See ../README.md.
