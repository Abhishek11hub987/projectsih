import { NextResponse } from "next/server";

const DEMO = {
  citizen: { email: "priya@demo.setu" },
  university: { email: "hod.che@demo.setu" },
  industry: { email: "csr@tatasf.setu" },
  admin: { email: "admin@demo.setu" },
};

export async function POST(req) {
  // Allow disabling demo logins in strict production environments
  if (process.env.ALLOW_DEMO_LOGINS === "false") {
    return NextResponse.json(
      { ok: false, error: "Demo logins are disabled in production." },
      { status: 403 }
    );
  }

  let role = "citizen";
  try {
    const b = await req.json();
    if (b?.role) role = b.role;
  } catch {}

  const d = DEMO[role];
  if (!d) {
    return NextResponse.json({ ok: false, error: "Unknown demo role requested" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, email: d.email, password: "setu1234" });
}
