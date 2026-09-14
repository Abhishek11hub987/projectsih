/* ═══════════ Shared UI primitives (client components) ═══════════ */
"use client";

import { useEffect, useRef, useState } from "react";

/* ---------- Toast system ---------- */
export function ToastStack({ toasts, dismiss }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.type} onClick={() => dismiss(t.id)}>
          <div className="t-ic">{t.type === "ok" ? "✓" : t.type === "warn" ? "⚠" : "i"}</div>
          <div><b>{t.title}</b>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const push = (title, msg, type = "ok", ms = 4200) => {
    const id = ++idRef.current;
    setToasts((ts) => [...ts, { id, title, msg, type }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), ms);
  };
  const dismiss = (id) => setToasts((ts) => ts.filter((t) => t.id !== id));
  return { toasts, push, dismiss };
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Category / status constants ---------- */
export const CATS = ["education", "health", "agriculture", "water", "infrastructure", "environment", "other"];
export const CAT_LABEL = { education: "Education", health: "Health", agriculture: "Agriculture", water: "Water", infrastructure: "Infrastructure", environment: "Environment", other: "Other" };
export const CAT_EMOJI = { water: "🚱", education: "🏫", health: "🩺", agriculture: "🌾", infrastructure: "🛣", environment: "🌿", other: "📍" };
export const CAT_VAR = { education: "--c-edu", health: "--c-health", agriculture: "--c-agri", water: "--c-water", infrastructure: "--c-infra", environment: "--c-env", other: "--c-other" };
export const STATUS_FLOW = ["submitted", "routed", "in_review", "proposal_submitted", "in_progress", "resolved"];
export const STATUS_LBL = { submitted: "Submitted", routed: "Routed", in_review: "In Review", proposal_submitted: "Proposal In", in_progress: "In Progress", resolved: "Resolved" };
export const DISTRICTS = ["Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka", "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla", "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi", "Sahibganj", "Seraikela-Kharsawan", "Simdega", "West Singhbhum"];

export const fmtINR = (n) => "₹" + (n || 0).toLocaleString("en-IN");
export const initials = (m) => m.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

/* ---------- Stepper ---------- */
export function Stepper({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <div className="stepper">
      {STATUS_FLOW.map((s, i) => (
        <div key={s} className={"st " + (i < idx ? "done" : i === idx ? "now" : "")}>{STATUS_LBL[s]}</div>
      ))}
    </div>
  );
}

/* ---------- Vote button ---------- */
export function VoteBtn({ problem, onVote, compact }) {
  const voted = problem.viewer_voted;
  return (
    <button
      className={"vote-btn" + (voted ? " voted" : "")}
      onClick={() => onVote(problem.id)}
      aria-pressed={voted}
    >
      ▲ {problem.votes} {voted ? "· voted" : "me too"}
    </button>
  );
}

/* ---------- Map (SVG, Jharkhand-approximate, zero deps) ---------- */
const MAP_BOUNDS = { minLat: 21.9, maxLat: 25.4, minLng: 83.2, maxLng: 88.0 };
const JK_OUTLINE = [[24.4,87.9],[25.1,87.9],[25.3,88.1],[24.9,87.0],[24.5,86.9],[24.2,86.4],[23.9,86.5],[23.7,86.0],[23.4,85.7],[23.2,85.3],[22.6,85.3],[22.3,84.9],[22.0,84.6],[21.95,84.2],[22.4,84.1],[22.7,84.5],[23.0,84.6],[23.3,84.9],[23.1,85.2],[23.5,85.5],[23.8,85.3],[24.0,85.7],[24.1,86.2],[24.4,86.4],[24.6,86.8],[24.8,87.2],[24.7,87.7],[24.4,87.9]];
const MAP_CITIES = [[23.35,85.33,"Ranchi"],[23.80,86.43,"Dhanbad"],[22.80,86.20,"Jamshedpur"],[24.40,87.25,"Dumka"],[24.18,86.30,"Giridih"],[23.67,86.18,"Bokaro"],[24.50,86.98,"Deoghar"],[22.62,84.51,"Simdega"],[23.75,84.40,"Latehar"],[25.04,87.85,"Pakur"]];

function projectXY(lat, lng, W, H, pad = 26) {
  const x = pad + ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * (W - 2 * pad);
  const y = pad + ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * (H - 2 * pad);
  return { x: Math.max(pad, Math.min(W - pad, x)), y: Math.max(pad, Math.min(H - pad, y)) };
}

export function catColorOf(cat) {
  if (typeof window === "undefined") return "#6B6456";
  return getComputedStyle(document.documentElement).getPropertyValue(CAT_VAR[cat] || "--c-other").trim() || "#6B6456";
}

