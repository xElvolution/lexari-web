import type { Metadata } from "next";
import { SPECIALISTS, specialistBySlug } from "@/content/appData";
import ChatLayout from "@/components/app/chat/ChatLayout";

export function generateStaticParams() { return [{ id: "home" }, ...SPECIALISTS.map((s) => ({ id: s.slug }))]; }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Lexari · Chat${id === "home" ? "" : ` with ${specialistBySlug(id)?.name ?? "agent"}`}` };
}
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatLayout id={id} />;
}
