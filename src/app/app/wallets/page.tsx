import { Suspense } from "react";
import WalletsView from "@/components/app/wallet/WalletsView";

export default function WalletsPage() {
  return <Suspense><WalletsView /></Suspense>;
}
