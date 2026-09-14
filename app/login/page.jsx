"use client";

/* ═══════════ Sign in / Sign up ═══════════ */
import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CAT_LABEL } from "@/components/ui";

const ROLES = [
  { id: "citizen", ic: "👤", label: "Citizen", hint: "Report & track problems" },
  { id: "university", ic: "🎓", label: "University", hint: "Solve routed problems" },
  { id: "industry", ic: "🏭", label: "Industry / CSR", hint: "Fund & mentor" },
  { id: "admin", ic: "🏛", label: "Government", hint: "Analytics & audit" },
];
const CATS = Object.keys(CAT_LABEL).filter((c) => c !== "other");

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState("signin");
  const [role, setRole] = useState(params.get("role") || "citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [domains, setDomains] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [setupHint, setSetupHint] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setSetupHint(!d.ok))
      .catch(() => setSetupHint(true));
  }, []);

  const toggleDomain = (d) => setDomains((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const sb = supabase();
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your name / institution.");
        if (role === "university" && domains.length === 0) throw new Error("Pick at least one domain of expertise.");
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user) {
          await fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              auth_id: data.user.id,
              name,
              email,
              role,
              institution_name: role === "citizen" ? null : institution || name,
              domain_expertise: role === "university" ? domains : [],
              focus_areas: role === "industry" ? domains : [],
            }),
          });
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/portal");
    } catch (e2) {
      const msg = String(e2?.message || e2);
      if (msg.includes("Failed to fetch") || msg.includes("fetch")) {
        setErr("Cannot reach Supabase. Your .env still has placeholder keys — fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, restart, and try again.");
      } else {
        setErr(msg || "Something went wrong.");
      }
      setBusy(false);
    }
  }

  async function demoLogin() {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/demo-login", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "demo login failed");
      const sb = supabase();
      const { error } = await sb.auth.signInWithPassword({ email: j.email, password: j.password });
      if (error) throw error;
      router.push("/portal");
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  async function demoLoginAs(r) {
    setErr(null);
    setBusy(true);
    try {
      const resp = await fetch("/api/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: r }),
      });
      const j = await resp.json();
      if (!j.ok) throw new Error(j.error || "demo login failed");
      const sb = supabase();
      const { error } = await sb.auth.signInWithPassword({ email: j.email, password: j.password });
      if (error) throw error;
      router.push("/portal");
    } catch (e2) {
      const msg = String(e2?.message || e2);
      setErr(msg.includes("fetch")
        ? "Cannot reach Supabase — fill the keys in .env and restart (see the setup note above)."
        : msg);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div>
          <Link href="/" className="brand" style={{ marginBottom: 40, display: "inline-flex" }}>
            <span className="brand-mark">सेतु</span><span><b>SETU</b></span>
          </Link>
          <h2>Every societal challenge, matched to the right minds.</h2>
          <p>Citizens report. The AI engine classifies, de-duplicates, scores and routes. Universities solve. Industry funds. Government watches it all.</p>
        </div>
        <div className="ah-stats">
          <div><b>4</b><span>roles</span></div>
          <div><b>7</b><span>civic domains</span></div>
          <div><b>24</b><span>districts</span></div>
          <div><b>₹0</b><span>monthly cost</span></div>
        </div>
      </div>

      <div className="auth-form-col">
        <div className="auth-card">
          <div className="brand" style={{ marginBottom: 26 }}>
            <span className="brand-mark">सेतु</span><span><b>SETU Portal</b></span>
          </div>

          {setupHint && (
            <div className="note-strip" style={{ marginBottom: 18 }}>
              <span>🛈</span>
              <div><b>Setup needed:</b> Supabase keys are missing or the database isn&apos;t reachable. Fill <b>.env</b>, run <b>supabase/schema.sql</b> in the SQL editor, then restart. <b>Use a demo login meanwhile.</b></div>
            </div>
          )}

          <h1 className="d-s display" style={{ marginBottom: 4 }}>{mode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="small muted" style={{ marginBottom: 22 }}>Supabase Auth with free email/password — Aadhaar/DigiLocker SSO on the production roadmap.</p>

          <div className="tabs" style={{ marginBottom: 20 }}>
            <button className={mode === "signin" ? "on" : ""} onClick={() => setMode("signin")}>Sign in</button>
            <button className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Sign up</button>
          </div>

          <form onSubmit={submit}>
            {mode === "signup" && (
              <>
                <div className="role-pick">
                  {ROLES.map((r) => (
                    <button type="button" key={r.id} className={role === r.id ? "on" : ""} onClick={() => setRole(r.id)}>
                      <div className="rp-ic">{r.ic}</div>
                      <b>{r.label}</b>
                      <span>{r.hint}</span>
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label>{role === "citizen" ? "Your name" : "Institution name"} <span className="opt">· required</span></label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "citizen" ? "e.g. Priya Kumari" : "e.g. BIT Mesra"} required />
                </div>
                {(role === "university" || role === "industry") && (
                  <div className="field">
                    <label>{role === "university" ? "Domains of expertise" : "Focus areas"} <span className="opt">· pick one or more</span></label>
                    <div className="dom-grid">
                      {CATS.map((c) => (
                        <button type="button" key={c} className={domains.includes(c) ? "on" : ""} onClick={() => toggleDomain(c)}>{CAT_LABEL[c]}</button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="field">
              <label>Password <span className="opt">· min 6 characters</span></label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>

            {err && <div className="note-strip" style={{ marginBottom: 16 }}><span>⚠</span><div>{err}</div></div>}

            <button className="btn btn-green btn-lg btn-block" disabled={busy}>
              {busy ? <><span className="spin" /> Working…</> : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="hr" style={{ margin: "22px 0 16px" }} />
          <div className="mono" style={{ marginBottom: 10 }}>DEMO ACCOUNTS · ONE TAP</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {ROLES.map((r) => (
              <button key={r.id} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => demoLoginAs(r.id)}>
                {r.ic} {r.label.split(" ")[0]}
              </button>
            ))}
          </div>
          <p className="tiny faint" style={{ marginTop: 10 }}>Demo accounts are seeded in schema.sql (password <span className="mono-ink">setu1234</span>) — great for trying any role instantly.</p>

          <div className="auth-alt">
            <Link href="/">← Back to the site</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }} className="mono">LOADING…</div>}>
      <AuthForm />
    </Suspense>
  );
}
