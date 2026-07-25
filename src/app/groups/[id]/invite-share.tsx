"use client";

import { useState } from "react";
import { Card } from "@/components/ui";

export function InviteShare({
  groupName,
  inviteCode,
  siteUrl,
}: {
  groupName: string;
  inviteCode: string;
  siteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const joinUrl = `${siteUrl}/join/${inviteCode}`;
  const message = `Join my Ascend group “${groupName}” and let's see who improves fastest this week 📈\n${joinUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="bg-brand-50/50">
      <p className="text-sm font-semibold text-slate-800">Invite your crew</p>
      <p className="mt-1 text-xs text-slate-500">
        Code: <span className="font-mono font-semibold">{inviteCode}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white"
        >
          Share on WhatsApp
        </a>
        <button
          onClick={copy}
          className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </Card>
  );
}
