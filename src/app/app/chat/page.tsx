import type { Metadata } from "next";
import ChatLayout from "@/components/app/chat/ChatLayout";

export const metadata: Metadata = { title: "Lexari · Chats" };
export default function ChatsPage() { return <ChatLayout />; }
