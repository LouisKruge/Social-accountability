import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  acceptReport,
  buildSystemPrompt,
  STRICTER_RETRY_INSTRUCTION,
  type BudgetTier,
  type GlowupGoal,
  type GlowupReport,
} from "@/lib/glowup";

const MODEL = "claude-opus-4-5";
const API = "https://api.anthropic.com/v1/messages";

type ImagePart = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};

/**
 * Runs a report: pulls the user's own photos out of the PRIVATE bucket, sends
 * them to Claude with the constrained system prompt, then puts the response
 * through the schema + content guard before anything is stored.
 *
 * Uses the service role only to read the storage objects for this one report —
 * the photos never become public and no signed URL is handed out here.
 */
export async function runGlowupReport(reportId: string): Promise<
  { ok: true; report: GlowupReport } | { ok: false; error: string }
> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Report generation isn't configured yet." };

  const admin = createAdminClient();

  const { data: report } = await admin
    .from("glowup_reports")
    .select("id, user_id, goal, budget_tier, style_preference")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { ok: false, error: "Report not found." };

  const { data: photos } = await admin
    .from("glowup_photos")
    .select("storage_path, photo_type")
    .eq("report_id", reportId);

  if (!photos || photos.length === 0) return { ok: false, error: "No photos uploaded yet." };

  // All photos on a report belong to one account by construction: they are
  // written with the owner's user_id and stored under that user's folder.
  const images: ImagePart[] = [];
  for (const p of photos.slice(0, 5)) {
    const { data: blob } = await admin.storage.from("glowup").download(p.storage_path);
    if (!blob) continue;
    const buf = Buffer.from(await blob.arrayBuffer());
    images.push({
      type: "image",
      source: {
        type: "base64",
        media_type: blob.type || "image/jpeg",
        data: buf.toString("base64"),
      },
    });
  }
  if (images.length === 0) return { ok: false, error: "Couldn't read your photos." };

  const system = buildSystemPrompt(
    report.goal as GlowupGoal,
    report.budget_tier as BudgetTier,
  );
  const userText = report.style_preference
    ? `Style note from me: ${report.style_preference}`
    : "Please review these photos of me.";

  async function ask(extraInstruction?: string): Promise<string> {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: extraInstruction ? `${system}\n\n${extraInstruction}` : system,
        messages: [{ role: "user", content: [...images, { type: "text", text: userText }] }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API returned ${res.status}`);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (json.content ?? []).map((c) => c.text ?? "").join("");
  }

  try {
    let raw = await ask();
    let verdict = acceptReport(raw);

    // Retry ONCE, and only for a formatting failure. A content-guard rejection
    // is never retried — re-rolling a safety failure is not a fix.
    if (!verdict.ok && verdict.retryable) {
      raw = await ask(STRICTER_RETRY_INSTRUCTION);
      verdict = acceptReport(raw);
    }

    if (!verdict.ok) {
      await admin.from("glowup_reports").update({ status: "failed" }).eq("id", reportId);
      return { ok: false, error: verdict.error };
    }

    await admin
      .from("glowup_reports")
      .update({ report_json: verdict.report as never, status: "ready" })
      .eq("id", reportId);

    return { ok: true, report: verdict.report };
  } catch (err) {
    await admin.from("glowup_reports").update({ status: "failed" }).eq("id", reportId);
    return { ok: false, error: err instanceof Error ? err.message : "Report generation failed." };
  }
}
