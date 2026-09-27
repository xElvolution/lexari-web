/**
 * PLACEHOLDER LOGO. The final mark is being designed separately.
 * Swap the <span> mark below (or the whole component) for the real logo.
 * It inherits the theme ink color, so it works on light and dark.
 */
export default function Logo() {
  return (
    <span className="flex items-center gap-2 text-ink">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[9px] bg-ink">
        <span className="h-2.5 w-2.5 rounded-full bg-base" />
      </span>
      <span className="display text-[26px] leading-none">lexari</span>
    </span>
  );
}
