import type { Metadata, Viewport } from "next";
import { AscentDefs } from "@/components/ascent";
import { NavGate } from "@/components/nav-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ascend — start low, climb fast",
  description:
    "Private groups that compete on how fast you improve — savings, debt paydown, fitness, habits. You race your own baseline, so everyone starts level.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E1712",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Shared gradient sprite for every ascent line (keeps them zero-JS). */}
        <AscentDefs />
        {children}
        <NavGate />
      </body>
    </html>
  );
}
