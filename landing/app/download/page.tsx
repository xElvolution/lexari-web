import type { Metadata } from "next";
import Header from "@/components/Header";
import { Footer } from "@/components/Finale";
import Downloads from "@/components/Downloads";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Download Lexari",
  description: "Get Lexari on Android today. iOS, macOS, Windows and Linux are on the way.",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <main className="overflow-x-clip">
      <Header base="/" />
      <Downloads />
      <Footer base="/" />
      <Reveal />
    </main>
  );
}
