import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Returns a Supabase client with admin privileges (bypassing RLS).
 * Use only for verified, server-side actions.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin environment variables.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Verifies the caller's session via cookies or Authorization Bearer token,
 * and fetches the corresponding application profile from the `users` table.
 *
 * @param {Request} [req] - Optional Request object to inspect headers
 * @returns {Promise<{ authUser: object|null, profile: object|null, error: string|null, status: number }>}
 */
export async function getAuthenticatedUser(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { authUser: null, profile: null, error: "Database configuration missing", status: 500 };
  }

  let authUser = null;

  // 1. Check Bearer token in Authorization header if present
  const authHeader = req?.headers?.get?.("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    try {
      const admin = getAdminClient();
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) {
        authUser = data.user;
      }
    } catch {}
  }

  // 2. Fallback to reading session cookies
  if (!authUser) {
    try {
      const cookieStore = cookies();
      const sb = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      });
      const { data, error } = await sb.auth.getUser();
      if (!error && data?.user) {
        authUser = data.user;
      }
    } catch {}
  }

  if (!authUser) {
    return { authUser: null, profile: null, error: "Unauthorized: Please sign in to perform this action.", status: 401 };
  }

  // 3. Resolve profile from the `users` table
  const admin = getAdminClient();
  let { data: profile } = await admin
    .from("users")
    .select("*")
    .eq("auth_id", authUser.id)
    .maybeSingle();

  // If not linked yet, match by email (supports seeded hackathon demo accounts)
  if (!profile && authUser.email) {
    const { data: byEmail } = await admin
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .maybeSingle();

    if (byEmail) {
      profile = byEmail;
      // Link the auth_id in the database so future queries match directly
      await admin.from("users").update({ auth_id: authUser.id }).eq("id", profile.id);
    }
  }

  return { authUser, profile, error: null, status: 200 };
}