export function ProblemMap({ problems, onSelect }) {
  const W = 980, H = 560;
  const [colors, setColors] = useState({});
  const [tip, setTip] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const c = {};
    CATS.forEach((cat) => (c[cat] = catColorOf(cat)));
    setColors(c);
  }, []);

  const path = JK_OUTLINE.map(([la, ln], i) => { const { x, y } = projectXY(la, ln, W, H); return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1); }).join(" ") + " Z";

  const showTip = (e, p) => {
    const panel = panelRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const pr = e.currentTarget.getBoundingClientRect();
    setTip({
      x: pr.left + pr.width / 2 - r.left,
      y: pr.top - r.top,
      title: p.title,
      meta: `${p.district} · ${STATUS_LBL[p.status] || p.status} · P${Number(p.priority_score ?? p.priority).toFixed(1)} · ▲${p.votes}`,
    });
  };

  return (
    <div className="map-panel" ref={panelRef}>
      {tip && (
        <div className="map-tip show" style={{ left: tip.x + "px", top: tip.y + "px" }}>
          <b>{tip.title}</b>
          <span className="mono-x">{tip.meta}</span>
        </div>
      )}
      <svg className="map-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Problem map of Jharkhand">
        <path d={path} fill="rgba(18,87,74,.045)" stroke="rgba(18,87,74,.35)" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
        {MAP_CITIES.map(([la, ln, name]) => {
          const { x, y } = projectXY(la, ln, W, H);
          return (
            <g key={name}>
              <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill="var(--ink-3)" />
              <text x={(x + 7).toFixed(1)} y={(y + 3.5).toFixed(1)} fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--ink-3)" letterSpacing="1">{name.toUpperCase()}</text>
            </g>
          );
        })}
        {problems.map((p) => {
          const { x, y } = projectXY(p.latitude, p.longitude, W, H);
          const pr = Number(p.priority_score ?? p.priority ?? 5);
          const r = (4 + Math.min(pr, 10) * 1.1).toFixed(1);
          return (
            <g
              key={p.id}
              className="map-pin"
              transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}
              onMouseOver={(e) => showTip(e, p)}
              onMouseOut={() => setTip(null)}
              onClick={() => onSelect && onSelect(p)}
            >
              <circle className="pc" r={r} fill={colors[p.category] || "#6B6456"} opacity=".88" />
              <circle r={Math.max(2, r * 0.36).toFixed(1)} fill="var(--surface)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Problem row ---------- */
export function ProblemRow({ problem: p, viewerRole, onVote, onTrack, onPropose }) {
  const uni = p.routed_to_name;
  const canPropose = viewerRole === "university" && ["routed", "in_review"].includes(p.status);
  const isCitizen = viewerRole === "citizen";
  return (
    <div className="prow">
      <div className="pr-icon">{CAT_EMOJI[p.category] || "📍"}</div>
      <div className="pr-main">
        <h4>{p.title}</h4>
        <div className="pr-meta">
          <span className="chip"><span className={"cat-dot cat-" + p.category} />{CAT_LABEL[p.category] || "Other"}</span>
          <span className={"badge st-" + p.status}>{STATUS_LBL[p.status] || p.status}</span>
          <span>📍 {p.district}</span>
          <span className="mono-ink tiny">{p.id.slice(0, 8)}</span>
        </div>
        <p className="pr-desc">{p.description}</p>
        <div className="pr-foot">
          {isCitizen ? (
            <button className={"vote-btn" + (p.viewer_voted ? " voted" : "")} onClick={() => onVote(p.id)}>
              ▲ {p.votes} {p.viewer_voted ? "· voted" : "me too"}
            </button>
          ) : (
            <span className="chip">▲ {p.votes} votes</span>
          )}
          {uni && <span className="chip">🎓 {uni}</span>}
          {canPropose && <button className="btn btn-green btn-sm" style={{ marginLeft: "auto" }} onClick={() => onPropose(p)}>Form team and propose</button>}
          {onTrack && <button className="btn btn-ghost btn-sm" onClick={() => onTrack(p)}>Track</button>}
        </div>
      </div>
      <div className="pr-side">
        <div className="pr-prio"><b>{Number(p.priority_score ?? 5).toFixed(1)}</b><div className="bar"><i style={{ width: (p.priority_score ?? 5) * 10 + "%" }} /></div></div>
        <div className="pr-prio" style={{ fontSize: 10 }}>PRIORITY</div>
      </div>
    </div>
  );
}

/* ---------- Reveal on scroll ---------- */
export function Reveal({ children, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { el.classList.add("in"); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={"reveal " + (className || "")}>{children}</div>;
}

/* AppShell for the portal — sidebar + topbar + content */
export function Shell({ user, roleName, expertise, active, navItems, onNav, onExit, title, sub, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={"sidebar" + (open ? " open" : "")}>
        <div className="sb-brand"><span className="brand-mark">सेतु</span><b>SETU Portal</b></div>
        <div className="sb-role">
          <div className="who">{user?.name || "…"}</div>
          <div className="sub">{roleName}{expertise ? " · " + expertise.map((e) => CAT_LABEL[e] || e).join(" · ") : ""}</div>
        </div>
        <nav className="sb-nav">
          {navItems.map(([id, label, icon, count]) => (
            <a key={id} href="#" className={active === id ? "active" : ""} onClick={(e) => { e.preventDefault(); setOpen(false); onNav(id); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon }} />
              <span>{label}</span>
              {count ? <span className="cnt">{count}</span> : null}
            </a>
          ))}
        </nav>
        <div className="sb-foot">
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: "100%", borderColor: "rgba(244,241,233,.25)", background: "transparent", color: "rgba(244,241,233,.85)" }} onClick={onExit}>← Sign out</button>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-top">
          <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
          <div><h1>{title}</h1><div className="sub">{sub}</div></div>
        </div>
        <div>{children}</div>
      </main>
    </div>
  );
}
