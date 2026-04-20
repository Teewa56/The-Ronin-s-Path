"use client";

import { RARITY_LABELS, RARITY_COLORS, type Booster, type FanProfile } from "@/lib/sui";
import { effectiveMultiplier, rarityBaseBps, bpsToMultiplier } from "@/lib/fanship";

interface Props {
  boosters: Booster[];
  profile: FanProfile;
  selected: Booster | null;
  onSelect: (b: Booster | null) => void;
}

export default function BoosterEquip({ boosters, profile, selected, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
        Equip Booster
      </p>

      <div className="space-y-2">
        {/* None option */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center justify-between px-3 py-2 border text-sm transition-colors ${
            !selected
              ? "border-[var(--border-hi)] text-[var(--text-muted)]"
              : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
          }`}
        >
          <span>No booster (1.00×)</span>
          {!selected && <span className="font-mono text-xs">Selected</span>}
        </button>

        {boosters.map((b) => {
          const baseBps = rarityBaseBps(b.rarity);
          const effBps = effectiveMultiplier(baseBps, profile);
          const isSelected = selected?.id === b.id;

          return (
            <button
              key={b.id}
              onClick={() => onSelect(isSelected ? null : b)}
              className={`w-full flex items-center justify-between px-3 py-2.5 border text-sm transition-colors ${
                isSelected
                  ? "border-[var(--gold)] bg-[var(--gold)]/5"
                  : "border-[var(--border)] hover:border-[var(--border-hi)]"
              }`}
            >
              <div className="text-left">
                <p className={`font-semibold ${RARITY_COLORS[b.rarity]}`}>
                  {b.name}
                </p>
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  {RARITY_LABELS[b.rarity]} · {b.earned_at_event}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-[var(--gold)]">
                  {bpsToMultiplier(effBps)}
                </p>
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  effective
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}