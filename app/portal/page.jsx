"use client";

/* ════════════════════════════════════════════════════════════════
   SETU Portal — one route, four role shells (citizen / university /
   industry / admin). Real Supabase data. Live AI pipeline on submit.
   ════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Shell, Modal, ToastStack, useToasts, ProblemRow, ProblemMap, Stepper,
  CATS, CAT_LABEL, CAT_EMOJI, STATUS_FLOW, STATUS_LBL, DISTRICTS, fmtINR, initials,
} from "@/components/ui";

const ICON = {
  home: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M9 5h6M8 3h8v18H8zM11 8h2M11 12h2M11 16h2"/>',
  map: '<path d="M1 6h22M3 6v14h18V6M7 11h.01M11 11h.01M15 11h.01M7 15h.01M11 15h.01M15 15h.01"/>',
  inbox: '<path d="M4 4h16v12H8l-4 4z"/>',
  doc: '<path d="M8 3h8l4 4v14H8zM12 8v8M9 12h6"/>',
  team: '<circle cx="9" cy="11" r="3"/><circle cx="17" cy="13" r="3"/><path d="M3 21v-1c0-2 2-4 5-4s5 2 5 4v1M14 21v-1c0-1.5.7-2.8 1.8-3.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  heart: '<path d="M12 21C7 17 3 13.5 3 9.5S6 3 9.5 3c1.8 0 3.4.9 4.5 2.3C15.1 3.9 16.7 3 18.5 3 22 3 24 6 24 9.5S17 17 12 21z"/>',
  chart: '<path d="M3 13h4l3 7 4-16 3 9h4"/>',
  road: '<path d="M22 12h-4l-3 8-3-16-3 8H2"/>',
  bell: '<path d="M4 4h16v12H8l-4 4zM8 9h8M8 13h5"/>',
};

export default function Portal() {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();
  const [user, setUser] = useState(null);        // users-table row
  const [authUser, setAuthUser] = useState(null);
  const [view, setView] = useState("dash");
  const [problems, setProblems] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [interests, setInterests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackId, setTrackId] = useState(null);
  const [mapCat, setMapCat] = useState("all");
  const [admFilter, setAdmFilter] = useState("all");
  const [admQuery, setAdmQuery] = useState("");
  const [votedIds, setVotedIds] = useState(new Set());

  /* ─── load session + data ─── */
  const loadAll = useCallback(async (u) => {
    const sb = supabase();
    const [pb, pr, inr, nt, vd] = await Promise.all([
      sb.from("problems").select("*, routed_to_user:users!problems_routed_to_fkey(name), submitted_by_user:users!problems_submitted_by_fkey(name)").order("created_at", { ascending: false }).limit(200),
      sb.from("proposals").select("*, problem:problems(title,category,district,status)").order("created_at", { ascending: false }).limit(100),
      sb.from("industry_interest").select("*, proposal:proposals(*, problem:problems(title,category,district,status))").order("created_at", { ascending: false }).limit(100),
      sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(30),
      u ? sb.from("problem_votes").select("problem_id").eq("user_id", u.id) : Promise.resolve({ data: [] }),
    ]);
    setProblems(pb.data || []);
    setProposals(pr.data || []);
    setInterests(inr.data || []);
    setNotifications(nt.data || []);
    setVotedIds(new Set((vd.data || []).map((v) => v.problem_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const { data: { user: au } } = await sb.auth.getUser();
      if (!au) { router.push("/login"); return; }
      setAuthUser(au);
      const { data: profile } = await sb.from("users").select("*").eq("auth_id", au.id).maybeSingle();
      let prof = profile;
      if (!prof) {
        try {
          const res = await fetch("/api/profile");
          const j = await res.json();
          if (j?.ok && j?.profile) {
            prof = j.profile;
          }
        } catch {}
      }
      if (!prof) {
        const { data: byEmail } = await sb.from("users").select("*").eq("email", au.email).maybeSingle();
        prof = byEmail;
      }
      if (!prof) { push("No profile", "Ask the admin to add you, or sign up again", "warn", 6000); router.push("/login"); return; }
      setUser(prof);
      loadAll(prof);
    })();
  }, []);

  /* ─── helpers ─── */
  const problemWithMeta = (p) => ({
    ...p,
    votes: (p.votes ?? p.demo_votes ?? 0),
    routed_to_name: p.routed_to_user ? (Array.isArray(p.routed_to_user) ? p.routed_to_user[0]?.name : p.routed_to_user.name) : null,
    viewer_voted: votedIds.has(p.id),
  });

  const role = user?.role;
  const myProblems = problems.filter((p) => p.submitted_by === user?.id);
  const routedToMe = problems.filter((p) => p.routed_to === user?.id);
  const myProposals = proposals.filter((p) => p.university_id === user?.id);
  const myInterests = interests.filter((i) => i.industry_id === user?.id);

  async function vote(pid) {
    if (!user) return;
    const r = await fetch("/api/vote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem_id: pid, user_id: user.id }),
    });
    const j = await r.json();
    if (j.ok) {
      setVotedIds((s) => { const n = new Set(s); j.voted ? n.add(pid) : n.delete(pid); return n; });
      setProblems((ps) => ps.map((p) => p.id === pid ? { ...p, demo_votes: Math.max(0, (p.demo_votes || 0) + (j.voted ? 1 : -1)) } : p));
      push(j.voted ? "Vote added" : "Vote removed", j.voted ? "Priority weight increased" : "", "ok", 2200);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  /* ─── loading state ─── */
  if (loading || !user) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "var(--paper)" }}>
        <div style={{ textAlign: "center" }}>
          <div className="brand" style={{ justifyContent: "center", marginBottom: 14 }}><span className="brand-mark">सेतु</span><b>SETU Portal</b></div>
          <p className="mono">{loading ? "LOADING PORTAL…" : "REDIRECTING…"}</p>
        </div>
      </div>
    );
  }

  /* ═══════════ CITIZEN ═══════════ */
  if (role === "citizen") {
    return (
      <CitizenPortal
        user={user} problems={problems} myProblems={myProblems} notifications={notifications}
        proposals={proposals} interests={interests}
        votedIds={votedIds} onVote={vote} onSignOut={signOut} push={push}
        setProblems={setProblems} loadAll={() => loadAll(user)} router={router}
        view={view} setView={setView} trackId={trackId} setTrackId={setTrackId}
        mapCat={mapCat} setMapCat={setMapCat} problemWithMeta={problemWithMeta}
      />
    );
  }

  /* ═══════════ UNIVERSITY ═══════════ */
  if (role === "university") {
    return (
      <UniversityPortal
        user={user} routedToMe={routedToMe} myProposals={myProposals} interests={interests}
        onSignOut={signOut} push={push} loadAll={() => loadAll(user)}
        view={view} setView={setView} trackId={trackId} setTrackId={setTrackId} problems={problems}
      />
    );
  }

  /* ═══════════ INDUSTRY ═══════════ */
  if (role === "industry") {
    return (
      <IndustryPortal
        user={user} proposals={proposals} myInterests={myInterests} interests={interests}
        onSignOut={signOut} push={push} loadAll={() => loadAll(user)}
        view={view} setView={setView} trackId={trackId} setTrackId={setTrackId} problems={problems}
      />
    );
  }

  /* ═══════════ ADMIN ═══════════ */
  return (
    <AdminPortal
      user={user} problems={problems} proposals={proposals} interests={interests} notifications={notifications}
      onSignOut={signOut} view={view} setView={setView} trackId={trackId} setTrackId={setTrackId}
      admFilter={admFilter} setAdmFilter={setAdmFilter} admQuery={admQuery} setAdmQuery={setAdmQuery}
    />
  );
}

