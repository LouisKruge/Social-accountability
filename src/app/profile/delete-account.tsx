"use client";

import { useState } from "react";
import { deleteAccount } from "./actions";
import { Button, Card } from "@/components/ui";

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="border-red-200">
      <p className="text-sm font-semibold text-red-700">Delete account</p>
      <p className="mt-1 text-xs text-slate-500">
        Permanently deletes your account and <strong>all</strong> your entries, baselines, group
        memberships and rank cards. This can&apos;t be undone.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Delete my account
        </button>
      ) : (
        <form action={deleteAccount} className="mt-3 space-y-2">
          <p className="text-sm text-red-700">Are you sure? This is permanent.</p>
          <Button type="submit" variant="danger">
            Yes, delete everything
          </Button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="w-full rounded-xl px-4 py-2 text-sm font-medium text-slate-500"
          >
            Cancel
          </button>
        </form>
      )}
    </Card>
  );
}
