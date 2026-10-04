"use client";

import Face from "@shared/components/Face";

/** Full-screen branded loading while the session is set up after Google, email or a wallet. */
export default function SignInLoader({ text = "Signing you in…", sub }: { text?: string; sub?: string }) {
  return (
    <div data-signin-loader role="status" aria-live="polite" className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#07050e] text-white">
      <div className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-grape/40 blur-[120px]" />
      <div className="relative grid place-items-center">
        <span className="absolute h-[150px] w-[150px] animate-ping rounded-[44px] border-2 border-lilac/40 [animation-duration:1.8s]" />
        <span className="grid h-[132px] w-[132px] place-items-center rounded-[40px] bg-[#1d0f5c] ring-1 ring-white/10"><Face size={104} animated /></span>
      </div>
      <div className="relative mt-9 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white"><span className="h-2.5 w-2.5 rounded-full bg-[#0a0a0a]" /></span><span className="display text-[24px] leading-none">lexari</span></div>
      <p className="relative mt-4 text-[17px] font-semibold">{text}</p>
      {sub && <p className="relative mt-1.5 max-w-[280px] text-center text-[13.5px] text-white/60">{sub}</p>}
      <div className="relative mt-6 flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="h-2 w-2 animate-bounce rounded-full bg-lilac" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
    </div>
  );
}
