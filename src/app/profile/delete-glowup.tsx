"use client";

import { useState } from "react";
import { deleteGlowupData } from "@/app/elevate/actions";
import { Button, Card } from "@/components/ui";

/**
 * POPIA erase for Glow Up specifically — photos are sensitive personal data, so
 * they get their own delete path rather than only being reachable by deleting
 * the whole account. Removes the storage objects as well as the rows.
 */
export function DeleteGlowupData() {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <p className="text-sm font-medium text-snow">Delete my Glow Up photos &amp; reports</p>
      <p className="mt-1.5 text-xs leading-relaxed text-sage">
        Removes every photo you uploaded and every report, including the files themselves. Your
        account and your groups stay as they are.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-4 w-full rounded-field bg-ridge px-4 py-3 text-sm text-snow ring-1 ring-scree transition hover:bg-scree"
        >
          Delete Glow Up data
        </button>
      ) : (
        <form action={deleteGlowupData} className="mt-4 space-y-2">
          <p className="text-sm text-fall">This permanently deletes your photos. Sure?</p>
          <Button type="submit" variant="danger">
            Yes, delete photos and reports
          </Button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="w-full rounded-field px-4 py-2 text-sm text-sage"
          >
            Cancel
          </button>
        </form>
      )}
    </Card>
  );
}
