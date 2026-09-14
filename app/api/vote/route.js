import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAdminClient } from "@/lib/server-auth";

/* citizen votes "me too" on a problem */
export async function POST(req) {
  const { authUser, profile, error: authError, status: authStatus } = await getAuthenticatedUser(req);
  if (authError || !profile) {
    return NextResponse.json({ ok: false, error: authError || "Authentication required to vote" }, { status: authStatus || 401 });
  }

  const body = await req.json().catch(() => null);
  const { problem_id } = body || {};
  if (!problem_id) {
    return NextResponse.json({ ok: false, error: "problem_id is required" }, { status: 400 });
  }

  const user_id = profile.id;
  const admin = getAdminClient();

  const { data: existing } = await admin
    .from("problem_votes")
    .select("*")
    .eq("problem_id", problem_id)
    .eq("user_id", user_id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("problem_votes")
      .delete()
      .eq("problem_id", problem_id)
      .eq("user_id", user_id);
    return NextResponse.json({ ok: true, voted: false });
  }

  const { error } = await admin.from("problem_votes").insert({ problem_id, user_id });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, voted: true });
}
