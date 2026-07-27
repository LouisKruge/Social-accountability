"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerPhoto } from "@/app/elevate/new/actions";
import { Card, Button, ErrorNote } from "@/components/ui";

/**
 * Uploads straight from the browser into the PRIVATE bucket at
 * `<uid>/<reportId>/…`, so the bytes never pass through our server and the
 * storage policy pins them to the account holder.
 *
 * Two slots only, both of the same person: a face shot and an outfit shot.
 * There is no "add another person" path, by design.
 */
export function Uploader({
  reportId,
  userId,
  existing,
}: {
  reportId: string;
  userId: string;
  existing: { photo_type: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const has = (t: string) => existing.some((p) => p.photo_type === t);

  async function upload(file: File, photoType: "face" | "outfit") {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That's not an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("That image is over 8MB — try a smaller one.");
      return;
    }

    setBusy(photoType);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${reportId}/${photoType}-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("glowup").upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (upErr) {
        setError("That upload didn't go through. Try again.");
        return;
      }
      const fd = new FormData();
      fd.set("report_id", reportId);
      fd.set("storage_path", path);
      fd.set("photo_type", photoType);
      await registerPhoto(fd);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const slots = [
    { type: "face" as const, label: "A clear photo of your face", hint: "Front on, good light" },
    { type: "outfit" as const, label: "A full outfit shot", hint: "Head to toe if you can" },
  ];

  return (
    <div className="space-y-3">
      {slots.map((s) => (
        <Card key={s.type}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-snow">{s.label}</p>
              <p className="mt-0.5 text-xs text-sage">{s.hint}</p>
            </div>
            {has(s.type) ? (
              <span className="shrink-0 rounded-full bg-ice/10 px-2.5 py-1 text-caption font-medium text-ice ring-1 ring-ice/20">
                Added
              </span>
            ) : null}
          </div>
          <label className="mt-4 block">
            <span className="sr-only">Upload {s.label}</span>
            <input
              type="file"
              accept="image/*"
              disabled={busy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f, s.type);
              }}
              className="block w-full cursor-pointer rounded-field bg-valley text-sm text-sage ring-1 ring-scree file:mr-3 file:cursor-pointer file:rounded-l-field file:border-0 file:bg-ridge file:px-4 file:py-3 file:text-sm file:text-snow hover:file:bg-scree"
            />
          </label>
          {busy === s.type && <p className="mt-2 text-xs text-ice">Uploading…</p>}
        </Card>
      ))}

      <ErrorNote>{error}</ErrorNote>

      <p className="pt-1 text-meta text-sage">
        Photos go straight into private storage that only you can read. They&apos;re never public,
        never shown to another user, and you can delete them at any time from Profile.
      </p>
    </div>
  );
}

export function GenerateButton({ ready }: { ready: boolean }) {
  const { pending } = { pending: false };
  return (
    <Button type="submit" disabled={!ready || pending}>
      {ready ? "Get my report" : "Add a photo first"}
    </Button>
  );
}
