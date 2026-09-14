import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAdminClient } from "@/lib/server-auth";

/* industry expresses funding/mentorship interest on a proposal */
export async function POST(req) {
  const { authUser, profile, error: authError, status: authStatus } = await getAuthenticatedUser(req);
  if (authError || !profile) {
    return NextResponse.json({ ok: false, error: authError || "Authentication required" }, { status: authStatus || 401 });
  }

  if (profile.role !== "industry" && profile.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden: Only industry partners or administrators can express interest." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { proposal_id, interest_type, message } = body || {};

  if (!proposal_id || !interest_type) {
    return NextResponse.json({ ok: false, error: "proposal_id and interest_type are required" }, { status: 400 });
  }

  const validTypes = ["funding", "mentorship", "both"];
  if (!validTypes.includes(interest_type)) {
    return NextResponse.json({ ok: false, error: "interest_type must be 'funding', 'mentorship', or 'both'" }, { status: 400 });
  }

  // Bind the industry_id to the authenticated user's verified profile
  const industry_id = (profile.role === "admin" && body?.industry_id) ? body.industry_id : profile.id;

  const admin = getAdminClient();

  const { data, error } = await admin.from("industry_interest").insert({
    proposal_id,
    industry_id,
    interest_type,
    message: (message || "").trim().slice(0, 2000),
  }).select("id").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: pr } = await admin.from("proposals").select("problem_id, university_id").eq("id", proposal_id).maybeSingle();
  if (pr?.problem_id) {
    await admin.from("problems").update({ status: "in_progress" }).eq("id", pr.problem_id);
  }

  /* log in-app notifications */
  let title = "", submittedBy = null, uniEmail = null;
  if (pr?.problem_id) {
    const { data: prob } = await admin.from("problems").select("title, submitted_by").eq("id", pr.problem_id).maybeSingle();
    title = (prob?.title || "").slice(0, 40);
    submittedBy = prob?.submitted_by || null;
  }
  if (pr?.university_id) {
    const { data: uni } = await admin.from("users").select("email").eq("id", pr.university_id).maybeSingle();
    uniEmail = uni?.email || null;
  }

  const notifs = [
    { send_to: uniEmail || "university team", channel: "In-app", text: `Industry partner expressed ${interest_type} interest on your proposal for "${title}…". Respond via the SETU portal.` },
    { send_to: "admin", channel: "In-app", text: `Industry interest (${interest_type}) logged on "${title}…" — problem advanced to In Progress.` },
  ];
  if (submittedBy) {
    notifs.push({ send_to: "citizen", channel: "SMS", text: `Good news: an industry partner backed the project for "${title}…". Your problem is now In Progress — track it on SETU.` });
  }
  await admin.from("notifications").insert(notifs);

  return NextResponse.json({ ok: true, interest_id: data.id });
}