/* ═══════════════════ CITIZEN ═══════════════════ */
function CitizenPortal({ user, problems, myProblems, notifications, proposals, interests, votedIds, onVote, onSignOut, push, setProblems, loadAll, view, setView, trackId, setTrackId, mapCat, setMapCat, problemWithMeta }) {
  const [geo, setGeo] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", district: user?.district || "Ranchi", address: "" });
  const [busy, setBusy] = useState(false);
  const [autoWriting, setAutoWriting] = useState(false);
  const [aiState, setAiState] = useState(null); // {steps, verdict}
  const [photoName, setPhotoName] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const openNearby = problems.filter((p) => p.status !== "resolved" && p.district === form.district).slice(0, 6);

  const NAV = [
    ["dash", "Home", ICON.home],
    ["submit", "Report problem", ICON.plus],
    ["track", "My problems", ICON.list, myProblems.length],
    ["map", "Live map", ICON.map],
  ];

  async function autoDescribe() {
    if (!form.title.trim()) {
      push("Title missing", "Please write a short title first so the AI knows what to describe.", "warn");
      return;
    }
    setAutoWriting(true);
    try {
      const res = await fetch("/api/suggest-description", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title }),
      });
      const j = await res.json();
      if (j.ok && j.description) {
        setForm({ ...form, description: j.description });
      } else {
        throw new Error(j.error || "Failed to auto-write");
      }
    } catch (e) {
      push("AI failed", e.message, "warn");
    } finally {
      setAutoWriting(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { push("Missing fields", "Title and description are required", "warn"); return; }
    setBusy(true);
    setAiState({ steps: { class: "active", dedup: "", prio: "", route: "" }, verdict: null });

    /* animate steps locally while the API runs the real pipeline */
    const timers = [];
    timers.push(setTimeout(() => setAiState((s) => ({ ...s, steps: { ...s.steps, class: "active" } })), 0));
    timers.push(setTimeout(() => setAiState((s) => ({ ...s, steps: { ...s.steps, class: "done", dedup: "active" } })), 900));
    timers.push(setTimeout(() => setAiState((s) => ({ ...s, steps: { ...s.steps, dedup: "done", prio: "active" } })), 1800));
    timers.push(setTimeout(() => setAiState((s) => ({ ...s, steps: { ...s.steps, prio: "done", route: "active" } })), 2600));

    let photo_url = null;
    if (photoFile) {
      try {
        const sb = supabase();
        const ext = ((photoFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg").slice(0, 5);
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await sb.storage.from("problems").upload(path, photoFile);
        if (!upErr) {
          const { data: pub } = sb.storage.from("problems").getPublicUrl(path);
          photo_url = pub?.publicUrl || null;
        }
      } catch { /* Storage unreachable — submit without the photo */ }
      if (!photo_url) push("Photo skipped", "Supabase Storage not reachable — submitting without the photo", "warn", 3500);
    }
    try {
      const r = await fetch("/api/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, latitude: geo ? geo.lat : null, longitude: geo ? geo.lng : null, submitted_by: user.id, photo_url }),
      });
      const j = await r.json();
      timers.forEach(clearTimeout);
      if (!j.ok) throw new Error(j.error);

      if (j.duplicate) {
        setAiState({
          steps: { class: "done", dedup: "done", prio: "done", route: "done" },
          verdict: {
            warn: true,
            title: "Duplicate detected — merged, not multiplied",
            body: `Your report matches "${j.matched_title}" (${Math.round(j.score * 100)}% text similarity, same area). Instead of a new ticket, it was added as a +1 vote. One problem, one team, no runaround.`,
            cta: { label: "Track the original ticket", onClick: () => { setTrackId(j.problem_id); setView("track"); } },
          },
        });
        push("Duplicate detected & merged", `Merged as vote on "${j.matched_title.slice(0, 30)}…"`, "ok", 5000);
      } else {
        const uni = problems.find((p) => p.routed_to_university);
        setAiState({
          steps: { class: "done", dedup: "done", prio: "done", route: "done" },
          verdict: {
            title: "Ticket created & routed",
            body: `Category ${CAT_LABEL[j.category] || j.category} · priority ${j.priority}/10 (${j.hits?.join(", ") || "no urgency keywords"}) · routed via ${j.engine === "groq" ? "Groq Llama" : "explainable keyword engine"}.`,
            cta: { label: "Track my ticket", onClick: () => { setTrackId(j.problem_id); setView("track"); } },
          },
        });
        push("Problem submitted & routed", `Category: ${CAT_LABEL[j.category]} · Priority ${j.priority}`, "ok", 5000);
      }
      await loadAll();
      setForm({ title: "", description: "", district: form.district, address: "" });
      setPhotoName(null);
      setPhotoFile(null);
    } catch (e2) {
      timers.forEach(clearTimeout);
      setAiState(null);
      push("Submission failed", e2.message, "warn", 6000);
    } finally {
      setBusy(false);
    }
  }

  function detectGeo() {
    if (!navigator.geolocation) { setGeo({ lat: 23.35 + Math.random() * 0.1, lng: 85.3 + Math.random() * 0.08, approx: true }); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, approx: false });
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
          const data = await res.json();
          if (data && data.display_name) setForm((f) => ({ ...f, address: data.display_name }));
        } catch (e) { console.error("Geocoding failed", e); }
      },
      () => setGeo({ lat: 23.35 + Math.random() * 0.1, lng: 85.3 + Math.random() * 0.08, approx: true }),
      { timeout: 4000 }
    );
  }

  const trackProblem = (myProblems.find((p) => p.id === trackId) || problems.find((p) => p.id === trackId) || myProblems[0]);

  return (
    <Shell
      user={user} roleName="Citizen" active={view}
      navItems={NAV} onNav={setView} onExit={onSignOut}
      title={view === "dash" ? `Namaskar, ${user.name.split(" ")[0]} 👋` : view === "submit" ? "Report a problem" : view === "track" ? "My problems" : "Live problem map"}
      sub={view === "dash" ? "Every problem you report moves through a live pipeline." : view === "submit" ? "The AI engine classifies, de-duplicates, scores and routes it — while you watch." : view === "track" ? "Full lifecycle tracking — every stage visible, every actor named." : "Every open problem across Jharkhand. Size = priority."}
    >
      {view === "dash" && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 22 }}>
            <Kpi label="Reported by you" val={myProblems.length} sub="since you joined" />
            <Kpi label="In pipeline" val={myProblems.filter((p) => p.status !== "resolved").length} sub="being worked on" />
            <Kpi label="Resolved" val={myProblems.filter((p) => p.status === "resolved").length} sub="with proof of work" />
            <Kpi label="Community votes earned" val={myProblems.reduce((a, p) => a + (p.demo_votes || 0), 0)} sub="across your reports" />
          </div>
          <div className="grid split-15">
            <div>
              <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
                <div className="map-head">
                  <h4>Problems near you · {form.district}</h4>
                </div>
                <ProblemMap problems={problems.filter((p) => p.district === form.district)} onSelect={(p) => { setTrackId(p.id); setView("track"); }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 12px" }}>Open problems in {form.district} — add your vote</h3>
              <div className="card">
                {openNearby.length ? openNearby.map((p) => <ProblemRow key={p.id} problem={problemWithMeta(p)} viewerRole="citizen" onVote={onVote} onTrack={(x) => { setTrackId(x.id); setView("track"); }} />) : <Empty msg="No open problems in your district right now." />}
              </div>
            </div>
            <div>
              <button className="btn btn-green btn-lg btn-block" style={{ marginBottom: 18 }} onClick={() => setView("submit")}>＋ Report a problem</button>
              <div className="card card-pad" style={{ marginBottom: 18 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>What happens after you submit?</h4>
                <p className="small muted" style={{ marginBottom: 14 }}>Our AI engine runs instantly — you see it live.</p>
                <div className="tl">
                  {[["Classified & scored", "Category, priority and duplicate check in seconds."],
                    ["Routed to a university", "Matched to a department with the right expertise."],
                    ["Team proposes", "Faculty + students design the intervention."],
                    ["Funded & delivered", "Industry/CSR funds it. You track it to resolution."]].map(([t, d]) => (
                    <div key={t} className="tl-item"><div className="tl-t">{t}</div><p>{d}</p></div>
                  ))}
                </div>
              </div>
              <NotifLog items={notifications} />
            </div>
          </div>
        </>
      )}

      {view === "submit" && (
        <div className="grid split-15">
          <div className="card card-pad">
            <form onSubmit={submit}>
              <Field label="Title" required>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Hand pump broken near the school since 3 weeks" maxLength={120} required />
              </Field>
              <Field label={<span style={{display: 'flex', alignItems: 'center', gap: '10px'}}>Describe the problem <button type="button" onClick={autoDescribe} disabled={autoWriting} className="btn btn-sm btn-ghost" style={{padding: '2px 8px', fontSize: 12, border: '1px solid var(--line-2)'}}>✨ {autoWriting ? "Writing..." : "AI Auto-write"}</button></span>} hint="In any simple words, Hindi or English" required>
                <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is broken, since when, who is affected, and what help you need…" required />
              </Field>
              <Field label="Exact Address" hint="Optional">
                <input className="input" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Near Panchayat Bhavan, Ward 4" />
              </Field>
              <div className="form-grid">
                <Field label="District">
                  <select className="select" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                    {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Location" hint="Auto-detect or approximate">
                  <button type="button" className={"geo-pill" + (geo ? " live" : "")} onClick={detectGeo}>
                    <span>📍</span><span>{geo ? `${geo.approx ? "Map approx" : "GPS"} · ${geo.lat.toFixed(3)}, ${geo.lng.toFixed(3)}` : "Detect my location"}</span>
                  </button>
                </Field>
              </div>
              <Field label="Photo" hint="Optional — helps teams see the problem">
                <label className="photo-drop">
                  <span className="pd-ico">📷</span>
                  <span>{photoName ? `✓ ${photoName}` : "Tap to attach a photo (uploads to Supabase Storage)"}</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => { setPhotoFile(e.target.files?.[0] || null); setPhotoName(e.target.files?.[0]?.name || null); }} />
                </label>
              </Field>
              <button className="btn btn-green btn-lg btn-block" disabled={busy}>
                {busy ? <><span className="spin" /> Running AI pipeline…</> : "Submit and run the AI pipeline"}
              </button>
              <p className="tiny faint" style={{ marginTop: 10, textAlign: "center" }}>By submitting you agree the report may be shared with partner universities and government departments.</p>
            </form>
          </div>
          <div>
            <AiPanel state={aiState} />
            <div className="note-strip green" style={{ marginTop: 16 }}>
              <span>🛈</span>
              <div><b>Try the duplicate engine:</b> submit “<i>The hand pump serving our village has been broken and dry for weeks, we need urgent repair</i>” — the engine will detect it matches an existing ticket nearby and merge your report as a vote instead of creating noise.</div>
            </div>
          </div>
        </div>
      )}

      {view === "track" && (
        <div className="grid split-side">
          <div className="card">
            {(myProblems.length ? myProblems : problems.slice(0, 6)).map((p) => (
              <div key={p.id} className="prow" style={{ cursor: "pointer", background: trackProblem?.id === p.id ? "var(--green-tint)" : undefined }} onClick={() => setTrackId(p.id)}>
                <div className="pr-icon">{CAT_EMOJI[p.category] || "📍"}</div>
                <div className="pr-main">
                  <h4 style={{ fontSize: 13.5 }}>{p.title}</h4>
                  <div className="pr-meta">
                    <span className={"badge st-" + p.status}>{STATUS_LBL[p.status]}</span>
                    <span>{p.district}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            {trackProblem ? (
              <ProblemDetail
                problem={trackProblem}
                proposals={proposals.filter((x) => x.problem_id === trackProblem.id)}
                interests={interests.filter((x) => proposals.some((y) => y.id === x.proposal_id && y.problem_id === trackProblem.id))}
                standalone
              />
            ) : (
              <div className="card"><Empty msg="Nothing yet — report your first problem." /></div>
            )}
          </div>
        </div>
      )}

      {view === "map" && (
        <>
          <div className="filterbar">
            <button className={"fbtn" + (mapCat === "all" ? " on" : "")} onClick={() => setMapCat("all")}>All</button>
            {CATS.map((c) => (
              <button key={c} className={"fbtn" + (mapCat === c ? " on" : "")} onClick={() => setMapCat(c)}>
                <span className={"cat-dot cat-" + c} />{CAT_LABEL[c]}
              </button>
            ))}
            <span className="stat-inline" style={{ marginLeft: "auto" }}>{mapCat === "all" ? problems.length : problems.filter((p) => p.category === mapCat).length} plotted</span>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <ProblemMap problems={mapCat === "all" ? problems : problems.filter((p) => p.category === mapCat)} onSelect={(p) => { setTrackId(p.id); setView("track"); }} />
          </div>
        </>
      )}
    </Shell>
  );
}

/* ═══════════════════ UNIVERSITY ═══════════════════ */
function UniversityPortal({ user, routedToMe, myProposals, interests, onSignOut, push, loadAll, view, setView, trackId, setTrackId, problems }) {
  const [propForm, setPropForm] = useState(null); // problem being proposed on
  const [form, setForm] = useState({ lead: "", team: "", text: "", fund: 240000 });
  const [busy, setBusy] = useState(false);

  const NAV = [
    ["dash", "Inbox", ICON.inbox],
    ["routed", "Routed problems", ICON.list, routedToMe.filter((p) => p.status === "routed").length],
    ["proposals", "My proposals", ICON.doc, myProposals.length],
    ["team", "Team", ICON.team],
  ];

  async function submitProposal(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const team = [form.lead, ...form.team.split(",").map((s) => s.trim()).filter(Boolean)];
      const r = await fetch("/api/proposal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_id: propForm.id, university_id: user.id, team_members: team, proposal_text: form.text, funding_sought: form.fund }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      push("Proposal submitted", "Problem status → proposal_submitted · citizen notified (simulated SMS logged)", "ok", 5000);
      setPropForm(null);
      await loadAll();
    } catch (e2) { push("Failed", e2.message, "warn"); } finally { setBusy(false); }
  }

  return (
    <Shell
      user={user} roleName="University" expertise={user.domain_expertise} active={view}
      navItems={NAV} onNav={setView} onExit={onSignOut}
      title={view === "dash" ? user.name : view === "routed" ? "Routed problems" : view === "proposals" ? "My proposals" : "Department team"}
      sub={view === "dash" ? `Domain expertise: ${(user.domain_expertise || []).map((d) => CAT_LABEL[d] || d).join(" · ")} · auto-routing active` : view === "routed" ? "Matched to your domain expertise. Accept to form a team and propose." : view === "proposals" ? "Live across the lifecycle — with industry engagement on each." : "Faculty and students deployable on live civic problems."}
    >
      {view === "dash" && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 22 }}>
            <Kpi label="Routed to you" val={routedToMe.length} sub="auto-matched to your domain" />
            <Kpi label="Awaiting proposal" val={routedToMe.filter((p) => p.status === "routed").length} sub="in your review queue" />
            <Kpi label="Proposals live" val={myProposals.length} sub="across districts" />
            <Kpi label="Funding sought" val={fmtINR(myProposals.reduce((a, p) => a + (p.funding_sought || 0), 0))} sub="via industry partners" />
          </div>
          <div className="grid split-14">
            <div className="card">
              <div className="map-head"><h4>Review queue — routed to {user.name}</h4><span className="mono" style={{ marginLeft: "auto" }}>DOMAIN MATCH · LEAST-LOADED ROUTING</span></div>
              {routedToMe.length ? routedToMe.slice(0, 8).map((p) => <ProblemRow key={p.id} problem={{ ...p, votes: p.demo_votes || 0 }} viewerRole="university" onPropose={(x) => { setPropForm(x); setForm({ ...form, lead: "Dr. " }); }} />) : <Empty msg="No problems routed yet — the engine is watching." />}
            </div>
            <div>
              <div className="card card-pad" style={{ marginBottom: 18 }}>
                <div className="mono" style={{ marginBottom: 12 }}>WHY PROBLEMS ARRIVE HERE</div>
                <p className="small muted" style={{ lineHeight: 1.6, marginBottom: 4 }}>
                  The router matches classified category → your declared <b>domain_expertise[]</b>, then picks the <b>least-loaded</b> matching department. You are currently tracking <b>{routedToMe.filter((p) => p.status !== "resolved").length} open</b>.
                </p>
                <div className="hr" />
                <div className="mono" style={{ marginBottom: 8 }}>YOUR DOMAIN MAP</div>
                {(user.domain_expertise || []).map((d) => (
                  <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                    <span className={"cat-dot cat-" + d} />
                    <span className="small" style={{ fontWeight: 600 }}>{CAT_LABEL[d] || d}</span>
                    <span className="tiny faint" style={{ marginLeft: "auto" }}>{routedToMe.filter((p) => p.category === d).length} routed</span>
                  </div>
                ))}
              </div>
              <div className="card card-pad">
                <div className="mono" style={{ marginBottom: 12 }}>LIVE PROPOSALS &amp; INDUSTRY INTEREST</div>
                {myProposals.slice(0, 5).map((pr) => {
                  const ints = interests.filter((i) => i.proposal_id === pr.id);
                  return (
                    <div key={pr.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-2)" }}>
                      <div className="small" style={{ fontWeight: 700 }}>{pr.problem?.title || "—"}</div>
                      <div className="tiny muted" style={{ margin: "3px 0 6px" }}>{fmtINR(pr.funding_sought)} sought · <span className={"badge st-" + pr.status}>{pr.status}</span></div>
                      {ints.length ? <div className="tiny" style={{ color: "var(--green)", fontWeight: 600 }}>🤝 {ints.map((i) => i.industry?.name || "partner").join(", ")} interested</div> : <div className="tiny faint">No industry interest yet</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {view === "routed" && (
        <div className="card">
          {routedToMe.length ? routedToMe.map((p) => <ProblemRow key={p.id} problem={{ ...p, votes: p.demo_votes || 0 }} viewerRole="university" onPropose={(x) => { setPropForm(x); setForm({ ...form, lead: "Dr. " }); }} />) : <Empty msg="No problems routed yet." />}
        </div>
      )}

      {view === "proposals" && (
        <div className="card">
          {myProposals.length ? myProposals.map((pr) => {
            const ints = interests.filter((i) => i.proposal_id === pr.id);
            return (
              <div key={pr.id} className="prow" style={{ gridTemplateColumns: "auto 1fr" }}>
                <span className={"badge st-" + pr.status}>{pr.status}</span>
                <div className="pr-main">
                  <h4>{pr.problem?.title || "—"}</h4>
                  <div className="pr-meta">
                    <span className="chip">{fmtINR(pr.funding_sought)} sought</span>
                    <span>submitted {new Date(pr.created_at).toLocaleDateString("en-IN")}</span>
                  </div>
                  <p className="pr-desc">{pr.proposal_text}</p>
                  <div className="pr-foot">
                    <div className="team-chips">{(pr.team_members || []).map((m) => <span key={m} className="member"><span className="av">{initials(m)}</span>{m}</span>)}</div>
                  </div>
                  {ints.length > 0 && (
                    <div className="pr-foot">{ints.map((i) => <span key={i.id} className="dupe-note" style={{ background: "var(--green-tint)", color: "var(--green-2)", border: "none", fontWeight: 600 }}>🤝 {i.industry?.name || "Partner"} · {i.interest_type}</span>)}</div>
                  )}
                </div>
              </div>
            );
          }) : <Empty msg="No proposals yet — open your routed problems queue." />}
        </div>
      )}

      {view === "team" && (
        <TeamRegistry expertise={user.domain_expertise} />
      )}

      {propForm && (
        <Modal title="Form a team & propose" onClose={() => setPropForm(null)}>
          <div className="note-strip" style={{ marginBottom: 18 }}><span>📄</span><div><b>{propForm.title}</b> · {CAT_LABEL[propForm.category]} · {propForm.district} · priority {(propForm.priority_score || 0).toFixed(1)}</div></div>
          <form onSubmit={submitProposal}>
            <Field label="Faculty lead"><input className="input" value={form.lead} onChange={(e) => setForm({ ...form, lead: e.target.value })} placeholder="Dr. S. Verma" required /></Field>
            <Field label="Team members" hint="Comma separated — faculty + students"><input className="input" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} placeholder="A. Kisku (PhD), R. Ojha (MTech), S. Lakra (BSc-4)" /></Field>
            <Field label="Approach / proposal text"><textarea className="textarea" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Intervention design, timeline, community involvement, handover plan…" required /></Field>
            <Field label="Funding sought (₹)"><input className="input" type="number" min="10000" step="10000" value={form.fund} onChange={(e) => setForm({ ...form, fund: +e.target.value })} /></Field>
            <button className="btn btn-green btn-block" disabled={busy}>{busy ? <><span className="spin" /> Submitting…</> : "Submit proposal"}</button>
          </form>
        </Modal>
      )}
    </Shell>
  );
}

/* ═══════════════════ INDUSTRY ═══════════════════ */
function IndustryPortal({ user, proposals, myInterests, interests, onSignOut, push, loadAll, view, setView, trackId, setTrackId, problems }) {
  const [intForm, setIntForm] = useState(null);
  const [form, setForm] = useState({ type: "funding", msg: "" });
  const [busy, setBusy] = useState(false);

  const focus = user.focus_areas || [];
  const sorted = proposals.slice().sort((a, b) => {
    const fa = focus.includes(a.problem?.category) ? -1 : 1;
    const fb = focus.includes(b.problem?.category) ? -1 : 1;
    return fa - fb;
  });

  const NAV = [
    ["dash", "Discover", ICON.search],
    ["problems", "All problems", ICON.list],
    ["interests", "My engagements", ICON.heart, myInterests.length],
  ];

  async function submitInterest(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/interest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: intForm.id, industry_id: user.id, interest_type: form.type, message: form.msg }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      push("Interest expressed", "University team + government admin notified (in-app)", "ok", 4200);
      setIntForm(null);
      await loadAll();
    } catch (e2) { push("Failed", e2.message, "warn"); } finally { setBusy(false); }
  }

  return (
    <Shell
      user={user} roleName="Industry / CSR" active={view}
      navItems={NAV} onNav={setView} onExit={onSignOut}
      title={view === "dash" ? user.name : view === "problems" ? "All Civic Problems" : "My engagements"}
      sub={view === "dash" ? `Focus areas: ${focus.map((f) => CAT_LABEL[f] || f).join(" • ") || "not set"} • new-proposal alerts on` : view === "problems" ? "Browse raw civic problems reported across the state before universities propose solutions." : "Portfolio of funded and mentored civic projects."}
    >
      {view === "dash" && (
        <>
          <div className="note-strip green" style={{ marginBottom: 18 }}><span>🎯</span><div><b>Sorted for you:</b> proposals matching <b>{focus.map((f) => CAT_LABEL[f] || f).join(", ") || "your focus areas"}</b> appear first — the same matching engine that routes citizen problems.</div></div>
          <div className="grid cols-2">
            {sorted.map((pr) => {
              const ints = interests.filter((i) => i.proposal_id === pr.id);
              const mine = ints.some((i) => i.industry_id === user.id);
              const prob = pr.problem || {};
              return (
                <div key={pr.id} className="card card-hover card-pad">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                    <span className="chip"><span className={"cat-dot cat-" + prob.category} />{CAT_LABEL[prob.category] || "Other"}</span>
                    <span className={"badge st-" + pr.status}>{pr.status}</span>
                    {focus.includes(prob.category) && <span className="badge" style={{ background: "var(--green-tint)", color: "var(--green)" }}>FOCUS MATCH</span>}
                    <span className="mono" style={{ marginLeft: "auto", fontSize: 10 }}>{prob.district}</span>
                  </div>
                  <h4 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{prob.title || "—"}</h4>
                  <p className="small muted" style={{ lineHeight: 1.55, marginBottom: 12 }}>{pr.proposal_text?.slice(0, 220)}…</p>
                  <div className="team-chips" style={{ marginBottom: 14 }}>
                    {(pr.team_members || []).slice(0, 3).map((m) => <span key={m} className="member"><span className="av">{initials(m)}</span>{m}</span>)}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="chip" style={{ fontSize: 12.5 }}>{fmtINR(pr.funding_sought)} sought</span>
                    <span className="tiny muted">{pr.university?.name || ""}</span>
                  </div>
                  <div className="hr" style={{ margin: "14px 0 12px" }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {mine ? <span className="badge st-approved" style={{ height: 30, display: "inline-flex", alignItems: "center" }}>✓ INTEREST EXPRESSED</span> : <button className="btn btn-green btn-sm" onClick={() => setIntForm(pr)}>Express interest</button>}
                    {ints.length > 0 && <span className="tiny muted" style={{ alignSelf: "center" }}>{ints.length} partner{ints.length > 1 ? "s" : ""} interested</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "problems" && (
        <div className="card">
          {problems.map((p) => (
            <div key={p.id} className="prow" style={{ gridTemplateColumns: "auto 1fr auto" }}>
              <div className="pr-icon">{CAT_EMOJI[p.category] || "❓"}</div>
              <div className="pr-main">
                <h4>{p.title}</h4>
                <div className="pr-meta"><span>{p.district || "Unknown"}</span><span>{new Date(p.created_at).toLocaleDateString("en-IN")}</span></div>
                <p className="pr-desc">{p.description}</p>
              </div>
              <div className="pr-side"><span className={"badge st-" + p.status}>{STATUS_LBL[p.status] || p.status}</span></div>
            </div>
          ))}
        </div>
      )}

      {view === "interests" && (
        <div className="card">
          {myInterests.length ? myInterests.map((i) => (
            <div key={i.id} className="prow" style={{ gridTemplateColumns: "auto 1fr auto" }}>
              <span className={"badge " + (i.interest_type === "funding" ? "st-in_progress" : "st-routed")}>{i.interest_type}</span>
              <div className="pr-main">
                <h4>{i.proposal?.problem?.title || "—"}</h4>
                <div className="pr-meta"><span>{fmtINR(i.proposal?.funding_sought)} sought</span><span>{new Date(i.created_at).toLocaleDateString("en-IN")}</span></div>
                <p className="pr-desc">{i.message}</p>
              </div>
              <div className="pr-side"><span className={"badge st-" + (i.proposal?.problem?.status || "routed")}>{STATUS_LBL[i.proposal?.problem?.status] || "—"}</span></div>
            </div>
          )) : <Empty msg="No engagements yet — browse proposals to begin." />}
        </div>
      )}

      {intForm && (
        <Modal title="Express interest" onClose={() => setIntForm(null)}>
          <div className="note-strip" style={{ marginBottom: 18 }}><span>🤝</span><div><b>{intForm.problem?.title || ""}</b> · {fmtINR(intForm.funding_sought)} sought</div></div>
          <form onSubmit={submitInterest}>
            <Field label="Interest type">
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="funding">Funding (CSR / PSU budget)</option>
                <option value="mentorship">Mentorship (experts, equipment)</option>
                <option value="both">Funding + mentorship</option>
              </select>
            </Field>
            <Field label="Message to the team"><textarea className="textarea" style={{ minHeight: 80 }} value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} placeholder="We can fund this fully under our community program…" /></Field>
            <button className="btn btn-green btn-block" disabled={busy}>{busy ? <><span className="spin" /> Sending…</> : "Send interest"}</button>
          </form>
        </Modal>
      )}
    </Shell>
  );
}

/* ═══════════════════ ADMIN ═══════════════════ */
function AdminPortal({ user, problems, proposals, interests, notifications, onSignOut, view, setView, trackId, setTrackId, admFilter, setAdmFilter, admQuery, setAdmQuery }) {
  const NAV = [
    ["dash", "Overview", ICON.chart],
    ["problems", "All problems", ICON.list],
    ["routing", "Routing audit", ICON.road],
    ["notif", "Notifications", ICON.bell],
  ];
  const byCat = {}, byDistrict = {}, byStatus = {};
  problems.forEach((p) => { byCat[p.category] = (byCat[p.category] || 0) + 1; byDistrict[p.district] = (byDistrict[p.district] || 0) + 1; byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
  const resolved = byStatus.resolved || 0;
  const inProg = (byStatus.in_progress || 0) + (byStatus.proposal_submitted || 0);
  const maxD = Math.max(1, ...Object.values(byDistrict));
  const filtered = problems.filter((p) => (admFilter === "all" || p.status === admFilter) && (!admQuery || (p.title + p.district).toLowerCase().includes(admQuery.toLowerCase())));

  return (
    <Shell
      user={user} roleName="Government" active={view}
      navItems={NAV} onNav={setView} onExit={onSignOut}
      title={view === "dash" ? "Government dashboard" : view === "problems" ? "All problems" : view === "routing" ? "Routing audit" : "Notification log"}
      sub={view === "dash" ? "State-wide pulse: submissions, routing, resolution. Live from Postgres." : view === "problems" ? "Every ticket, every status, full audit columns." : view === "routing" ? "Every auto-routing decision, explainable and challengeable." : "Every SMS/email the system would send — simulated & logged in demo."}
    >
      {view === "dash" && (
        <>
          <div className="grid cols-4" style={{ marginBottom: 20 }}>
            <Kpi label="Total problems" val={problems.length} sub={`across ${Object.keys(byDistrict).length} districts`} />
            <Kpi label="Resolution rate" val={problems.length ? Math.round((resolved / problems.length) * 100) + "%" : "—"} sub="resolved / total · target 40%" />
            <Kpi label="In delivery" val={inProg} sub="proposal → in-progress" />
            <Kpi label="Avg priority" val={problems.length ? (problems.reduce((a, p) => a + (p.priority_score || 0), 0) / problems.length).toFixed(1) : "—"} sub="state-wide mean" />
          </div>
          <div className="grid split-12">
            <div>
              <div className="card chart-card" style={{ marginBottom: 20 }}>
                <div className="ch-head"><h4>Submissions by district</h4><span className="ch-sub">SELECT district, COUNT(*) GROUP BY 1</span></div>
                {Object.entries(byDistrict).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
                  <div key={d} className="bar-row"><span className="bl">{d}</span><div className="bar"><i style={{ width: (n / maxD) * 100 + "%" }} /></div><span className="bv">{n}</span></div>
                ))}
              </div>
              <div className="card chart-card">
                <div className="ch-head"><h4>Lifecycle funnel</h4><span className="ch-sub">COUNT(*) GROUP BY status</span></div>
                {STATUS_FLOW.map((s, i) => {
                  const n = byStatus[s] || 0;
                  const cum = STATUS_FLOW.slice(0, i + 1).reduce((a, x) => a + (byStatus[x] || 0), 0);
                  const colors = ["#6B6456", "#5D5393", "#93701B", "#B85C14", "#22708A", "#12574A"];
                  return (
                    <div key={s} className="funnel-row">
                      <span style={{ fontWeight: 600 }}>{STATUS_LBL[s]}</span>
                      <div className="bar"><i style={{ width: (cum / Math.max(1, problems.length)) * 100 + "%", background: colors[i] }} /></div>
                      <span className="pct">{n} · {Math.round((cum / Math.max(1, problems.length)) * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="card chart-card" style={{ marginBottom: 20 }}>
                <div className="ch-head"><h4>Category mix</h4><span className="ch-sub">DONUT</span></div>
                <Donut counts={byCat} />
              </div>
              <div className="card card-pad">
                <div className="mono" style={{ marginBottom: 12 }}>HEATLIST · TOP PRIORITY</div>
                {problems.slice().sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)).slice(0, 5).map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <span className={"cat-dot cat-" + p.category} style={{ width: 9, height: 9 }} />
                    <span className="small" style={{ flex: 1, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</span>
                    <b className="mono-ink" style={{ fontSize: 13, color: "var(--saffron)" }}>{(p.priority_score || 0).toFixed(1)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {view === "problems" && (
        <>
          <div className="filterbar">
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
              <input placeholder="Search title or district…" value={admQuery} onChange={(e) => setAdmQuery(e.target.value)} />
            </div>
            <button className={"fbtn" + (admFilter === "all" ? " on" : "")} onClick={() => setAdmFilter("all")}>All</button>
            {STATUS_FLOW.map((s) => <button key={s} className={"fbtn" + (admFilter === s ? " on" : "")} onClick={() => setAdmFilter(s)}>{STATUS_LBL[s]}</button>)}
          </div>
          <div className="card"><div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Ticket</th><th>Title</th><th>Category</th><th>District</th><th>Status</th><th>Prio</th><th>Votes</th><th>Age</th></tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} style={{ cursor: "pointer" }}>
                    <td className="mono-ink tiny">{p.id.slice(0, 8)}</td>
                    <td style={{ maxWidth: 280, fontWeight: 600 }}>{p.title}</td>
                    <td><span className="chip" style={{ height: 22 }}><span className={"cat-dot cat-" + p.category} />{CAT_LABEL[p.category]}</span></td>
                    <td>{p.district}</td>
                    <td><span className={"badge st-" + p.status}>{STATUS_LBL[p.status]}</span></td>
                    <td><b className="mono-ink">{(p.priority_score || 0).toFixed(1)}</b></td>
                    <td>{p.demo_votes || 0}</td>
                    <td className="mono-ink tiny">{Math.max(0, Math.round((Date.now() - new Date(p.created_at)) / 864e5))}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {view === "routing" && (
        <>
          <div className="note-strip green" style={{ marginBottom: 18 }}><span>🛡</span><div><b>Explainability guarantee:</b> each row records the category, matched expertise and load at routing time. Any citizen or department can challenge a decision — the audit row is the evidence.</div></div>
          <div className="card"><div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>Ticket</th><th>Category</th><th>Routed to</th><th>Status</th><th>Priority</th></tr></thead>
              <tbody>
                {problems.filter((p) => p.routed_to).map((p) => (
                  <tr key={p.id}>
                    <td className="mono-ink tiny">{p.id.slice(0, 8)}</td>
                    <td><span className="chip" style={{ height: 22 }}><span className={"cat-dot cat-" + p.category} />{CAT_LABEL[p.category]}</span></td>
                    <td style={{ fontWeight: 600 }}>{(Array.isArray(p.routed_to_user) ? p.routed_to_user[0]?.name : p.routed_to_user?.name) || "—"}</td>
                    <td><span className={"badge st-" + p.status}>{STATUS_LBL[p.status]}</span></td>
                    <td><b className="mono-ink">{(p.priority_score || 0).toFixed(1)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </>
      )}

      {view === "notif" && (
        <div className="card">
          {notifications.map((n) => (
            <div key={n.id} className="prow" style={{ gridTemplateColumns: "auto 1fr auto" }}>
              <span className={"badge " + (n.channel === "SMS" ? "st-in_progress" : "st-routed")}>{n.channel}</span>
              <div className="pr-main"><p className="pr-desc" style={{ WebkitLineClamp: 3 }}>{n.text}</p></div>
              <span className="mono-ink tiny faint">{new Date(n.created_at).toLocaleString("en-IN")}</span>
            </div>
          ))}
          <p className="tiny faint" style={{ padding: "10px 20px" }}>Roadmap: Resend (email) + MSG91 (SMS) with production keys. Every message idempotent, logged and auditable.</p>
        </div>
      )}
    </Shell>
  );
}

/* ═══════════════════ shared bits ═══════════════════ */
function Kpi({ label, val, sub }) {
  return <div className="card kpi"><div className="k-label">{label}</div><div className="k-val">{val}</div><div className="k-delta">{sub}</div></div>;
}
function Empty({ msg }) {
  return <div className="empty"><div className="e-ic">🗂</div><p className="small">{msg}</p></div>;
}
function Field({ label, required, hint, children }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="opt">· required</span>}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
function NotifLog({ items }) {
  return (
    <div className="card card-pad">
      <div className="mono" style={{ marginBottom: 10 }}>DEMO · NOTIFICATIONS LOG</div>
      {items.slice(0, 4).map((n) => (
        <div key={n.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-2)" }}>
          <div className="tiny" style={{ fontWeight: 700 }}>{n.channel} · <span className="faint" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{new Date(n.created_at).toLocaleString("en-IN")}</span></div>
          <div className="tiny muted" style={{ marginTop: 2, lineHeight: 1.45 }}>{n.text}</div>
        </div>
      ))}
      <p className="tiny faint" style={{ marginTop: 8 }}>SMS simulated in demo · Resend email + MSG91 on roadmap</p>
    </div>
  );
}

function AiPanel({ state }) {
  const steps = state?.steps || {};
  const verdict = state?.verdict;
  const res = state?.res || {};
  return (
    <div className="ai-panel">
      <div className="ai-head">
        <div className="ai-ic">⚙</div>
        <h4>AI processing engine</h4>
        <span className="mono-ai">GROQ / GEMINI + EXPLAINABLE CORE</span>
      </div>
      <div className="ai-steps">
        {[
          ["class", "Classify", "NLP category detection"],
          ["dedup", "De-duplicate", "Cosine similarity vs nearby tickets"],
          ["prio", "Score priority", "Explainable urgency formula"],
          ["route", "Auto-route", "Match to university expertise"],
        ].map(([id, t, d]) => (
          <div key={id} className={"ai-step " + (steps[id] || "")}>
            <div className="as-dot" />
            <div className="as-t"><b>{t}</b><span>{d}</span></div>
            <div className="as-res">{res[id] || (steps[id] === "done" ? "✓" : steps[id] === "active" ? "…" : "—")}</div>
          </div>
        ))}
      </div>
      <div className="ai-verdict">
        {verdict ? (
          <>
            <div className="v-line"><b style={{ color: verdict.warn ? "#E9C46A" : "#3FA97C" }}>{verdict.warn ? "⚠" : "✓"} {verdict.title}</b></div>
            <div className="v-line" style={{ marginTop: 6 }}>{verdict.body}</div>
            {verdict.cta && <button className="btn btn-green btn-sm" style={{ marginTop: 12 }} onClick={verdict.cta.onClick}>{verdict.cta.label}</button>}
          </>
        ) : (
          <div className="v-line"><span className="mono-ai" style={{ opacity: 0.7 }}>READY</span><span>Submit a problem to watch the pipeline run live — every decision is explainable.</span></div>
        )}
      </div>
    </div>
  );
}

function Donut({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const segs = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c, n]) => { const start = acc; acc += n / total; return { c, n, start, end: acc }; });
  const R = 54, C = 2 * Math.PI * R;
  const colorOf = (c) => {
    const m = { education: "var(--c-edu)", health: "var(--c-health)", agriculture: "var(--c-agri)", water: "var(--c-water)", infrastructure: "var(--c-infra)", environment: "var(--c-env)", other: "var(--c-other)" };
    return m[c] || "var(--c-other)";
  };
  return (
    <div className="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Category mix">
        <g transform="rotate(-90 70 70)">
          {segs.map((s) => (
            <circle key={s.c} cx="70" cy="70" r={R} fill="none" stroke={colorOf(s.c)} strokeWidth="22" strokeDasharray={`${((s.end - s.start) * C).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-s.start * C).toFixed(1)} />
          ))}
        </g>
        <text x="70" y="66" textAnchor="middle" fontFamily="var(--font-display)" fontSize="26" fontWeight="560" fill="var(--ink)">{total}</text>
        <text x="70" y="84" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.5" fill="var(--ink-3)">PROBLEMS</text>
      </svg>
      <div className="donut-legend">
        {segs.map((s) => <div key={s.c} className="dl"><i style={{ background: colorOf(s.c) }} />{CAT_LABEL[s.c]} <b>{s.n}</b></div>)}
      </div>
    </div>
  );
}

function TeamRegistry({ expertise }) {
  const people = [
    ["Dr. S. Verma", "Faculty lead · Water resources", "water"],
    ["A. Kisku", "PhD scholar · Hydrology", "water"],
    ["R. Ojha", "MTech · Environmental eng.", "water"],
    ["S. Lakra", "BSc final year · Field survey", null],
    ["T. Soren", "MA rural development", "education"],
    ["B. Hembram", "BEd · bilingual instruction", "education"],
    ["P. Aind", "MBBS intern · Community health", "health"],
    ["M. Mahto", "MSc · Soil science", "agriculture"],
  ].filter((p) => !expertise?.length || !p[2] || expertise.includes(p[2]));
  return (
    <>
      <div className="grid cols-4">
        {people.map((m) => (
          <div key={m[0]} className="card card-pad card-hover">
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <div className="av-lg" style={{ background: m[2] ? `var(${{ water: "--c-water", education: "--c-edu", health: "--c-health", agriculture: "--c-agri" }[m[2]]})` : "var(--c-edu)" }}>{initials(m[0])}</div>
              <div><b style={{ fontSize: 13.5 }}>{m[0]}</b><div className="tiny muted" style={{ marginTop: 1 }}>{m[1]}</div></div>
            </div>
            {m[2] ? <span className="chip"><span className={"cat-dot cat-" + m[2]} />{CAT_LABEL[m[2]]} domain</span> : <span className="chip">General field support</span>}
          </div>
        ))}
      </div>
      <div className="note-strip" style={{ marginTop: 18 }}><span>🎓</span><div><b>Credit-linked engagement:</b> student participation maps to community-connect credits — solving a real problem is coursework.</div></div>
    </>
  );
}

function ProblemDetail({ problem: p, proposals, interests, standalone }) {
  const uniName = (Array.isArray(p.routed_to_user) ? p.routed_to_user[0]?.name : p.routed_to_user?.name) || null;
  return (
    <div>
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="pr-icon" style={{ width: 52, height: 52, fontSize: 24, borderRadius: 13 }}>{CAT_EMOJI[p.category] || "📍"}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="pr-meta" style={{ marginBottom: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="chip"><span className={"cat-dot cat-" + p.category} />{CAT_LABEL[p.category] || "Other"}</span>
              <span className={"badge st-" + p.status}>{STATUS_LBL[p.status]}</span>
              <span className="mono" style={{ fontSize: 10 }}>{p.id.slice(0, 8)} · {p.district}</span>
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em", marginBottom: 6 }}>{p.title}</h3>
            <p className="small muted" style={{ maxWidth: 560, lineHeight: 1.55 }}>{p.description}</p>
            {p.photo_url && (
              <a href={p.photo_url} target="_blank" rel="noreferrer">
                <img src={p.photo_url} alt="Problem photo" style={{ marginTop: 10, maxWidth: 280, borderRadius: 10, border: "1px solid var(--line)" }} />
              </a>
            )}
          </div>
          <div className="pr-side">
            <div className="pr-prio"><b style={{ fontSize: 15, color: "var(--ink)" }}>{(p.priority_score || 0).toFixed(1)}</b><div className="bar"><i style={{ width: (p.priority_score || 0) * 10 + "%" }} /></div></div>
            <div className="pr-prio" style={{ justifyContent: "flex-end" }}>▲ {p.demo_votes || 0} votes</div>
          </div>
        </div>
        <Stepper status={p.status} />
      </div>
      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="mono" style={{ marginBottom: 14 }}>LIFECYCLE TIMELINE</div>
          <div className="tl">
            <div className="tl-item"><div className="tl-t">Submitted by citizen</div><div className="tl-d">{new Date(p.created_at).toLocaleDateString("en-IN")}</div><p>Reported with photo &amp; GPS location via mobile.</p></div>
            <div className="tl-item"><div className="tl-t">AI: classified, scored, de-duplicated</div><div className="tl-d">+2 sec after submit</div><p>Category <b>{CAT_LABEL[p.category]}</b> · priority {(p.priority_score || 0).toFixed(1)}/10 · unique in area.</p></div>
            <div className={"tl-item " + (["submitted"].includes(p.status) ? "dim" : "")}><div className="tl-t">Routed to university</div><div className="tl-d">{uniName || "pending"}</div><p>Matched on domain expertise · least-loaded routing.</p></div>
            <div className={"tl-item " + (STATUS_FLOW.indexOf(p.status) < 3 ? "dim" : "")}><div className="tl-t">Team formed &amp; proposal submitted</div><div className="tl-d">{proposals.length ? proposals.length + " proposal(s)" : "awaiting"}</div><p>Faculty–student team assembles the intervention.</p></div>
            <div className={"tl-item " + (STATUS_FLOW.indexOf(p.status) < 4 ? "dim" : "")}><div className="tl-t">Industry / CSR engagement</div><div className="tl-d">{interests.length ? interests.length + " partner(s)" : "awaiting"}</div><p>Funding/mentorship discussions.</p></div>
            <div className={"tl-item " + (p.status !== "resolved" ? "dim" : "")}><div className="tl-t">Resolved — citizen notified</div><div className="tl-d">{p.status === "resolved" ? "✔ done" : "pending"}</div><p>SMS + proof-of-work photo.</p></div>
          </div>
        </div>
        <div>
          <div className="card card-pad" style={{ marginBottom: 18 }}>
            <div className="mono" style={{ marginBottom: 12 }}>UNIVERSITY TEAM &amp; PROPOSAL</div>
            {proposals.length ? (
              <>
                <div className="team-chips" style={{ marginBottom: 12 }}>
                  {(proposals[0].team_members || []).map((m) => <span key={m} className="member"><span className="av">{initials(m)}</span>{m}</span>)}
                </div>
                <p className="small muted" style={{ lineHeight: 1.55, marginBottom: 12 }}>{proposals[0].proposal_text}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="chip">{fmtINR(proposals[0].funding_sought)} sought</span>
                  <span className={"badge st-" + proposals[0].status}>{proposals[0].status}</span>
                </div>
              </>
            ) : (
              <p className="small muted">{uniName ? <><b>{uniName}</b> has this in their queue. Teams typically form within 5–7 days.</> : "Awaiting routing."}</p>
            )}
          </div>
          <div className="card card-pad">
            <div className="mono" style={{ marginBottom: 12 }}>EXPLAINABILITY · WHY THIS SCORE</div>
            <div className="mono-ink small" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 9, padding: 12, lineHeight: 1.8 }}>
              priority = 1.0<br />&nbsp;&nbsp;+ urgency_keywords × 1.2<br />&nbsp;&nbsp;+ community_votes × 0.06 (cap 80)<br />&nbsp;&nbsp;+ days_unresolved × 0.05 (cap 60)
            </div>
            <p className="tiny faint" style={{ marginTop: 10 }}>Explainable-by-design — a government system must justify every score to every citizen.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
