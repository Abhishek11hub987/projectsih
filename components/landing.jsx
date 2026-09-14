"use client";

/* ═══════════ Landing client islands: live bridge feed + role dossier ═══════════ */
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User, GraduationCap, Factory, Bank,
  Check, ArrowUp, MapPin, PlugsConnected, Warning,
} from "@phosphor-icons/react/ssr";

const CAT_COLOR = {
  education: "#41688C", health: "#A93B4C", agriculture: "#6E7A3B", water: "#22708A",
  infrastructure: "#8A6A3F", environment: "#3F7A54", other: "#6B7268",
};
const CAT_LABEL = {
  education: "Education", health: "Health", agriculture: "Agriculture", water: "Water",
  infrastructure: "Infrastructure", environment: "Environment", other: "Other",
};

/* ---------- Live bridge panel: real latest problems from /api/feed ---------- */
export function BridgePanel() {
  const [items, setItems] = useState(null);   // null = loading, false = offline
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/feed")
      .then((r) => r.json())
      .then((d) => { if (alive) setItems(d.ok && d.items?.length ? d.items : false); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const offline = failed || items === false;

  return (
    <div className="bridge-panel l-rise l-rise-3">
      <div className="bridge-head">
        <h3>The SETU bridge, live</h3>
        <span className="live-dot"><i />LIVE</span>
      </div>

      {!offline && !items && (
        <div className="bridge-skel" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bf-item">
              <span className="cat-dot" style={{ background: "var(--line)" }} />
              <span className="bf-t" style={{ background: "var(--line)", borderRadius: 6 }}>Loading the latest problems</span>
              <span className="bf-m" style={{ background: "var(--line)", borderRadius: 6 }}>·····</span>
            </div>
          ))}
        </div>
      )}

      {offline && (
        <div className="bridge-fb">
          <div className="bf-ic"><PlugsConnected size={22} weight="bold" /></div>
          <div>
            The live feed connects once Supabase keys are set.
            <br />
            <span className="tiny" style={{ color: "var(--ink-3)" }}>Fill .env, run the schema, restart. Demo logins work meanwhile.</span>
          </div>
        </div>
      )}

      {items && (
        <div className="bridge-feed">
          {items.slice(0, 6).map((p, i) => (
            <div key={i} className="bf-item">
              <span className="cat-dot" style={{ background: CAT_COLOR[p.category] || CAT_COLOR.other }} />
              <span className="bf-t">{p.title}</span>
              <span className="bf-m">
                {CAT_LABEL[p.category] || "Other"} · <b>▲{p.votes ?? 0}</b>
              </span>
            </div>
          ))}
          <div className="bridge-foot">
            <span className="tiny" style={{ color: "var(--ink-3)" }}>Latest submissions across Jharkhand</span>
            <Link href="/login" className="tiny" style={{ color: "var(--saffron-hi)", fontWeight: 700 }}>See them all</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Role dossier: selector list + animated detail panel ---------- */
const ROLE_ICONS = { citizen: User, university: GraduationCap, industry: Factory, admin: Bank };

export function RoleDossier() {
  const [role, setRole] = useState("citizen");

  const roles = [
    {
      id: "citizen", icon: "citizen", name: "Citizen", tag: "Report and track",
      intro: "Raise the problems you see, with a photo and location. Vote to push what matters most up the queue, and follow your report through every stage to resolution.",
      points: [
        "Report in plain language, from any district of Jharkhand",
        "Vote on problems that match yours, so they surface faster",
        "Track each stage: classified, routed, proposed, resolved",
      ],
    },
    {
      id: "university", icon: "university", name: "University", tag: "Solve routed problems",
      intro: "Problems arrive matched to your department's domain. Form a faculty-student team, scope a project, and submit a costed proposal the portal tracks for you.",
      points: [
        "Receive problems classified into your domain of expertise",
        "Propose with a team, a budget and a timeline",
        "Turn live civic data into funded, credit-bearing projects",
      ],
    },
    {
      id: "industry", icon: "industry", name: "Industry / CSR", tag: "Fund and mentor",
      intro: "Browse proposals already scoped by universities, fund the ones in your focus areas, and mentor teams through delivery. Outcomes are tracked, not promised.",
      points: [
        "Filter proposals by district, domain and ask",
        "Fund or mentor through a tracked commitment",
        "Report social-impact outcomes from real resolutions",
      ],
    },
    {
      id: "admin", icon: "admin", name: "Government", tag: "Oversee everything",
      intro: "District-wide analytics, routing oversight and lifecycle approvals, with a full audit trail of every action taken on every problem.",
      points: [
        "See priority heat across all 24 districts on the map",
        "Approve, return or redirect proposals at any stage",
        "Every action leaves an audit trail entry",
      ],
    },
  ];

  const active = roles.find((r) => r.id === role);
  const ActiveIcon = ROLE_ICONS[active.icon];

  return (
    <div className="dossier">
      <div className="d-list" role="tablist" aria-label="Portal roles">
        {roles.map((r) => {
          const Ic = ROLE_ICONS[r.icon];
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={role === r.id}
              className={"d-item" + (role === r.id ? " on" : "")}
              onClick={() => setRole(r.id)}
            >
              <span className="di-ic"><Ic size={20} weight="duotone" /></span>
              <span>
                <b>{r.name}</b>
                <span>{r.tag}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="dossier-panel" role="tabpanel">
        <div className="dp-anim" key={role}>
          <div className="dp-head">
            <span className="dp-ic"><ActiveIcon size={24} weight="fill" /></span>
            <h3>{active.name}</h3>
          </div>
          <p className="dp-sub">{active.intro}</p>
          <div className="dp-points">
            {active.points.map((pt) => (
              <div key={pt} className="pp">
                <Check size={15} weight="bold" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
          <div className="dp-cta">
            <Link href={"/login?role=" + active.id} className="l-ghost">
              Open the {active.name.split(" ")[0].toLowerCase()} view
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
