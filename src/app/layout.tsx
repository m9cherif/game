import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEON STRIKE — Procedural FPS",
  description: "Hand-built procedural FPS: 6 modes, 6 weapons, party multiplayer with 6-digit keys. Every model generated in code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#060312" />
      </head>
      <body className="bg-[#060312] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
