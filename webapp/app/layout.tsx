import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Martian_Mono } from "next/font/google";
import "./globals.css";
import PrivyGate from "@/components/PrivyGate";
import SolanaProviders from "@/components/SolanaProviders";
import ClientErrors from "@/components/ClientErrors";
import { WEBAPP_URL } from "@shared/sites";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["wdth"] });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const martian = Martian_Mono({ subsets: ["latin"], variable: "--font-martian" });

const OG = { url: `${WEBAPP_URL}/og`, width: 1200, height: 630, alt: "Lexari. Meet your first personalized AI agent" };
export const metadata: Metadata = {
  metadataBase: new URL(WEBAPP_URL),
  title: "Lexari",
  description: "Meet your first personalized AI agent. An AI agent with its own computer and a memory that lasts.",
  openGraph: { title: "Lexari · Meet your first personalized AI agent", description: "An AI agent with its own computer and a memory that lasts. Free to start.", siteName: "Lexari", type: "website", images: [OG] },
  twitter: { card: "summary_large_image", title: "Lexari · Meet your first personalized AI agent", description: "An AI agent with its own computer and a memory that lasts. Free to start.", images: [OG] },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

/* Runs before first paint. Saved choice: "light", "dark" or "system" (follow the device). Nothing saved yet: Lexari's dark look.
   (Following the device by default flipped people into light mode after any reload on light-mode phones.) */
const themeScript = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('lexari-theme');if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}else if(t!=='light'&&t!=='dark'){t='dark'}d.setAttribute('data-theme',t)}catch(e){d.setAttribute('data-theme','dark')}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${figtree.variable} ${martian.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><ClientErrors /><PrivyGate><SolanaProviders>{children}</SolanaProviders></PrivyGate></body>
    </html>
  );
}
