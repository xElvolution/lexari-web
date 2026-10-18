/**
 * Downloads page config. To ship a platform, set status to "live" and fill in url
 * (and version / size when known). Nothing else needs to change.
 */
export type PlatformId = "android" | "ios" | "macos" | "windows" | "linux";
export type Status = "live" | "testflight" | "soon";

export type Platform = {
  id: PlatformId;
  name: string;
  device: "phone" | "laptop" | "monitor";
  status: Status;
  url?: string;
  version?: string;
  size?: string;
  requires: string;
  blurb: string;
  file?: string;
};

export const DOCS_ANDROID = "https://docs.lexari.ai/android/";

export const platforms: Platform[] = [
  {
    id: "android", name: "Android", device: "phone", status: "live",
    url: "https://github.com/xElvolution/lexari/releases/download/android-latest/lexari.apk",
    version: "1.0.0", size: "About 119 MB", file: "lexari.apk",
    requires: "Android 8 or newer",
    blurb: "Your agent in your pocket. Chat, hand off tasks and watch its desk from anywhere.",
  },
  {
    id: "ios", name: "iOS", device: "phone", status: "testflight",
    requires: "iPhone",
    blurb: "The same agent on iPhone. Beta builds land on TestFlight first.",
  },
  {
    id: "macos", name: "macOS", device: "laptop", status: "soon",
    requires: "Apple silicon and Intel",
    blurb: "A native Mac app with quick chat from anywhere on your desktop.",
  },
  {
    id: "windows", name: "Windows", device: "monitor", status: "soon",
    requires: "Windows 10 and 11",
    blurb: "Lexari on your PC, one shortcut away from whatever you are working on.",
  },
  {
    id: "linux", name: "Linux", device: "monitor", status: "soon",
    requires: "AppImage and .deb",
    blurb: "For the terminal crowd. Same agent, same memory, your distro.",
  },
];

export const statusLabel: Record<Status, string> = {
  live: "Available now",
  testflight: "Coming soon on TestFlight",
  soon: "Coming soon",
};

export const androidNote = {
  title: "Installing on Android",
  steps: [
    "Uninstall any Lexari version older than Oct 18, 2026 first.",
    "Allow installs from unknown sources when your phone asks.",
    "Open lexari.apk and tap Install.",
  ],
  link: "Full install guide",
};
