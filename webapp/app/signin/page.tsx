import type { Metadata } from "next";
import SignIn from "@/components/SignInPage";
import { OG_SUB, OG_TAGLINE } from "@shared/og/banner";
import { WEBAPP_URL } from "@shared/sites";
import { inviter } from "@/server/og";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Invite links (/signin?ref=CODE) unfurl on WhatsApp, X and Telegram with the inviter's banner. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).ref;
  const ref = typeof raw === "string" && /^[A-Za-z0-9-]{4,16}$/.test(raw) ? raw.toUpperCase() : "";
  const who = ref ? await inviter(ref) : {};
  const title = who.inviter ? `${who.inviter} invited you to Lexari` : ref ? "You're invited to Lexari" : "Lexari · Sign in";
  const description = `${OG_TAGLINE}. ${OG_SUB}`;
  const image = { url: `${WEBAPP_URL}/og${ref ? `?ref=${ref}` : ""}`, width: 1200, height: 630, alt: who.inviter ? `${who.inviter} invited you to Lexari. ${OG_TAGLINE}` : `Lexari. ${OG_TAGLINE}` };
  const url = `${WEBAPP_URL}/signin${ref ? `?ref=${ref}` : ""}`;
  return {
    title, description,
    openGraph: { title, description, url, siteName: "Lexari", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function Page() {
  return <SignIn />;
}
