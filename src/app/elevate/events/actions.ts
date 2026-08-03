"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EVENT_LABEL, todayIso, type EventKind } from "@/lib/events";

export interface EventState {
  error?: string;
}

const KINDS = Object.keys(EVENT_LABEL) as EventKind[];

/**
 * Create a life event.
 *
 * Validation is deliberately strict about the date: an event in the past cannot
 * be prepared for, and an event ten years out produces a plan whose first task
 * is three thousand days away. Both are rejected with a sentence rather than
 * accepted into a nonsense plan.
 */
export async function createEvent(_prev: EventState, formData: FormData): Promise<EventState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!KINDS.includes(kind as EventKind)) return { error: "Pick what kind of event this is." };
  if (title.length < 1 || title.length > 120) return { error: "Give it a short name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { error: "Pick a date." };

  const today = todayIso();
  if (eventDate < today) return { error: "That date has already passed." };
  const daysOut = Math.round(
    (Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (daysOut > 730) return { error: "Two years is as far ahead as a plan means anything." };

  const { data, error } = await supabase
    .from("life_events")
    .insert({
      user_id: user.id,
      kind,
      title,
      event_date: eventDate,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "That didn't save. Try again." };

  revalidatePath("/elevate");
  redirect(`/elevate/events/${data.id}`);
}

/**
 * Tick or untick a task.
 *
 * A row exists only when the task is done, so unticking is a delete. There is
 * no "not done" state to store and therefore nothing that can fall out of sync
 * with a plan that is recomputed on every render.
 */
export async function toggleTask(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  const taskKey = String(formData.get("task_key") ?? "");
  const done = String(formData.get("done") ?? "") === "1";
  if (!eventId || !taskKey) return;

  if (done) {
    // The insert policy also checks the event belongs to the caller, so a
    // forged event_id fails at the database rather than here.
    await supabase
      .from("event_tasks")
      .upsert(
        { event_id: eventId, user_id: user.id, task_key: taskKey },
        { onConflict: "event_id,task_key" },
      );
  } else {
    await supabase
      .from("event_tasks")
      .delete()
      .eq("event_id", eventId)
      .eq("task_key", taskKey)
      .eq("user_id", user.id);
  }

  revalidatePath(`/elevate/events/${eventId}`);
  revalidatePath("/elevate");
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;

  await supabase.from("life_events").delete().eq("id", eventId).eq("user_id", user.id);
  revalidatePath("/elevate");
  redirect("/elevate");
}
