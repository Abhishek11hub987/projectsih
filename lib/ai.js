/* ════════════════════════════════════════════════════════════════
   SETU — AI engine (server-side)
   1. Classify  → Groq (Llama) if key, else explainable keyword engine
   2. Dedup     → Gemini embeddings + cosine, else token-similarity
   3. Priority  → transparent formula (always local)
   4. Route     → category ∈ domain_expertise[], least-loaded
   ════════════════════════════════════════════════════════════════ */
import { getAdminClient } from "./supabase.js";

const CATS = ["education", "health", "agriculture", "water", "infrastructure", "environment", "other"];
const CAT_LABEL = { education: "Education", health: "Health", agriculture: "Agriculture", water: "Water", infrastructure: "Infrastructure", environment: "Environment", other: "Other" };

const KEYWORDS = {
  education: ["school", "teacher", "student", "anganwadi", "classroom", "dropout", "itI", "textbook", "toilet", "class 8", "midday", "children"],
  health: ["doctor", "phc", "hospital", "illness", "disease", "health", "medicine", "asha", "patient", "kidney", "pregnan", "ambulance", "meal"],
  agriculture: ["crop", "paddy", "farm", "irrigation", "seed", "acre", "harvest", "soil", "agri", "livestock", "pond desilt", "fis"],
  water: ["hand pump", "handpump", "water", "tube well", "tubewell", "well", "arsenic", "drinking", "pond", "drying", "desilt"],
  infrastructure: ["road", "pothole", "culvert", "bridge", "street light", "streetlight", "embankment", "drain", "sewage", "building", "tower", "network", "electricity", "power", "roof", "leak", "hall", "renovation", "light"],
  environment: ["dust", "mine", "mica", "weed", "waste", "dump", "pollution", "tree", "plantation", "elephant", "forest", "hyacinth", "remediation"],
};
const URGENT = ["urgent", "immediately", "emergency", "ambulance", "collapsed", "breach", "contaminated", "dry", "broken", "washed out", "no doctor", "urgent repair", "children", "pregnan"];
const STOP = new Set(["the", "a", "an", "is", "are", "was", "were", "has", "have", "had", "no", "for", "to", "and", "in", "on", "at", "of", "with", "near", "from", "our", "this", "that", "it", "not", "been", "very", "week", "weeks", "month", "months", "request", "need", "needed", "problem"]);

/* ── classify ── */
export async function classify(text) {
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: "groq/compound",
          messages: [
            { role: "system", content: "Classify this civic problem into exactly one category: education, health, agriculture, water, infrastructure, environment, other. Reply with the single word only." },
            { role: "user", content: text.slice(0, 2000) },
          ],
          temperature: 0,
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const j = await res.json();
        const raw = (j.choices?.[0]?.message?.content || "").trim().toLowerCase();
        // Regex word-boundary match handles "category: water", "water.", "**water**"
        const matched = CATS.find((c) => new RegExp(`\\b${c}\\b`, "i").test(raw));
        if (matched) return { category: matched, engine: "groq", confidence: "high" };
      }
    } catch { /* fall through to local */ }
  }
  const t = text.toLowerCase();
  const scores = {};
  for (const cat in KEYWORDS) {
    let s = 0;
    for (const k of KEYWORDS[cat]) if (t.includes(k)) s += k.includes(" ") ? 2 : 1;
    scores[cat] = s;
  }
  let best = "other", max = 0;
  for (const c in scores) if (scores[c] > max) { max = scores[c]; best = c; }
  return { category: best, engine: "keyword", confidence: max === 0 ? "low" : max >= 4 ? "high" : "medium" };
}

/* ── embeddings (Gemini) ── */
export async function embed(text) {
  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text: text.slice(0, 4000) }] } }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.embedding?.values) return { vector: j.embedding.values, engine: "gemini" };
      }
    } catch { /* fall through */ }
  }
  return { vector: null, engine: "none" };
}

