export const metadata = { title: "SETU · Landing" };

/* ═══════════ Landing page (night theme, glass over aurora) — server component ═══════════ */
import Link from "next/link";
import { BridgePanel, RoleDossier } from "@/components/landing";

const JOURNEY = [
  { who: "AI", t: "Classify", d: "Every submission is sorted into one of seven civic domains by the NLP engine." },
  { who: "AI", t: "De-duplicate", d: "Near-identical complaints raised nearby merge into one ticket with a shared vote count." },
  { who: "AI", t: "Prioritise", d: "An explainable urgency score ranks each problem on keywords, community votes and time unresolved." },
  { who: "Universities", t: "Solve", d: "The problem routes to the matching department. Faculty and students form a team and propose." },
  { who: "Industry · Govt", t: "Fund", d: "Industry or CSR backs the proposal. The citizen watches every stage until it is resolved." },
];

export default function Landing() {
  return (
    <div className="l-page theme-night">
      {/* aurora backdrop — the one place boldness is spent */}
      <div className="aurora" aria-hidden="true">
        <i className="a1" /><i className="a2" /><i className="a3" />
      </div>

      {/* floating glass topbar */}
      <header className="topbar">
        <div className="l-topbar">
          <div className="topbar-in">
            <div className="brand">
              <span className="brand-mark">सेतु</span>
              <span><b>SETU</b> <span className="hin">· सेतु पोर्टल</span></span>
            </div>
            <nav className="nav-links">
              <a href="#how">How it works</a>
              <a href="#roles">Who uses SETU</a>
              <a href="#build">Roadmap</a>
            </nav>
            <div className="topbar-actions">
              <Link href="/login" className="l-ghost">Sign in</Link>
              <Link href="/login" className="btn btn-accent">Enter the portal</Link>
            </div>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="l-sec l-hero">
        <div className="wrap l-hero-grid">
          <div>
            <div className="hero-eyebrow l-rise l-rise-1"><span className="b">SIH26043</span> Government of Jharkhand · Smart India Hackathon</div>
            <h1 className="display d-xl l-rise l-rise-2">Every societal challenge, matched to the right minds.</h1>
            <p className="lead l-rise l-rise-3">
              Citizens report. The engine classifies, prioritises and routes each problem to the
              right university team. Industry funds. Government oversees.
            </p>
            <div className="hero-cta l-rise l-rise-4">
              <Link href="/login" className="btn btn-accent btn-lg">Enter the portal</Link>
              <Link href="/login?role=citizen" className="l-ghost">Report a problem</Link>
            </div>
          </div>
          <BridgePanel />
        </div>
      </section>

      {/* stats band */}
      <section className="l-sec" style={{ paddingTop: 34, paddingBottom: 10 }}>
        <div className="wrap">
          <div className="stats-band">
            <div className="sb-c"><b>6</b><span>partner universities</span></div>
            <div className="sb-c"><b>3</b><span>industry and CSR partners</span></div>
            <div className="sb-c"><b>24</b><span>districts reachable</span></div>
            <div className="sb-c"><b>₹0</b><span>monthly cost at pilot scale</span></div>
          </div>
        </div>
      </section>

      {/* journey — a real 5-stage sequence */}
      <section className="l-sec section" id="how">
        <div className="wrap">
          <h2 className="display d-m" style={{ marginBottom: 34 }}>How a problem moves</h2>
          <div className="journey">
            {JOURNEY.map((s, i) => (
              <div key={s.t} className="j-stage">
                <div className="j-dot">{String(i + 1).padStart(2, "0")}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
                <span className="j-who">{s.who}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* roles — interactive dossier */}
      <section className="l-sec section" id="roles" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <h2 className="display d-m" style={{ marginBottom: 30 }}>Four roles, one portal</h2>
          <RoleDossier />
        </div>
      </section>

      {/* roadmap band */}
      <section className="l-sec band-elev section" id="build">
        <div className="wrap band-grid">
          <div>
            <h2 className="display d-l" style={{ marginBottom: 16 }}>Built to deploy. Sized to scale.</h2>
            <p className="lead">
              A modular monolith by choice: Next.js app, Postgres with pgvector, free-tier LLM
              inference. The production path to NIC MeghRaj keeps the same schema, so nothing is
              rewritten, only re-hosted.
            </p>
            <div className="chip-row">
              {["Next.js 14 · App Router", "Supabase Postgres + pgvector", "Groq / Gemini free tier", "Interactive SVG district map", "Cloudflare Pages · ₹0 / month"].map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          </div>
          <div className="card card-pad">
            <h4 style={{ fontSize: 14, marginBottom: 14 }}>Production roadmap</h4>
            <div className="tl">
              {[
                ["Aadhaar / DigiLocker SSO", "Verified citizen identity at scale."],
                ["Regional-language NLP", "Santali, Ho and Mundari via IndicTrans2 and IndicBERT, both open source."],
                ["SMS and email notifications", "MSG91 and Resend integration."],
                ["NIC MeghRaj hosting", "Data-sovereign production deployment."],
              ].map(([t, d], i) => (
                <div key={t} className={"tl-item" + (i > 1 ? " dim" : "")}>
                  <div className="tl-t">{t}</div>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="foot">
        <div className="wrap foot-grid">
          <div className="fg-col">
            <div className="brand" style={{ marginBottom: 12 }}>
              <span className="brand-mark">सेतु</span><span><b>SETU</b></span>
            </div>
            <p className="small muted">
              Societal Innovation Collaboration Portal. A Smart India Hackathon 2026 prototype for
              problem statement SIH26043, Government of Jharkhand. सेतु is the Hindi word for a
              bridge, and that is the idea: the people who face a problem, connected to the
              institutions built to solve it.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="small muted">Zero paid services. Every component runs on a free tier.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
