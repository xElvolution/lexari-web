# Lexari desktop

Standalone Lexari desktop apps for macOS, Windows and Linux. Same backend, endpoints and features as the web app
(app.lexari.ai): agents, chat, brain, marketplace, team, hub, wallets, settings and profile. Testnet by default.

```
desktop-app/
  shared/    shared UI and main-process core (copied into each platform at build time)
  mac/       macOS app: traffic lights, menu bar, dock menu, universal dmg + zip
  windows/   Windows app: Mica, native caption buttons, jump list, nsis exe + msi
  linux/     Linux app: frameless window, tray, x-scheme-handler, AppImage + deb
  ci/        GitHub Actions workflow (see "CI" below)
```

## Stack: Electron (why not Tauri)

- Lexari's web app relies on Chromium features (Privy embedded wallets, WebAuthn, wallet adapters, WebRTC voice calls, noVNC).
  Tauri uses WKWebView, WebView2 and WebKitGTK, which differ per OS; WebKitGTK in particular lags on WebAuthn and WebRTC.
  Electron ships one Chromium everywhere, so every feature behaves like the web app on all three platforms.
- The whole codebase is TypeScript/JS. Electron needs no Rust toolchain on the VPS or in CI.
- electron-builder gives dmg (universal), nsis/msi, AppImage/deb and GitHub-releases auto-update in one tool.
- Cost: larger download (around 100 MB). Accepted for feature parity.

## How each platform folder builds on its own

Each platform folder has its own `package.json`, electron-builder config, `main.js` and README.
`npm run sync` (run automatically by `start`, `dist` and `release`) copies `../shared` into `./shared-build`
(gitignored), so the packaged app has no reference outside its folder.

```
cd desktop-app/linux   # or mac, windows
npm install
npm start              # dev
npm run dist           # build installers into ./dist
```

## Features

| Feature | Where |
| --- | --- |
| Animated shell: aurora background, spring nav rail, splash, load bar, command palette (Ctrl/Cmd K) | `shared/renderer` |
| Custom titlebar (traffic lights on Mac, Mica caption overlay on Windows, Lexari controls on Linux) | `shared/renderer`, platform `main.js` |
| Full web app inside a persistent session (`persist:lexari`), external links open in the system browser | `shared/core.js` |
| Tray / menu-bar icon with quick chat to any of your agents (streams from `/api/chat`) | `shared/core.js`, `shared/renderer/quick.*` |
| Global shortcuts: Cmd/Ctrl+Shift+L summons Lexari, Cmd/Ctrl+Shift+Space opens quick chat | `shared/core.js` |
| Native notifications for agent events and claims, dock/taskbar badge (polls `/api/notifications`) | `shared/core.js` |
| Deep links `lexari://auth/callback?...` and `lexari://open/<route>` | `shared/core.js` |
| Auto-update via electron-updater and GitHub releases (draft) | `shared/core.js`, `build.publish` |
| Offline and server-error screens with retry and auto-reconnect | `shared/renderer/shell.js` |
| Window size, position and maximized state persistence | `shared/core.js` (`window-state.json` in userData) |
| Network config (testnet now, mainnet ready) | `shared/config/networks.json` |

Wallet custody logic is untouched: wallets are the web app's own code running in the app session.

## Network

`shared/config/networks.json` holds `testnet` (default) and `mainnet` (disabled until launch). Override with
`LEXARI_NETWORK=mainnet` or set `enabled: true` and flip `default` when mainnet goes live.

## Sign-in, Google and passkeys

- Email sign-in works inside the app window.
- Google sign-in and passkeys: the command palette has "Sign in with the system browser". It opens
  `https://app.lexari.ai/sign-in?desktop=1&return=lexari://auth/callback`. When the web app redirects to
  `lexari://auth/callback?...` the desktop app reopens and finishes sign-in in its own session.
  The web side must handle `desktop=1` by redirecting to `return` with a one-time code after sign-in
  (not wired in webapp yet, see "Blocked").
- Passkeys inside the window: Electron's Chromium supports WebAuthn with security keys on all platforms and
  Windows Hello on Windows. macOS iCloud Keychain passkeys and Linux platform authenticators are not exposed to
  Electron, so on those use the system browser fallback above.

## Code signing (not done yet, builds are unsigned)

### macOS (Developer ID + notarization)
1. Join the Apple Developer Program, create a "Developer ID Application" certificate in Xcode or the developer portal.
2. Export it as `.p12`. Add GitHub secrets `CSC_LINK` (base64 of the p12) and `CSC_KEY_PASSWORD`.
3. Create an app-specific password for the Apple ID. Add secrets `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
4. In `mac/package.json` remove `"identity": null` and add `"notarize": true` under `build.mac`.
5. In the workflow drop `CSC_IDENTITY_AUTO_DISCOVERY: "false"` for the mac job and pass the secrets as env.
   electron-builder signs with the hardened runtime and `entitlements.mac.plist`, then notarizes and staples.

### Windows
1. Buy an OV or EV code-signing certificate (EV avoids SmartScreen warnings; EV keys live on a hardware token
   or a cloud HSM such as Azure Trusted Signing, DigiCert KeyLocker or SSL.com eSigner).
2. For a `.pfx`: add secrets `WIN_CSC_LINK` (base64 pfx) and `WIN_CSC_KEY_PASSWORD`; electron-builder signs exe and msi.
3. For a cloud HSM: set `build.win.azureSignOptions` (Azure Trusted Signing) or a custom `sign` script.

### Linux
No signing needed. Optionally sign the AppImage with GPG and publish the key.

## CI

`ci/desktop-app.yml` builds `mac` on macos-14, `windows` on windows-latest and `linux` on ubuntu-22.04.
It runs only on `desktop-v*` tags (draft GitHub release with update metadata), or on pushes/PRs that change
`desktop-app/**`. Install it with:

```
mkdir -p .github/workflows && git mv desktop-app/ci/desktop-app.yml .github/workflows/desktop-app.yml
```

This needs a GitHub token with the `workflow` scope (`gh auth refresh -s workflow`).

## Release

```
git tag desktop-v0.1.0 && git push origin desktop-v0.1.0
```

Bump `version` in all three `package.json` files first. Publish the draft release so auto-update sees it.
