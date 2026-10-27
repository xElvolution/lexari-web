import type { ConfigContext, ExpoConfig } from "expo/config";

const profile = process.env.EAS_BUILD_PROFILE || "development";
const mainnet = profile === "production" || profile === "production-aab";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Lexari",
  slug: "lexari",
  scheme: "lexari",
  version: "1.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  web: { favicon: "./assets/favicon.png" },
  ios: { bundleIdentifier: mainnet ? "ai.lexari.app" : "ai.lexari.app.testnet", supportsTablet: false },
  android: {
    package: mainnet ? "ai.lexari.app" : "ai.lexari.app.testnet",
    versionCode: 7,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      monochromeImage: "./assets/adaptive-monochrome.png",
      backgroundColor: "#5b2bff",
    },
    permissions: ["RECORD_AUDIO", "POST_NOTIFICATIONS", "USE_BIOMETRIC", "USE_FINGERPRINT", "INTERNET", "VIBRATE"],
    intentFilters: [
      { action: "VIEW", autoVerify: false, data: [{ scheme: "lexari" }], category: ["BROWSABLE", "DEFAULT"] },
    ],
  },
  plugins: [
    "expo-router",
    "expo-dev-client",
    "expo-secure-store",
    ["expo-notifications", { color: "#5b2bff" }],
    ["expo-local-authentication", { faceIDPermission: "Unlock Lexari." }],
    ["expo-audio", { microphonePermission: "Lexari uses the microphone for voice notes and calls with your agent." }],
    ["expo-speech-recognition", { microphonePermission: "Lexari uses the microphone for calls with your agent.", speechRecognitionPermission: "Lexari turns what you say on a call into text for your agent." }],
    ["expo-image-picker", { photosPermission: "Lexari uses your photos to set your profile picture and cover.", cameraPermission: false, microphonePermission: false }],
    ["expo-splash-screen", { backgroundColor: "#14072e", image: "./assets/splash-icon.png", imageWidth: 96 }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://app.lexari.ai",
    cluster: "devnet", // mainnet is paused: devnet only for now
    programId: process.env.EXPO_PUBLIC_LEXARI_PROGRAM_ID || "BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po",
    privyAppId: process.env.EXPO_PUBLIC_PRIVY_APP_ID || "",
    privyClientId: process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || "",
    skrMint: process.env.EXPO_PUBLIC_SKR_MINT || "",
    usdcMint: process.env.EXPO_PUBLIC_USDC_MINT || "",
    eas: { projectId: process.env.EAS_PROJECT_ID || "" },
  },
});
