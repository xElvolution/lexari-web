import type { ReactNode } from "react";
import { ScrollView } from "react-native";

/** Same rule as webapp/components/Capped.tsx: more than 5 rows scroll inside a box about 5.5 rows tall. */
export default function Capped({ n, row = 62, children }: { n: number; row?: number; children: ReactNode }) {
  if (n <= 5) return <>{children}</>;
  return <ScrollView nestedScrollEnabled style={{ maxHeight: row * 5.5 }} showsVerticalScrollIndicator>{children}</ScrollView>;
}
