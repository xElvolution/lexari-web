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
  /** a second build of the same platform, e.g. the Intel Mac build */
  alt?: { label: string; url: string; file: string };
  /** button text when "Download for <name>" is not precise enough */
  button?: string;
  /** one short line under the button, e.g. how to open an unsigned build */
  note?: string;
};

export const DOCS_ANDROID = "https://docs.lexari.ai/android/";

export const platforms: Platform[] = [
  {
    id: "android", name: "Android", device: "phone", status: "live",
    url: "https://github.com/xElvolution/lexari/releases/download/android-latest/lexari.apk",
    version: "1.1.0", size: "About 119 MB", file: "lexari.apk",
    requires: "Android 8 or newer",
    blurb: "Your agent in your pocket. Chat, hand off tasks and watch its desk from anywhere.",
  },
  {
    id: "ios", name: "iOS", device: "phone", status: "testflight",
    requires: "iPhone",
    blurb: "The same agent on iPhone. Beta builds land on TestFlight first.",
  },
  {
    id: "macos", name: "macOS", device: "laptop", status: "live",
    url: "https://github.com/xElvolution/lexari/releases/download/mac-latest/Lexari-0.2.0-arm64.dmg",
    version: "0.2.0", size: "About 114 MB", file: "Lexari-0.2.0-arm64.dmg",
    button: "Download for Apple silicon",
    alt: { label: "Intel Mac", url: "https://github.com/xElvolution/lexari/releases/download/mac-latest/Lexari-0.2.0-x64.dmg", file: "Lexari-0.2.0-x64.dmg" },
    note: "Not notarized yet: right-click Lexari in Applications and choose Open the first time.",
    requires: "Apple silicon and Intel",
    blurb: "A native Mac app with quick chat from anywhere on your desktop.",
  },
  {
    id: "windows", name: "Windows", device: "monitor", status: "live",
    url: "https://github.com/xElvolution/lexari/releases/download/windows-latest/Lexari-Setup-0.2.0-x64.exe",
    version: "0.2.0", size: "About 80 MB", file: "Lexari-Setup-0.2.0-x64.exe",
    note: "Not code signed yet: if SmartScreen appears, choose More info, then Run anyway.",
    requires: "Windows 10 and 11, 64-bit",
    blurb: "Lexari on your PC, one shortcut away from whatever you are working on.",
  },
  {
    id: "linux", name: "Linux", device: "monitor", status: "live",
    url: "https://github.com/xElvolution/lexari/releases/download/linux-latest/Lexari-0.2.0.AppImage",
    version: "0.2.0", size: "About 105 MB", file: "Lexari-0.2.0.AppImage",
    alt: { label: ".deb", url: "https://github.com/xElvolution/lexari/releases/download/linux-latest/lexari-desktop-linux_0.2.0_amd64.deb", file: "lexari-desktop-linux_0.2.0_amd64.deb" },
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
