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
  // True black, matching --valley. This was still the old dark-green from the
  // pre-monochrome palette, so on Android the browser chrome sat in a colour
  // that no longer exists anywhere in the app.
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Paint the stored theme on the FIRST frame. Doing this in an effect
          means every cold load flashes the wrong theme before React runs —
          the one place a blocking inline script is the correct answer.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ascend-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen">
        {/* Shared gradient sprite for every ascent line (keeps them zero-JS). */}
        <AscentDefs />
        {children}
        <NavGate />
      </body>
    </html>
  );
}
