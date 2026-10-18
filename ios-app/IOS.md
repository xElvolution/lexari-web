# Lexari for iPhone (ios-app/)

A standalone, iOS-only Expo project (Expo SDK 57). It has the same features, backend (`https://app.lexari.ai`) and endpoints as the Android app in `../android-app`, which stays untouched. The UI uses the iOS 26 Liquid Glass style everywhere through `src/components/Glass.tsx`:

- iOS 26 and later: real refractive glass (`expo-glass-effect` `GlassView`).
- iOS 18 and earlier: a system chrome blur material (`expo-blur`).
- Reduce Transparency on: solid tinted surfaces, no blur.
- Continuous (squircle) corners, a thin specular rim, brand purple `#5b2bff`, and the existing Reanimated UI-thread animations.

Glass surfaces: the floating tab bar capsule, the top bar, cards, both sheet types, toasts and ghost buttons.

## iPhone differences from Android

- No Mobile Wallet Adapter, since it only exists on Android. `src/lib/mwa.ts` is a stub that explains this. On iPhone, people sign in with Privy (Apple, Google, email) or a passkey. Outside wallets are linked on app.lexari.ai.
- Passkeys use the `webcredentials:app.lexari.ai` associated domain, so they are shared with the web app. This needs the AASA file (step 7).

## Identifiers

| Item | Value |
| --- | --- |
| Bundle id | `ai.lexari.app.testnet` (override it with the `IOS_BUNDLE_ID` env var, for example `ai.lexari.app` for mainnet) |
| Scheme | `lexari://` |
| Associated domains | `webcredentials:app.lexari.ai`, `applinks:app.lexari.ai` |
| Encryption | `ITSAppUsesNonExemptEncryption = false` (standard HTTPS and OS crypto only) |

## Local checks (they work on Linux)

```bash
cd ios-app
npm install
npm run typecheck
npx expo-doctor
npx expo prebuild -p ios --no-install --clean   # makes ios/ to inspect, which is gitignored
npm run preview:web                              # web preview of the screens
```

## Finishing once the Apple Developer account is active

1. **Find the Team ID.** Go to developer.apple.com, then Account, then Membership details. The Team ID has 10 characters, for example `AB12CD34EF`.
2. **Replace the placeholders.**
   - In `ios-app/docs/apple-app-site-association` (kept out of webapp/public so a web deploy cannot ship the placeholder), replace every `TEAMID` with the Team ID.
   - In `ios-app/eas.json` under `submit.production.ios`, set `appleTeamId` to the Team ID, `appleId` to the owner's Apple ID email, and `ascAppId` to the app's numeric Apple ID (from step 4).
3. **Log in to Expo and link the project.**
   ```bash
   npm i -g eas-cli
   cd ios-app
   eas login
   eas init            # makes or links the EAS project. Put the projectId in EAS_PROJECT_ID or extra.eas.projectId
   ```
4. **Create the app in App Store Connect.** Go to My Apps, then +, then New App. Choose iOS, name it Lexari, pick the bundle id `ai.lexari.app.testnet`, and set SKU `lexari-ios`. If the bundle id is missing, `eas build` registers it in step 5. Copy the app's Apple ID number into `ascAppId`.
5. **Build.** EAS asks to sign in to Apple and creates the distribution certificate and provisioning profile. Choose "Let EAS handle it". EAS also turns on the Associated Domains and Sign in with Apple capabilities.
   ```bash
   eas build -p ios --profile production    # store build, for TestFlight and the App Store
   eas build -p ios --profile preview       # optional ad hoc build for registered devices (eas device:create)
   ```
6. **Submit to TestFlight.**
   ```bash
   eas submit -p ios --profile production --latest
   ```
   Apple's processing takes about 5 to 30 minutes.
7. **Deploy the AASA** (only after step 2). Copy `ios-app/docs/apple-app-site-association` to `webapp/public/.well-known/apple-app-site-association`, deploy the web app, and serve `https://app.lexari.ai/.well-known/apple-app-site-association` with `Content-Type: application/json`, HTTPS, and no redirects. Check it:
   ```bash
   curl -sI https://app.lexari.ai/.well-known/apple-app-site-association
   curl -s https://app-site-association.cdn-apple.com/a/v1/app.lexari.ai
   ```
   Apple's CDN can take up to 24 hours to pick up changes. Passkeys fail with a domain error until it does.
8. **Set up TestFlight testers.**
   - Internal testers (up to 100 App Store Connect users, no review): open the TestFlight tab, add an Internal Group, add users, and turn on automatic distribution.
   - External testers (up to 10,000): open the TestFlight tab, add an External Group, add the build, and fill in Test Information (description, feedback email, and a demo account for review if sign-in is needed). Then submit for Beta App Review. The first build takes about 1 day.
   - Public link: in the external group, choose Enable Public Link, set an optional tester limit, and share the `https://testflight.apple.com/join/XXXXXXXX` URL.
9. **Next builds.** `eas build -p ios --profile production --auto-submit`. The build number goes up on its own (`autoIncrement`, remote app version source).
