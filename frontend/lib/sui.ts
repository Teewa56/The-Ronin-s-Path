import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import type { SuiObjectData } from "@mysten/sui/client";

// ── Network ────────────────────────────────────────────────────────────────────

export type Network = "mainnet" | "testnet" | "devnet" | "localnet";

export const NETWORK: Network =
  (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as Network;

// ── Contract addresses ─────────────────────────────────────────────────────────
// NEXT_PUBLIC_PACKAGE_ID = prediction package (set by deploy script)
// Additional package IDs need NEXT_PUBLIC_ prefixes added to .env

export const CONTRACT = {
  PREDICTION_PKG:      process.env.NEXT_PUBLIC_PACKAGE_ID ?? "",
  CLAN_PKG:            process.env.NEXT_PUBLIC_CLAN_PACKAGE_ID ?? "",
  FANSHIP_PKG:         process.env.NEXT_PUBLIC_FANSHIP_PACKAGE_ID ?? "",
  CLAN_REGISTRY_ID:    process.env.NEXT_PUBLIC_CLAN_REGISTRY_ID ?? "",
  FANSHIP_REGISTRY_ID: process.env.NEXT_PUBLIC_FANSHIP_REGISTRY_ID ?? "",
  // Comma-separated fight pool object IDs; set manually after oracle creates them
  FIGHT_POOL_IDS:      process.env.NEXT_PUBLIC_FIGHT_POOL_IDS ?? "",
} as const;

export const SUI_CLOCK_ID = "0x6";

// ── Singleton client ───────────────────────────────────────────────────────────

export const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

// ── Domain types (mirror Move structs) ────────────────────────────────────────

export interface FanProfile {
  id: string;
  owner: string;
  display_name: string;
  events_attended: number;
  total_predictions: number;
  correct_predictions: number;
  fanship_score: number;
  is_veteran: boolean;
  clan_id: string;
  joined_season: number;
}

export interface Booster {
  id: string;
  owner: string;
  name: string;
  description: string;
  rarity: number;       // 0=common 1=rare 2=legendary
  earned_at_event: string;
  is_used: boolean;
}

export interface ClanMembership {
  id: string;
  fan: string;
  clan_id: string;
  clan_name: string;
  joined_season: number;
  points_contributed: number;
}

export interface Clan {
  id: string;
  name: string;
  region: string;
  description: string;
  member_count: number;
  current_season_score: number;
  is_reigning_champion: boolean;
}

export interface FightPool {
  id: string;
  fight_id: string;
  fighter_a: string;
  fighter_b: string;
  event_name: string;
  window_open: boolean;
  settled: boolean;
  actual_outcome: number;
  actual_round: number;
  actual_winner: string;
  total_predictions: number;
  total_correct: number;
}

export interface Prediction {
  id: string;
  fan: string;
  fight_id: string;
  predicted_outcome: number;
  predicted_round: number;
  predicted_winner: string;
  booster_multiplier: number;
  points_earned: number;
  is_correct: boolean;
  settled: boolean;
}

export interface DeathBlowMoment {
  id: string;
  fight_id: string;
  prompt: string;
  expires_at_ms: number;
  settled: boolean;
  correct_answer: boolean;
  correct_fans: number;
}

export interface DojoEntry {
  clan_id: string;
  clan_name: string;
  total_points: number;
  events_participated: number;
  rank: number;
}

// ── Parse helpers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function f(obj: SuiObjectData): Record<string, any> | null {
  if (obj.content?.dataType !== "moveObject") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (obj.content as any).fields as Record<string, any>;
}

export function parseFanProfile(obj: SuiObjectData): FanProfile | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    owner: d.owner,
    display_name: d.display_name,
    events_attended: Number(d.events_attended),
    total_predictions: Number(d.total_predictions),
    correct_predictions: Number(d.correct_predictions),
    fanship_score: Number(d.fanship_score),
    is_veteran: Boolean(d.is_veteran),
    clan_id: d.clan_id,
    joined_season: Number(d.joined_season),
  };
}

export function parseBooster(obj: SuiObjectData): Booster | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    owner: d.owner,
    name: d.name,
    description: d.description,
    rarity: Number(d.rarity),
    earned_at_event: d.earned_at_event,
    is_used: Boolean(d.is_used),
  };
}

export function parseClanMembership(obj: SuiObjectData): ClanMembership | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    fan: d.fan,
    clan_id: d.clan_id,
    clan_name: d.clan_name,
    joined_season: Number(d.joined_season),
    points_contributed: Number(d.points_contributed),
  };
}

export function parseClan(obj: SuiObjectData): Clan | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    name: d.name,
    region: d.region,
    description: d.description,
    member_count: Number(d.member_count),
    current_season_score: Number(d.current_season_score),
    is_reigning_champion: Boolean(d.is_reigning_champion),
  };
}

