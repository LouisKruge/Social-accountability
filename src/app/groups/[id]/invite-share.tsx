"use client";

import { useState } from "react";

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
  const message = `Join my Ascend group "${groupName}" — we're racing on who improves fastest this week.\n${joinUrl}`;
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
    <div>
      <p className="mb-4 text-body text-sage">
        Anyone with this code can join and appear on the climb.{" "}
        <span className="tnum select-all text-snow">{inviteCode}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-pill bg-snow px-4 text-body font-semibold text-valley transition duration-150 ease-ascend active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.54-3.7 8.23-8.24 8.23Z" />
          </svg>
          WhatsApp
        </a>
        <button
          onClick={copy}
          className="inline-flex min-h-[3rem] items-center justify-center rounded-pill bg-ridge px-4 text-body text-snow ring-1 ring-scree transition hover:bg-scree"
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
