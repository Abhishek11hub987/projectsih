import { NextResponse } from "next/server";

/* Public landing feed: latest problems for the live bridge panel.
   Anon REST read (same RLS as the portal list). Degrades honestly. */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url.startsWith("https://") || !anon) {
    return NextResponse.json({ ok: false, reason: "env-missing" });
  }
  try {
    const r = await fetch(
      url +
        "/rest/v1/problems?select=title,category,district,status,votes,created_at" +
        "&order=created_at.desc&limit=8",
      {
        headers: { apikey: anon, Authorization: "Bearer " + anon },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!r.ok) return NextResponse.json({ ok: false, reason: "db-" + r.status });
    const rows = await r.json();
    const items = (Array.isArray(rows) ? rows : []).map((p) => ({
      title: p.title,
      category: p.category,
      district: p.district,
      status: p.status,
      votes: p.votes ?? 0,
    }));
    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, reason: "unreachable" });
  }
}
