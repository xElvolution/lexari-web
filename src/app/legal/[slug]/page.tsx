import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: { title: "Terms", body: ["This is a placeholder. The final terms of use for Lexari are being written.", "Until then, treat everything in the app as a demo that runs on example data in your own browser."] },
  privacy: { title: "Privacy", body: ["This is a placeholder. The final privacy policy for Lexari is being written.", "The current demo keeps its data in your browser's local storage and does not send it anywhere."] },
};

export function generateStaticParams() { return Object.keys(DOCS).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; return { title: `Lexari · ${DOCS[slug]?.title ?? "Legal"}` };
}

export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const d = DOCS[slug]; if (!d) notFound();
  return (
    <main className="min-h-[100svh] bg-base text-ink">
      <header className="mx-auto flex h-[72px] max-w-[900px] items-center justify-between px-5"><Link href="/" aria-label="Lexari home"><Logo /></Link><ThemeToggle /></header>
      <article className="mx-auto max-w-[900px] px-5 pb-24 pt-10">
        <span className="label text-brand-ink">Legal · placeholder</span>
        <h1 className="display mt-3 text-[56px] sm:text-[88px]">{d.title}</h1>
        {d.body.map((p) => <p key={p} className="mt-5 max-w-[40rem] text-[18px] leading-relaxed text-ink/80">{p}</p>)}
        <Link href="/" className="btn btn-line mt-10">← Back to lexari</Link>
      </article>
    </main>
  );
}
