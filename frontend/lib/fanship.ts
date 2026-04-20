import type { FanProfile } from "./sui";

// ── Tier definitions (mirror constants in fanship.move) ───────────────────────

export interface FanTier {
  label: string;
  minScore: number;
  color: string;         // Tailwind class
  borderColor: string;   // CSS var / hex
  multiplierBps: number; // basis points (100 = 1x)
}

export const TIERS: FanTier[] = [
  { label: "Initiate",  minScore: 0,    color: "text-zinc-400",   borderColor: "#52525b", multiplierBps: 120 },
  { label: "Wanderer",  minScore: 200,  color: "text-sky-400",    borderColor: "#38bdf8", multiplierBps: 130 },
  { label: "Veteran",   minScore: 500,  color: "text-amber-400",  borderColor: "#fbbf24", multiplierBps: 150 },
  { label: "Ronin",     minScore: 1000, color: "text-red-400",    borderColor: "#f87171", multiplierBps: 200 },
];

export function getTier(score: number): FanTier {
  return (
    [...TIERS].reverse().find((t) => score >= t.minScore) ?? TIERS[0]
  );
}

export function getNextTier(score: number): FanTier | null {
  const idx = TIERS.findIndex((t) => score < t.minScore);
  return idx === -1 ? null : TIERS[idx];
}

export function getTierProgress(score: number): number {
  const current = getTier(score);
  const next = getNextTier(score);
  if (!next) return 100;
  const range = next.minScore - current.minScore;
  const progress = score - current.minScore;
  return Math.min(100, Math.round((progress / range) * 100));
}

// ── Booster multiplier display ─────────────────────────────────────────────────

/** Converts basis points (e.g. 150) to display string (e.g. "1.50×") */
export function bpsToMultiplier(bps: number): string {
  return `${(bps / 100).toFixed(2)}×`;
}

/** Computes expected effective multiplier for a booster + profile combo */
export function effectiveMultiplier(
  boosterRarityBps: number,
  profile: FanProfile
): number {
  const fanshipMult = getBoosterMultiplierBps(profile.fanship_score);
  const bonus = Math.floor((fanshipMult - 100) / 2);
  const effective = boosterRarityBps + bonus;
  return Math.min(effective, 200);
}

const RARITY_BASE_BPS: Record<number, number> = {
  0: 120, // common
  1: 150, // rare
  2: 180, // legendary
};

export function rarityBaseBps(rarity: number): number {
  return RARITY_BASE_BPS[rarity] ?? 120;
}

function getBoosterMultiplierBps(score: number): number {
  if (score >= 1000) return 200;
  if (score >= 500)  return 150;
  if (score >= 200)  return 130;
  return 120;
}

// ── Score/accuracy helpers ─────────────────────────────────────────────────────

export function accuracy(
  correct: number,
  total: number
): string {
  if (total === 0) return "—";
  return `${Math.round((correct / total) * 100)}%`;
}

export function formatScore(score: number): string {
  return score.toLocaleString();
}

// ── Points breakdown (mirrors prediction.move scoring) ────────────────────────

export interface PointsBreakdown {
  outcomePoints: number;
  roundBonus: number;
  winnerBonus: number;
  veteranBonus: number;
  boostedTotal: number;
}

export function computePoints(
  predicted_outcome: number,
  predicted_round: number,
  predicted_winner: string,
  actual_outcome: number,
  actual_round: number,
  actual_winner: string,
  booster_bps: number,
  is_veteran: boolean
): PointsBreakdown {
  let base = 0;
  let roundBonus = 0;
  let winnerBonus = 0;

  if (predicted_outcome === actual_outcome) {
    base = 100;
    if (predicted_round > 0 && predicted_round === actual_round) roundBonus = 50;
    if (predicted_winner === actual_winner) winnerBonus = 50;
  }

  const subtotal = base + roundBonus + winnerBonus;
  const veteranBonus = is_veteran && subtotal > 0
    ? Math.floor(subtotal * 0.1)
    : 0;
  const afterVeteran = subtotal + veteranBonus;
  const boostedTotal = Math.floor((afterVeteran * booster_bps) / 100);

  return {
    outcomePoints: base,
    roundBonus,
    winnerBonus,
    veteranBonus,
    boostedTotal,
  };
}