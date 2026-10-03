import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Martian_Mono } from "next/font/google";
import "./globals.css";
import PrivyGate from "@/components/PrivyGate";
import SolanaProviders from "@/components/SolanaProviders";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["wdth"] });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const martian = Martian_Mono({ subsets: ["latin"], variable: "--font-martian" });

export const metadata: Metadata = {
  title: "Lexari",
  description: "Your Lexari agents.",
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

/* Runs before first paint: saved choice wins, otherwise follow the system. No flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('lexari-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${figtree.variable} ${martian.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><PrivyGate><SolanaProviders>{children}</SolanaProviders></PrivyGate></body>
    </html>
  );
}