/* ── local dedup helpers ── */
const tokens = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
function cosine(a, b) {
  const fa = {}, fb = {};
  a.forEach((w) => (fa[w] = (fa[w] || 0) + 1)); b.forEach((w) => (fb[w] = (fb[w] || 0) + 1));
  let dot = 0, na = 0, nb = 0;
  for (const w in fa) { na += fa[w] * fa[w]; if (fb[w]) dot += fa[w] * fb[w]; }
  for (const w in fb) nb += fb[w] * fb[w];
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/* ── priority (explainable, always local) ── */
export function priorityScore(text, votes, daysUnresolved) {
  const t = text.toLowerCase();
  let hits = 0; const hitWords = [];
  for (const k of URGENT) if (t.includes(k)) { hits++; hitWords.push(k); }
  const score = Math.min(10, +(1.0 + hits * 1.2 + Math.min(votes, 80) * 0.06 + Math.min(daysUnresolved, 60) * 0.05).toFixed(1));
  return { score, hits, hitWords };
}

/* ── vector cosine on pgvector rows ── */
function vecCosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Safely parse a vector embedding representation.
 */
function parseEmbedding(emb) {
  if (!emb) return null;
  if (Array.isArray(emb)) return emb;
  if (typeof emb === "string") {
    try {
      const parsed = JSON.parse(emb);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      const cleaned = emb.replace(/[\[\]]/g, "").split(",").map(Number);
      if (cleaned.length && !isNaN(cleaned[0])) return cleaned;
    }
  }
  return null;
}

/* ── full pipeline ── */
export async function runPipeline({ title, description, district, latitude, longitude, submitted_by }) {
  const admin = getAdminClient();
  const full = `${title}. ${description}`;

  /* 1. classify */
  const cls = await classify(full);

  /* 2. dedup — pgvector if we have embeddings, else token cosine */
  const emb = await embed(full);
  let dup = null, dupScore = 0, dupEngine = "token";
  const { data: nearby } = await admin
    .from("problems_with_votes")
    .select("id,title,description,votes,latitude,longitude,embedding,category,status")
    .ilike("district", district)
    .limit(500);

  const candidates = nearby || [];
  const toks = tokens(full);

  for (const p of candidates) {
    let sim = 0;
    const pVector = parseEmbedding(p.embedding);
    if (emb.vector && pVector) {
      sim = vecCosine(emb.vector, pVector);
    } else {
      sim = cosine(toks, tokens(`${p.title} ${p.description}`));
    }

    const km = haversine(latitude, longitude, p.latitude, p.longitude);
    // If coordinates are present on both, enforce 5km radius.
    // If either lacks coordinates, match by district with a higher similarity threshold.
    const isNearby = km !== null ? km <= 5 : true;
    const threshold = km !== null ? 0.55 : 0.65;

    if (isNearby && sim >= threshold && sim > dupScore) {
      dupScore = sim;
      dup = p;
    }
  }

  const isDup = dup !== null;
  if (isDup) dupEngine = emb.vector && dup.embedding ? "pgvector" : "token";

  /* 3. priority */
  const pr = priorityScore(full, isDup ? (dup.votes || 0) : 0, 0);

  /* 4. route — universities matching category, least open load */
  let routedTo = null;
  if (!isDup) {
    const { data: unis } = await admin.from("users").select("id,name,domain_expertise").eq("role", "university").limit(50);
    const { data: openCounts } = await admin.from("problems").select("routed_to").neq("status", "resolved").not("routed_to", "is", null);
    const load = {};
    (openCounts || []).forEach((r) => (load[r.routed_to] = (load[r.routed_to] || 0) + 1));
    const matches = (unis || []).filter((u) => Array.isArray(u.domain_expertise) && u.domain_expertise.includes(cls.category));
    if (matches.length) routedTo = matches.sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0))[0].id;
  }

  return { cls, isDup, dup, dupScore, dupEngine, pr, routedTo, embedding: emb.vector, embEngine: emb.engine };
}

/**
 * Calculates great-circle distance between two points in km.
 * Returns null if any coordinate is missing or invalid.
 */
export function haversine(lat1, lng1, lat2, lng2) {
  if (
    typeof lat1 !== "number" || isNaN(lat1) ||
    typeof lng1 !== "number" || isNaN(lng1) ||
    typeof lat2 !== "number" || isNaN(lat2) ||
    typeof lng2 !== "number" || isNaN(lng2)
  ) {
    return null;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function suggestDescription(title) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "groq/compound",
        messages: [
          { role: "system", content: "You are an assistant helping a citizen report a civic problem to the government. Given the short title they provide, write a 2-3 sentence clear, respectful, and realistic description of the problem, explaining what is broken and why it needs fixing. Do not add any conversational filler text like 'Here is a description', just output the description itself." },
          { role: "user", content: `Title: ${title}` },
        ],
        temperature: 0.4,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const j = await res.json();
      return (j.choices?.[0]?.message?.content || "").trim();
    }
  } catch (err) {
    console.error("AI auto-write error:", err);
  }
  return null;
}

export { CATS, CAT_LABEL };
