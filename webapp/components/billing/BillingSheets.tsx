"use client";

import { useSyncExternalStore } from "react";
import { useBilling } from "@/lib/billing";
import ModelSheet from "./ModelSheet";
import OutOfUsageSheet from "./OutOfUsageSheet";
import SpendSheet from "./SpendSheet";
import TopUpSheet from "./TopUpSheet";

const noop = () => () => {};
/** The billing sheets, mounted once in the app shell. */
export default function BillingSheets() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { sheet } = useBilling();
  if (!mounted || !sheet) return null;
  if (sheet.kind === "models") return <ModelSheet key={sheet.convo} convo={sheet.convo} agent={sheet.agent} group={sheet.group} />;
  if (sheet.kind === "topup") return <TopUpSheet key={`${sheet.intent.product}-${sheet.intent.id ?? ""}`} intent={sheet.intent} />;
  if (sheet.kind === "out") return <OutOfUsageSheet info={sheet.info} />;
  return <SpendSheet />;
}
