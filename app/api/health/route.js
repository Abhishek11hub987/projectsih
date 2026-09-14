import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon || url.includes("PASTE") || !url.startsWith("https://")) {
    return NextResponse.json({ ok: false, error: "env-missing" });
  }
  try {
    const r = await fetch(url + "/rest/v1/users?select=id&limit=1", {
      headers: { apikey: anon, Authorization: "Bearer " + anon },
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json({ ok: r.ok, status: r.status });
  } catch {
    return NextResponse.json({ ok: false, error: "unreachable" });
  }
}
