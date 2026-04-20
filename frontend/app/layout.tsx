import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "The Ronin's Path — ONE Samurai Fan Quest",
  description:
    "Real-time on-chain prediction and fan engagement platform for ONE Championship's Japanese audience.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col relative z-10">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[var(--border)] py-6 px-6 text-center text-xs text-[var(--text-muted)] font-mono tracking-widest uppercase">
            THE RONIN&apos;S PATH &mdash; Sui × ONE Samurai 2026
          </footer>
        </Providers>
      </body>
    </html>
  );
}