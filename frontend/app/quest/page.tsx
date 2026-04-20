"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  getOwnedFanProfile,
  getOwnedBoosters,
  getOwnedPredictions,
  getActiveFightPools,
  type FanProfile,
  type Booster,
  type Prediction,
  type FightPool,
  type DeathBlowMoment,
  OUTCOME_LABELS,
} from "@/lib/sui";
import { subscribeToDeathBlows, subscribeToFightSettlements } from "@/lib/oracle";
import PredictionCard from "@/components/PredictionCard";
import DeathBlowModal from "@/components/DeathBlowModal";
import Link from "next/link";

export default function QuestPage() {
  const account = useCurrentAccount();

  const [profile, setProfile]         = useState<FanProfile | null>(null);
  const [boosters, setBoosters]       = useState<Booster[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [pools, setPools]             = useState<FightPool[]>([]);
  const [deathBlow, setDeathBlow]     = useState<DeathBlowMoment | null>(null);
  const [loading, setLoading]         = useState(false);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    const [p, b, pr, pl] = await Promise.all([
      getOwnedFanProfile(account.address),
      getOwnedBoosters(account.address),
      getOwnedPredictions(account.address),
      getActiveFightPools(),
    ]);
    setProfile(p);
    setBoosters(b);
    setPredictions(pr);
    setPools(pl);
    setLoading(false);
  }, [account]);

  useEffect(() => { load(); }, [load]);

  // Live subscriptions
  useEffect(() => {
    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    subscribeToDeathBlows((moment) => {
      setDeathBlow(moment);
    }).then((u) => { unsub1 = u; });

    subscribeToFightSettlements(() => {
      load(); // Reload pool state on settlement
    }).then((u) => { unsub2 = u; });

    return () => { unsub1?.(); unsub2?.(); };
  }, [load]);

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <p
          className="text-3xl font-bold uppercase tracking-widest mb-4"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          Connect Your Wallet
        </p>
        <p className="text-[var(--text-muted)]">
          Connect your Sui wallet to enter the prediction quest.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-[var(--text-muted)] animate-pulse">
          Loading quest…
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <p
          className="text-3xl font-bold uppercase tracking-widest mb-4"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          No Profile Found
        </p>
        <p className="text-[var(--text-muted)] mb-8">
          Create your fan profile to begin the quest.
        </p>
        <Link
          href="/profile"
          className="px-8 py-3 bg-[var(--crimson)] text-white font-bold tracking-widest uppercase text-sm"
        >
          Create Profile
        </Link>
      </div>
    );
  }

  const predictionsByFight = Object.fromEntries(
    predictions.map((p) => [p.fight_id, p])
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Page header */}
      <div className="mb-10">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-2">
          — Prediction Quest —
        </p>
        <h1
          className="text-4xl font-bold uppercase tracking-tight"
          style={{ fontFamily: "Cinzel, serif" }}
        >
          Active Fights
        </h1>
      </div>

      {/* Active pools */}
      {pools.length === 0 ? (
        <div className="border border-[var(--border)] p-12 text-center">
          <p className="text-[var(--text-muted)] mb-2 font-semibold">
            No active fight pools.
          </p>
          <p className="text-xs text-[var(--text-dim)] font-mono">
            Fight pool IDs are loaded from{" "}
            <code className="bg-[var(--bg-raised)] px-1">NEXT_PUBLIC_FIGHT_POOL_IDS</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pools.map((pool) => (
            <PredictionCard
              key={pool.id}
              pool={pool}
              profile={profile}
              boosters={boosters}
              existingPrediction={!!predictionsByFight[pool.fight_id]}
              onSuccess={load}
            />
          ))}
        </div>
      )}

      {/* Past predictions */}
      {predictions.length > 0 && (
        <div className="mt-16">
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-6">
            — Your Predictions —
          </p>
          <div className="border border-[var(--border)] overflow-hidden">
            {predictions.map((pred, i) => (
              <div
                key={pred.id}
                className={`flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] last:border-0 ${
                  i % 2 === 0 ? "bg-[var(--bg)]" : "bg-[var(--bg-card)]"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {pred.fight_id}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                    {OUTCOME_LABELS[pred.predicted_outcome]}
                    {pred.predicted_round > 0 && ` · R${pred.predicted_round}`}
                    {" · "}{pred.predicted_winner}
                  </p>
                </div>
                <div className="text-right">
                  {pred.settled ? (
                    <>
                      <p
                        className={`font-mono font-bold text-sm ${
                          pred.is_correct ? "text-[var(--green)]" : "text-[var(--text-muted)]"
                        }`}
                      >
                        {pred.is_correct ? "+" : ""}
                        {pred.points_earned} pts
                      </p>
                      <p className="text-xs text-[var(--text-muted)] font-mono">
                        {pred.is_correct ? "✓ Correct" : "✗ Wrong"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-mono text-[var(--text-dim)] uppercase">
                      Pending
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Death Blow modal */}
      {deathBlow && !deathBlow.settled && profile && (
        <DeathBlowModal
          moment={deathBlow}
          profile={profile}
          onClose={() => setDeathBlow(null)}
          onSuccess={() => { setDeathBlow(null); load(); }}
        />
      )}
    </div>
  );
}