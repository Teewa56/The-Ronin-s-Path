"use client";

import Link from "next/link";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";

const FEATURES = [
  {
    icon: "⚔️",
    title: "Prediction Quest",
    desc: "Lock in fight predictions before the bell — outcome, method, round. Every call matters.",
  },
  {
    icon: "🧪",
    title: "Booster System",
    desc: "Equip digital Boosters earned from past events. Veterans get multipliers up to 2×.",
  },
  {
    icon: "🏯",
    title: "Clan Clash",
    desc: "Join a regional Clan. Team Tokyo vs Team Osaka. Every prediction feeds the season war.",
  },
  {
    icon: "⚡",
    title: "Death Blow Moments",
    desc: "60-second live micro-predictions mid-fight. Oracle triggers. Sui settles instantly.",
  },
  {
    icon: "🗡️",
    title: "Dojo Wars",
    desc: "Season-long meta-game. Top Clan sponsors a fighter's corner — broadcast on ONE.",
  },
  {
    icon: "📜",
    title: "True Fanship",
    desc: "On-chain fan lineage. Every event, every correct call strengthens your legacy.",
  },
];

export default function HomePage() {
  const account = useCurrentAccount();

  return (
    <div className="relative">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 80px), repeating-linear-gradient(90deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 80px)",
          }}
        />

        {/* Red vertical accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-transparent to-[var(--crimson)] opacity-60" />

        <div className="relative fade-up">
          <p className="text-xs font-mono tracking-[0.4em] text-[var(--text-muted)] uppercase mb-6">
            Sui × ONE Samurai Tokyo Builders&apos; Arena 2026
          </p>

          <h1
            className="text-5xl md:text-8xl font-bold uppercase tracking-tight leading-none mb-4"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            <span className="text-[var(--crimson)]">The</span>
            <br />
            Ronin&apos;s
            <br />
            <span className="text-[var(--gold)]">Path</span>
          </h1>

          <p className="mt-8 max-w-xl mx-auto text-lg text-[var(--text-muted)] leading-relaxed font-light">
            A warrior&apos;s legacy is written in every battle.
            <br />
            <span className="text-[var(--text)]">So is a fan&apos;s.</span>
          </p>

          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            {account ? (
              <Link
                href="/quest"
                className="px-8 py-3 bg-[var(--crimson)] hover:bg-[var(--crimson-hi)] text-white font-bold tracking-widest uppercase text-sm transition-colors"
              >
                Enter the Quest →
              </Link>
            ) : (
              <ConnectButton />
            )}
            <Link
              href="/clan"
              className="px-8 py-3 border border-[var(--border-hi)] hover:border-[var(--text-muted)] text-[var(--text-muted)] hover:text-[var(--text)] font-semibold tracking-widest uppercase text-sm transition-colors"
            >
              Join a Clan
            </Link>
          </div>
        </div>

        {/* Bottom rule */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--crimson)] to-transparent opacity-40" />
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <p className="text-xs font-mono tracking-[0.4em] text-[var(--text-muted)] uppercase mb-12 text-center">
          — The System —
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border)]">
          {FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="bg-[var(--bg)] p-8 hover:bg-[var(--bg-card)] transition-colors"
            >
              <div className="text-3xl mb-4">{feat.icon}</div>
              <h3
                className="text-base font-bold uppercase tracking-widest text-[var(--text)] mb-3"
                style={{ fontFamily: "Cinzel, serif" }}
              >
                {feat.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed font-light">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Scoring table ──────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <p className="text-xs font-mono tracking-[0.4em] text-[var(--text-muted)] uppercase mb-8 text-center">
          — Scoring —
        </p>

        <div className="border border-[var(--border)] overflow-hidden">
          {[
            ["Correct outcome", "100 pts"],
            ["Correct method", "+50 pts"],
            ["Correct round", "+50 pts"],
            ["Death Blow micro-prediction", "+75 pts"],
            ["Common Booster equipped", "1.2× multiplier"],
            ["Legendary Booster (veteran)", "up to 2.0× multiplier"],
            ["Veteran fan bonus", "+10% on all pts"],
          ].map(([action, pts], i) => (
            <div
              key={action}
              className={`flex items-center justify-between px-6 py-3 ${
                i % 2 === 0 ? "bg-[var(--bg)]" : "bg-[var(--bg-card)]"
              }`}
            >
              <span className="text-sm text-[var(--text-muted)]">{action}</span>
              <span className="font-mono text-sm text-[var(--gold)] font-semibold">
                {pts}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}