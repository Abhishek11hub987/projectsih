import { NextResponse } from "next/server";
import { getAuthenticatedUser, getAdminClient } from "@/lib/server-auth";

/**
 * Fetch the currently authenticated user's profile.
 * Automatically links auth_id if the user was seeded by email.
 */
export async function GET(req) {
  const { authUser, profile, error, status } = await getAuthenticatedUser(req);
  if (error || !profile) {
    return NextResponse.json({ ok: false, error: error || "Profile not found" }, { status: status || 401 });
  }
  return NextResponse.json({ ok: true, user: authUser, profile });
}

/* create or update the users-row profile after auth signup */
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const { auth_id, name, email, role, institution_name, domain_expertise, focus_areas } = body || {};

  if (!auth_id || !name?.trim() || !role) {
    return NextResponse.json({ ok: false, error: "auth_id, name, and role are required" }, { status: 400 });
  }

  // Prevent self-registration as admin
  const allowedRoles = ["citizen", "university", "industry"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ ok: false, error: "Invalid role or unauthorized role registration." }, { status: 400 });
  }

  const { authUser } = await getAuthenticatedUser(req);
  const admin = getAdminClient();

  // If active session exists, enforce that the caller can only register for their own auth_id
  if (authUser && authUser.id !== auth_id) {
    return NextResponse.json({ ok: false, error: "Forbidden: auth_id does not match active session" }, { status: 403 });
  }

  // If no session cookie exists yet (e.g. signup right before session cookie flush), verify auth_id exists in auth.users
  if (!authUser) {
    try {
      const { data: authRecord, error: userError } = await admin.auth.admin.getUserById(auth_id);
      if (userError || !authRecord?.user) {
        return NextResponse.json({ ok: false, error: "Unauthorized: Invalid auth identity" }, { status: 401 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Unauthorized: Unable to verify auth identity" }, { status: 401 });
    }
  }

  const { data, error } = await admin.from("users").upsert(
    {
      auth_id,
      name: name.trim().slice(0, 100),
      email: email ? email.trim().toLowerCase() : null,
      role,
      institution_name: institution_name ? institution_name.trim().slice(0, 150) : null,
      domain_expertise: Array.isArray(domain_expertise) ? domain_expertise : [],
      focus_areas: Array.isArray(focus_areas) ? focus_areas : [],
    },
    { onConflict: "auth_id" }
  ).select("id").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
