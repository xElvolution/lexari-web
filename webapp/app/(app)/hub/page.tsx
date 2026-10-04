import type { Metadata } from "next";
import Hub from "@/components/hub/Hub";

export const metadata: Metadata = { title: "Lexari · Hub" };

export default function HubPage() {
  return <Hub />;
}
