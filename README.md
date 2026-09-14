# SETU Portal — SIH26043 · Government of Jharkhand

**Production app: Next.js 14 + Supabase + real AI pipeline. Zero monthly cost.**

---

## ⚡ Quick start (5 minutes)

1. **Install dependencies** (first time only):
   ```
   npm install
   ```
2. **Paste your keys** into `.env` (already created — open it and fill the values).
3. **Create the database**: Supabase dashboard → SQL Editor → New query → paste ALL of `supabase/schema.sql` → **Run**. This creates every table + 24 realistic seed problems + demo accounts.
4. **Start the app**:
   ```
   npm run dev
   ```
5. Open **http://localhost:3000** → "Sign in" → **tap any demo role button** (Citizen/University/Industry/Government — one tap, no typing).

> No Groq/Gemini keys yet? The app still works fully — classification falls back to the
> built-in explainable keyword engine and dedup to token-similarity. Add keys later for
> LLM-powered classification and pgvector embeddings; nothing else changes.

## Demo accounts (seeded by schema.sql, password `setu1234`)

| Role | Email |
|---|---|
| Citizen | `priya@demo.setu` |
| University | `hod.che@demo.setu` (Central Univ. of Jharkhand — water/agri/health) |
| Industry | `csr@tatasf.setu` (Tata Steel Foundation) |
| Government | `admin@demo.setu` |

One-tap buttons on the sign-in page sign you in as each role directly.

## The 3-minute judge demo

1. **Citizen → Report a problem** — fill form, tap "Detect my location", submit → watch the
   4-step AI panel run live (classify → dedup → priority → route). *(wow #1)*
2. Submit the duplicate phrase: *"The hand pump serving our village has been broken and dry
   for weeks, we need urgent repair"* → flagged as a duplicate, **merged as a vote**, no new
   ticket. *(wow #2)*
3. **University** → Routed problems → "Form team & propose" → status advances, SMS logged.
4. **Industry** → Discover (focus-sorted) → "Express interest" → problem goes `in_progress`.
5. **Government** → live analytics: district bars, category donut, lifecycle funnel,
   searchable audit table, notification log.
6. **Citizen → My problems** → lifecycle stepper + explainable priority formula.

## What's real vs simulated

| Feature | Status |
|---|---|
| Auth, submission, AI classify/dedup/priority/routing, proposals, industry interest, analytics, lifecycle, notification log | **Real — Supabase-backed** |
| AI classification | **Real Groq Llama call if `GROQ_API_KEY` set**; otherwise explainable keyword engine |
| Dedup embeddings | **Real Gemini embeddings + pgvector if `GEMINI_API_KEY` set**; otherwise token cosine |
| Photo upload | **real Supabase Storage upload** (public bucket `problems`, auto-created by schema.sql) — falls back to submitting without the photo if Storage is unreachable |
| SMS/Email | simulated — every message written to `notifications` table |
| Aadhaar SSO, regional NLP, NIC MeghRaj | roadmap (shown on landing) |

## Deploy to a live URL (Cloudflare, free)

```bash
npm i -g wrangler
npx wrangler login
# Use the Cloudflare dashboard: Workers & Pages → Create → Pages →
# Connect this repo (framework: Next.js) → add the same env vars from
# .env as build-time secrets → Deploy.
```
Then in Cloudflare dashboard → Workers & Pages → your project → Settings → Variables: add
the same keys from `.env` (Supabase URL, anon key, service role key, Groq/Gemini optional).
Warm up Supabase the morning of demo day (free projects pause after 7 idle days).

## Project structure

```
app/
  page.jsx            landing
  login/page.jsx      auth (signup with role/domain picker + 1-tap demo logins)
  portal/page.jsx     all four role dashboards (client component)
  api/submit          problem submission → full AI pipeline
  api/proposal        university proposal → status advance + SMS log
  api/interest        industry interest → status advance
  api/vote            citizen vote toggle
  api/profile         users-row creation after signup
  api/health          env + DB reachability check
components/ui.jsx     Shell, Modal, Toasts, Map, ProblemRow, Stepper…
lib/ai.js             classify (Groq) · embed (Gemini) · priority · route · pipeline
lib/supabase.js       browser client
middleware.js         session refresh + /portal guard
supabase/schema.sql   full DB schema + policies + 24-problem seed — run once
```

## Architecture notes (for the pitch)

- **Modular monolith by choice** — one deployable unit on Cloudflare Pages free tier; no
  Kafka/K8s at this scale. Production path: NIC MeghRaj, same schema.
- **Explainable AI** — priority formula is transparent and shown to citizens; routing
  decisions auditable in the admin Routing audit view.
- **Free-tier stack**: Cloudflare Pages (unlimited static requests) · Supabase free (500MB
  Postgres, pgvector included, 50K MAU) · Groq free (~1K req/day) · Gemini free embeddings ·
  Resend free (100 emails/day) — total **₹0/month**.
