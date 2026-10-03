import type { Metadata } from "next";
import Brain from "@/components/brain/Brain";

export const metadata: Metadata = { title: "Lexari · Brain" };

export default function MemoryPage() {
  return <Brain />;
}
