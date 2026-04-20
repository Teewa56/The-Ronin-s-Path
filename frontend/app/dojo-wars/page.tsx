"use client";

import { useState, useEffect } from "react";
import { getAllClans, type Clan } from "@/lib/sui";
import ClanLeaderBoard from "@/components/ClanLeaderBoard";

export default function DojoWarsPage() {
  const [clans, setClans]   = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllClans()
      .then(setClans)
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...clans].sort((a, b) => b.current_season_score - a.current_season_score);
  const champion = sorted[0];
  const totalPoints = clans.reduce((sum, c) => sum + c.current_season_score, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-2">
          — Season Meta-Game —
        </p>
        <h1 className="text-4xl font-bold uppercase tracking-tight"
          style={{ fontFamily: "Cinzel, serif" }}>
          Dojo Wars
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-2 max-w-lg">
          Season standings updated after every ONE Samurai event. The top Clan earns the right
          to sponsor a fighter&apos;s corner — broadcast on ONE Championship.
        </p>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="mb-10 border border-[var(--gold)] bg-[var(--gold)]/5 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-5 text-[12rem] font-bold leading-none"
            style={{ fontFamily: "Cinzel, serif" }}>
            ♛
          </div>
          <p className="text-xs font-mono text-[var(--gold)] uppercase tracking-widest mb-2">
            ♛ Season Leader
          </p>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl font-bold uppercase tracking-wide"
                style={{ fontFamily: "Cinzel, serif" }}>
                {champion.name}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{champion.region}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-4xl text-[var(--gold)]">
                {champion.current_season_score.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
                Points
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-px bg-[var(--border)] mb-8">
        {[
          { label: "Clans", value: clans.length },
          { label: "Total Points", value: totalPoints.toLocaleString() },
          { label: "Prize", value: "Corner Sponsorship" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--bg-card)] px-5 py-4">
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">
              {s.label}
            </p>
            <p className="font-mono font-bold text-xl text-[var(--text)] mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Leaderboard */}
      <div>
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-4">
          — Full Standings —
        </p>
        {loading ? (
          <p className="text-center py-12 font-mono text-[var(--text-muted)] animate-pulse">
            Loading…
          </p>
        ) : (
          <ClanLeaderBoard clans={clans} />
        )}
      </div>

      {/* Prize info */}
      <div className="mt-12 border border-[var(--border)] p-6">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-4">
          — Season Prize —
        </p>
        <div className="space-y-3 text-sm text-[var(--text-muted)]">
          <p>
            <span className="text-[var(--gold)] font-semibold">Corner Sponsorship Right</span>
            {" — "}The winning Clan earns the right to sponsor a fighter&apos;s corner at the
            next ONE Samurai event. Displayed on-chain and visible on broadcast.
          </p>
          <p>
            <span className="text-[var(--text)] font-semibold">Meet & Greet</span>
            {" — "}Top individual predictors from the winning Clan are awarded a meet-and-greet
            with ONE Championship athletes.
          </p>
          <p className="font-mono text-xs text-[var(--text-dim)] pt-2 border-t border-[var(--border)]">
            Prize allocation is managed on-chain via the CornerSponsorshipRight object,
            transferred to the winning Clan representative at season end.
          </p>
        </div>
      </div>
    </div>
  );
}