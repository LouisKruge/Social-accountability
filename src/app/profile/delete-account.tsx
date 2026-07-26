"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";
import { Button, Card } from "@/components/ui";

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="ring-1 ring-fall/30">
      <p className="text-sm font-semibold text-fall">Delete account</p>
      <p className="mt-1 text-xs text-sage">
        Permanently deletes your account and <strong>all</strong> your entries, baselines, group
        memberships and rank cards. This can&apos;t be undone.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-field border ring-1 ring-fall/40 px-4 py-3 text-sm font-semibold text-fall hover:bg-fall/10"
        >
          Delete my account
        </button>
      ) : (
        <form action={deleteAccount} className="mt-3 space-y-2">
          <p className="text-sm text-fall">Are you sure? This is permanent.</p>
          <Button type="submit" variant="danger">
            Yes, delete everything
          </Button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="w-full rounded-field px-4 py-2 text-sm font-medium text-sage"
          >
            Cancel
          </button>
        </form>
      )}
    </Card>
  );
}
