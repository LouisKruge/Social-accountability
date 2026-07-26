"use client";

import { usePathname } from "next/navigation";
import { SectionNav } from "./section-nav";

/** Routes that are outside the signed-in app, where the switcher is noise. */
const HIDDEN_PREFIXES = ["/login", "/signup", "/share", "/join"];

/**
 * Shows the section switcher only inside the app. The landing page ("/") is
 * excluded too — a signed-out visitor has nothing to switch between.
 */
export function NavGate() {
  const pathname = usePathname() ?? "";
  if (pathname === "/") return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <SectionNav />;
}
