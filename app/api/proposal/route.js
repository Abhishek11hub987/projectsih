import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAdminClient } from "@/lib/server-auth";

/* university submits a proposal on a routed problem */
export async function POST(req) {
  const { authUser, profile, error: authError, status: authStatus } = await getAuthenticatedUser(req);
  if (authError || !profile) {
    return NextResponse.json({ ok: false, error: authError || "Authentication required" }, { status: authStatus || 401 });
  }

  if (profile.role !== "university" && profile.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden: Only universities or administrators can submit proposals." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { problem_id, team_members, proposal_text, funding_sought } = body || {};

  if (!problem_id || !proposal_text?.trim()) {
    return NextResponse.json({ ok: false, error: "problem_id and proposal_text are required" }, { status: 400 });
  }

  // Bind university_id to authenticated profile
  const university_id = (profile.role === "admin" && body?.university_id) ? body.university_id : profile.id;

  const admin = getAdminClient();

  const members = Array.isArray(team_members)
    ? team_members.map((m) => String(m).trim()).filter(Boolean)
    : typeof team_members === "string"
    ? team_members.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const { data, error } = await admin.from("proposals").insert({
    problem_id,
    university_id,
    team_members: members,
    proposal_text: proposal_text.trim(),
    funding_sought: Math.max(0, +funding_sought || 0),
    status: "submitted",
  }).select("id").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await admin.from("problems").update({ status: "proposal_submitted" }).eq("id", problem_id);

  const { data: p } = await admin.from("problems").select("title, submitted_by").eq("id", problem_id).maybeSingle();
  await admin.from("notifications").insert({
    send_to: "citizen",
    channel: "SMS",
    text: `Proposal received for "${(p?.title || "").slice(0, 36)}…" from a university team. Track it on SETU.`,
  });

  return NextResponse.json({ ok: true, proposal_id: data.id });
}
