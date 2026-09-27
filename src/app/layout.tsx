import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Martian_Mono } from "next/font/google";
import { copy } from "@/content/copy";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["wdth"] });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const martian = Martian_Mono({ subsets: ["latin"], variable: "--font-martian" });

export const metadata: Metadata = { title: copy.meta.title, description: copy.meta.description };
export const viewport: Viewport = { themeColor: "#5b2bff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable} ${martian.variable}`}>
      <body>{children}</body>
    </html>
  );
}
