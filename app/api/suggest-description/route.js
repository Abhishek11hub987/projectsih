import { NextResponse } from "next/server";
import { suggestDescription } from "@/lib/ai.js";

export async function POST(req) {
  try {
    const { title } = await req.json();
    if (!title || typeof title !== "string") {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }

    const description = await suggestDescription(title);
    if (!description) {
      return NextResponse.json({ ok: false, error: "Failed to generate description" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, description });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
