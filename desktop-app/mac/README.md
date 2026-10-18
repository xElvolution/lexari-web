# Lexari for macOS

Native touches: hidden-inset titlebar with real traffic lights, under-window vibrancy, full app menu with Go
shortcuts (Cmd+1..8), dock menu, template menu-bar icon with quick chat, Cmd+Shift+L summon, close hides to the
menu bar, `lexari://` registered via Info.plist, dock badge for unread notifications.

```
npm install
npm start
npm run dist   # dist/Lexari-<v>-universal.dmg and .zip (zip is used by auto-update)
```

Builds must run on macOS. Unsigned builds: right-click > Open the first time. Signing and notarization: see ../README.md.
