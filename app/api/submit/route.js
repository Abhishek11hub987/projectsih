import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/ai";
import { getAuthenticatedUser, getAdminClient } from "@/lib/server-auth";
import { DISTRICTS } from "@/components/ui";

export const maxDuration = 30;

export async function POST(req) {
  /* submit a problem → classify → dedup → priority → route → insert (or merge as vote) */
  const body = await req.json().catch(() => null);
  const { title, description, district, latitude, longitude, photo_url } = body || {};

  if (!title?.trim() || !description?.trim() || !district) {
    return NextResponse.json({ ok: false, error: "Title, description, and district are required" }, { status: 400 });
  }

  // Verify district is in the expected list
  const sanitizedDistrict = district.trim();
  if (DISTRICTS && !DISTRICTS.includes(sanitizedDistrict)) {
    return NextResponse.json({ ok: false, error: "Invalid district specified" }, { status: 400 });
  }

  // Attempt authentication; bind submitted_by to authenticated user profile if present
  const { profile } = await getAuthenticatedUser(req);
  const submitted_by = profile?.id || null;

  const admin = getAdminClient();

  try {
    const cleanTitle = title.trim().slice(0, 200);
    const cleanDescription = description.trim().slice(0, 3000);

    const result = await runPipeline({
      title: cleanTitle,
      description: cleanDescription,
      district: sanitizedDistrict,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      submitted_by,
    });
    const { cls, isDup, dup, dupScore, pr, routedTo, embedding } = result;

    if (isDup) {
      /* merge as vote — deduplication resolution */
      if (submitted_by) {
        await admin.from("problem_votes").upsert(
          { problem_id: dup.id, user_id: submitted_by },
          { onConflict: "problem_id,user_id" }
        );
      }

      /* re-read the merged count from the view */
      const { data: merged } = await admin
        .from("problems_with_votes")
        .select("votes")
        .eq("id", dup.id)
        .maybeSingle();

      const votes = merged?.votes ?? ((dup.votes || 0) + 1);
      await admin.from("notifications").insert({
        send_to: "citizen",
        channel: "SMS",
        text: `Similar report detected. Your submission was merged as a vote on "${dup.title.slice(0, 40)}…" — priority is now ${Math.max(pr.score, 7).toFixed(1)}.`,
      });

      return NextResponse.json({
        ok: true,
        duplicate: true,
        problem_id: dup.id,
        matched_title: dup.title,
        score: +dupScore.toFixed(2),
        votes,
      });
    }

    const insert = {
      title: cleanTitle,
      description: cleanDescription,
      category: cls.category,
      district: sanitizedDistrict,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      photo_url: typeof photo_url === "string" && photo_url.startsWith("http") ? photo_url : null,
      submitted_by,
      status: routedTo ? "routed" : "submitted",
      priority_score: pr.score,
      demo_votes: 1,
    };

    if (routedTo) insert.routed_to = routedTo;
    if (embedding && Array.isArray(embedding)) {
      /* pgvector literal: '[0.1,0.2,...]' */
      insert.embedding = `[${embedding.join(",")}]`;
    }

    const { data: inserted, error } = await admin.from("problems").insert(insert).select("id").single();
    if (error) throw error;

    await admin.from("notifications").insert({
      send_to: "citizen",
      channel: "SMS",
      text: `Ticket ${inserted.id.slice(0, 8)} registered for ${sanitizedDistrict}. Category ${cls.category}. Track it on SETU portal.`,
    });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      problem_id: inserted.id,
      category: cls.category,
      engine: cls.engine,
      confidence: cls.confidence,
      priority: pr.score,
      hits: pr.hitWords.slice(0, 4),
      routed_to_university: routedTo,
      embedding_engine: result.embEngine,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
