import { redirect } from "next/navigation";

/** Bond was renamed to Hub. Old links still work. */
export default function BondPage() {
  redirect("/app/hub");
}
