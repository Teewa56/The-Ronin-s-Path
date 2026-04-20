"use client";

import { getTier, getTierProgress, getNextTier, formatScore, accuracy } from "@/lib/fanship";
import type { FanProfile } from "@/lib/sui";

interface Props {
  profile: FanProfile;
  compact?: boolean;
}

export default function FanshipBadge({ profile, compact = false }: Props) {
  const tier = getTier(profile.fanship_score);
  const next = getNextTier(profile.fanship_score);
  const progress = getTierProgress(profile.fanship_score);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold font-mono uppercase tracking-wider border`}
        style={{ borderColor: tier.borderColor, color: tier.borderColor }}
      >
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: tier.borderColor }} />
        {tier.label}
      </span>
    );
  }

  return (
    <div className="border border-[var(--border)] p-5 bg-[var(--bg-card)]">
      {/* Tier + score */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="text-2xl font-bold uppercase tracking-widest"
            style={{ fontFamily: "Cinzel, serif", color: tier.borderColor }}
          >
            {tier.label}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5 tracking-wider">
            {profile.display_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold font-mono text-[var(--gold)]">
            {formatScore(profile.fanship_score)}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
            Fanship XP
          </p>
        </div>
      </div>

      {/* Progress to next tier */}
      {next && (
        <div className="mb-4">
          <div className="flex justify-between text-xs font-mono text-[var(--text-muted)] mb-1.5">
            <span>{tier.label}</span>
            <span>{progress}% → {next.label}</span>
          </div>
          <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: tier.borderColor }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-1 text-right">
            {next.minScore - profile.fanship_score} XP to {next.label}
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--border)]">
        {[
          { label: "Events", value: profile.events_attended },
          { label: "Predictions", value: profile.total_predictions },
          {
            label: "Accuracy",
            value: accuracy(profile.correct_predictions, profile.total_predictions),
          },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-mono font-bold text-lg text-[var(--text)]">
              {stat.value}
            </p>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}