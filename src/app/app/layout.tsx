import type { Metadata } from "next";
import AppShell from "@/components/app/AppShell";

export const metadata: Metadata = { title: "Lexari · Your agent's desk" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
