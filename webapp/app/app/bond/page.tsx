import type { Metadata } from "next";
import Bond from "@/components/bond/Bond";

export const metadata: Metadata = { title: "Lexari · Bond" };

export default function BondPage() {
  return <Bond />;
}
