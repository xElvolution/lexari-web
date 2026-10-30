import { notFound } from "next/navigation";
import { DEVELOPER_ALPHA_ENABLED } from "@/lib/network";

/** The developer Marketplace alpha runs on testnet only: a mainnet build has no /developer pages. */
export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  if (!DEVELOPER_ALPHA_ENABLED) notFound();
  return children;
}
