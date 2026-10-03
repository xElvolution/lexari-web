import { redirect } from "next/navigation";

/** Old chat links open the same chat on Home. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app?c=${encodeURIComponent(id)}`);
}