export function parseFightPool(obj: SuiObjectData): FightPool | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    fight_id: d.fight_id,
    fighter_a: d.fighter_a,
    fighter_b: d.fighter_b,
    event_name: d.event_name,
    window_open: Boolean(d.window_open),
    settled: Boolean(d.settled),
    actual_outcome: Number(d.actual_outcome),
    actual_round: Number(d.actual_round),
    actual_winner: d.actual_winner ?? "",
    total_predictions: Number(d.total_predictions),
    total_correct: Number(d.total_correct),
  };
}

export function parsePrediction(obj: SuiObjectData): Prediction | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    fan: d.fan,
    fight_id: d.fight_id,
    predicted_outcome: Number(d.predicted_outcome),
    predicted_round: Number(d.predicted_round),
    predicted_winner: d.predicted_winner,
    booster_multiplier: Number(d.booster_multiplier),
    points_earned: Number(d.points_earned),
    is_correct: Boolean(d.is_correct),
    settled: Boolean(d.settled),
  };
}

export function parseDeathBlow(obj: SuiObjectData): DeathBlowMoment | null {
  const d = f(obj); if (!d) return null;
  return {
    id: obj.objectId,
    fight_id: d.fight_id,
    prompt: d.prompt,
    expires_at_ms: Number(d.expires_at_ms),
    settled: Boolean(d.settled),
    correct_answer: Boolean(d.correct_answer),
    correct_fans: Number(d.correct_fans),
  };
}

// ── Data fetchers ──────────────────────────────────────────────────────────────

export async function getOwnedFanProfile(
  address: string
): Promise<FanProfile | null> {
  if (!CONTRACT.FANSHIP_PKG) return null;
  const { data } = await suiClient.getOwnedObjects({
    owner: address,
    filter: { StructType: `${CONTRACT.FANSHIP_PKG}::fanship::FanProfile` },
    options: { showContent: true },
  });
  if (!data.length || !data[0].data) return null;
  return parseFanProfile(data[0].data);
}

export async function getOwnedBoosters(address: string): Promise<Booster[]> {
  if (!CONTRACT.PREDICTION_PKG) return [];
  const { data } = await suiClient.getOwnedObjects({
    owner: address,
    filter: { StructType: `${CONTRACT.PREDICTION_PKG}::booster::Booster` },
    options: { showContent: true },
  });
  return data.flatMap((d) => {
    if (!d.data) return [];
    const b = parseBooster(d.data);
    return b ? [b] : [];
  });
}

export async function getOwnedMembership(
  address: string
): Promise<ClanMembership | null> {
  if (!CONTRACT.CLAN_PKG) return null;
  const { data } = await suiClient.getOwnedObjects({
    owner: address,
    filter: { StructType: `${CONTRACT.CLAN_PKG}::clan::ClanMembership` },
    options: { showContent: true },
  });
  if (!data.length || !data[0].data) return null;
  return parseClanMembership(data[0].data);
}

export async function getOwnedPredictions(
  address: string
): Promise<Prediction[]> {
  if (!CONTRACT.PREDICTION_PKG) return [];
  const { data } = await suiClient.getOwnedObjects({
    owner: address,
    filter: {
      StructType: `${CONTRACT.PREDICTION_PKG}::prediction::Prediction`,
    },
    options: { showContent: true },
  });
  return data.flatMap((d) => {
    if (!d.data) return [];
    const p = parsePrediction(d.data);
    return p ? [p] : [];
  });
}

export async function getClan(clanId: string): Promise<Clan | null> {
  const obj = await suiClient.getObject({
    id: clanId,
    options: { showContent: true },
  });
  if (!obj.data) return null;
  return parseClan(obj.data);
}

export async function getAllClans(): Promise<Clan[]> {
  if (!CONTRACT.CLAN_PKG) return [];
  const events = await suiClient.queryEvents({
    query: { MoveEventType: `${CONTRACT.CLAN_PKG}::clan::ClanCreated` },
    limit: 50,
  });

  const clanIds = events.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e) => (e.parsedJson as any)?.clan_id as string)
    .filter(Boolean);

  if (!clanIds.length) return [];

  const objects = await suiClient.multiGetObjects({
    ids: clanIds,
    options: { showContent: true },
  });

  return objects.flatMap((obj) => {
    if (!obj.data) return [];
    const c = parseClan(obj.data);
    return c ? [c] : [];
  });
}

export async function getActiveFightPools(): Promise<FightPool[]> {
  const ids = CONTRACT.FIGHT_POOL_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) return [];
  const objects = await suiClient.multiGetObjects({
    ids,
    options: { showContent: true },
  });
  return objects.flatMap((obj) => {
    if (!obj.data) return [];
    const p = parseFightPool(obj.data);
    return p ? [p] : [];
  });
}

// ── Label maps ─────────────────────────────────────────────────────────────────

export const OUTCOME_LABELS: Record<number, string> = {
  0: "KO / TKO",
  1: "Submission",
  2: "Decision",
  3: "DQ",
};

export const RARITY_LABELS: Record<number, string> = {
  0: "Common",
  1: "Rare",
  2: "Legendary",
};

export const RARITY_COLORS: Record<number, string> = {
  0: "text-zinc-400",
  1: "text-blue-400",
  2: "text-yellow-400",
};

export const NULL_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000000";