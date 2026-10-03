import type { Metadata } from "next";
import { SPECIALISTS, specialistBySlug } from "@/content/appData";
import Detail from "./Detail";

export function generateStaticParams() { return SPECIALISTS.map((s) => ({ slug: s.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const s = specialistBySlug(slug);
  return { title: s ? `Lexari · ${s.name}, ${s.job}` : "Lexari · Agent" };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Detail slug={slug} />;
}
