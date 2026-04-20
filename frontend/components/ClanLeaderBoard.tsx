"use client";

import type { Clan } from "@/lib/sui";

interface Props {
  clans: Clan[];
  highlightId?: string;
}

export default function ClanLeaderBoard({ clans, highlightId }: Props) {
  const sorted = [...clans].sort(
    (a, b) => b.current_season_score - a.current_season_score
  );

  return (
    <div className="border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 px-4 py-2 bg-[var(--bg-raised)] border-b border-[var(--border)]">
        <span className="col-span-1 text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">#</span>
        <span className="col-span-5 text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Clan</span>
        <span className="col-span-3 text-right text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Members</span>
        <span className="col-span-3 text-right text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider">Points</span>
      </div>

      {sorted.length === 0 && (
        <p className="text-center py-8 text-sm text-[var(--text-muted)]">
          No clan data available.
        </p>
      )}

      {sorted.map((clan, idx) => {
        const isHighlighted = clan.id === highlightId;
        const rank = idx + 1;

        return (
          <div
            key={clan.id}
            className={`grid grid-cols-12 items-center px-4 py-3.5 border-b border-[var(--border)] last:border-0 transition-colors ${
              isHighlighted
                ? "bg-[var(--crimson)]/8 border-l-2 border-l-[var(--crimson)]"
                : "hover:bg-[var(--bg-raised)]"
            }`}
          >
            {/* Rank */}
            <span
              className={`col-span-1 font-mono font-bold text-sm ${
                rank === 1
                  ? "text-[var(--gold)]"
                  : rank === 2
                  ? "text-zinc-400"
                  : rank === 3
                  ? "text-amber-700"
                  : "text-[var(--text-dim)]"
              }`}
            >
              {rank}
            </span>

            {/* Clan name */}
            <div className="col-span-5">
              <p className="font-semibold text-sm text-[var(--text)] uppercase tracking-wider">
                {clan.name}
                {clan.is_reigning_champion && (
                  <span className="ml-2 text-xs text-[var(--gold)]">♛</span>
                )}
              </p>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {clan.region}
              </p>
            </div>

            {/* Members */}
            <span className="col-span-3 text-right font-mono text-sm text-[var(--text-muted)]">
              {clan.member_count}
            </span>

            {/* Points */}
            <span
              className={`col-span-3 text-right font-mono font-bold text-sm ${
                rank === 1 ? "text-[var(--gold)]" : "text-[var(--text)]"
              }`}
            >
              {clan.current_season_score.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}