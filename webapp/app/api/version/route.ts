export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD || "" }, { headers: { "cache-control": "no-store" } });
}
