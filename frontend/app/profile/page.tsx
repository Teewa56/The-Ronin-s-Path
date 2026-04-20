"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  getOwnedFanProfile,
  getOwnedBoosters,
  getOwnedPredictions,
  getOwnedMembership,
  CONTRACT,
  RARITY_LABELS,
  RARITY_COLORS,
  OUTCOME_LABELS,
  type FanProfile,
  type Booster,
  type Prediction,
  type ClanMembership,
} from "@/lib/sui";
import FanshipBadge from "@/components/FanshipBadge";
import { bpsToMultiplier, rarityBaseBps, effectiveMultiplier } from "@/lib/fanship";

export default function ProfilePage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [profile, setProfile]       = useState<FanProfile | null>(null);
  const [boosters, setBoosters]     = useState<Booster[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [membership, setMembership] = useState<ClanMembership | null>(null);
  const [loading, setLoading]       = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState("");

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    const [p, b, pr, m] = await Promise.all([
      getOwnedFanProfile(account.address),
      getOwnedBoosters(account.address),
      getOwnedPredictions(account.address),
      getOwnedMembership(account.address),
    ]);
    setProfile(p);
    setBoosters(b);
    setPredictions(pr);
    setMembership(m);
    setLoading(false);
  }, [account]);

  useEffect(() => { load(); }, [load]);

  function createProfile() {
    if (!displayName.trim()) { setCreateError("Enter a display name."); return; }
    setCreateError("");
    setCreating(true);

    const tx = new Transaction();
    tx.moveCall({
      target: `${CONTRACT.FANSHIP_PKG}::fanship::create_profile`,
      arguments: [
        tx.object(CONTRACT.FANSHIP_REGISTRY_ID),
        tx.pure.vector("u8", Array.from(Buffer.from(displayName.trim()))),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => { setCreating(false); load(); },
        onError: (e) => { setCreateError(e.message); setCreating(false); },
      }
    );
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <p className="text-3xl font-bold uppercase tracking-widest mb-4"
          style={{ fontFamily: "Cinzel, serif" }}>
          Connect Your Wallet
        </p>
        <p className="text-[var(--text-muted)]">Connect to view your fan profile.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-[var(--text-muted)] animate-pulse">Loading profile…</p>
      </div>
    );
  }

  // Create profile flow
  if (!profile) {
    return (
      <div className="max-w-md mx-auto px-6 py-24">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-6 text-center">
          — Begin Your Journey —
        </p>
        <h1 className="text-4xl font-bold uppercase tracking-tight mb-8 text-center"
          style={{ fontFamily: "Cinzel, serif" }}>
          Create Profile
        </h1>

        <div className="border border-[var(--border)] p-6 space-y-4">
          <div>
            <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-2">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Tokyo_Ronin"
              className="w-full bg-[var(--bg-raised)] border border-[var(--border)] px-3 py-2.5 text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--border-hi)] placeholder:text-[var(--text-dim)]"
            />
          </div>

          <div className="text-xs text-[var(--text-muted)] leading-relaxed">
            <p className="font-mono font-semibold text-[var(--text)] mb-1">Wallet</p>
            <p className="font-mono">{account.address.slice(0, 20)}…</p>
          </div>

          {createError && (
            <p className="text-xs text-[var(--crimson)] font-mono">{createError}</p>
          )}

          <button
            onClick={createProfile}
            disabled={isPending || creating}
            className="w-full py-3 bg-[var(--crimson)] hover:bg-[var(--crimson-hi)] disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm transition-colors"
          >
            {creating ? "Creating…" : "Begin the Path"}
          </button>
        </div>
      </div>
    );
  }

  const settledPredictions = predictions.filter((p) => p.settled);
  const totalPoints = settledPredictions.reduce((sum, p) => sum + p.points_earned, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-2">
          — Fan Profile —
        </p>
        <h1 className="text-4xl font-bold uppercase tracking-tight"
          style={{ fontFamily: "Cinzel, serif" }}>
          {profile.display_name}
        </h1>
        <p className="text-xs font-mono text-[var(--text-muted)] mt-2">
          {account.address}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Fanship badge */}
        <FanshipBadge profile={profile} />

        {/* Stats card */}
        <div className="border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-4">
            Season Stats
          </p>
          <div className="space-y-3">
            {[
              ["Total Points Earned", totalPoints.toLocaleString()],
              ["Clan", membership?.clan_name ?? "—"],
              ["Points to Clan", membership?.points_contributed.toLocaleString() ?? "—"],
              ["Season Joined", `Season ${profile.joined_season}`],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-mono">{k}</span>
                <span className="font-semibold text-[var(--text)] text-sm">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booster inventory */}
      <div className="mb-12">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-4">
          — Booster Inventory ({boosters.length}) —
        </p>
        {boosters.length === 0 ? (
          <div className="border border-[var(--border)] p-8 text-center">
            <p className="text-[var(--text-muted)] text-sm">
              No Boosters yet. Earn them by participating in events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {boosters.map((b) => {
              const baseBps = rarityBaseBps(b.rarity);
              const effBps = effectiveMultiplier(baseBps, profile);
              return (
                <div
                  key={b.id}
                  className={`border p-4 bg-[var(--bg-card)] ${
                    b.is_used ? "opacity-40 border-[var(--border)]" : "border-[var(--border-hi)]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`font-semibold ${RARITY_COLORS[b.rarity]}`}>{b.name}</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                        {RARITY_LABELS[b.rarity]} · {b.earned_at_event}
                      </p>
                      <p className="text-xs text-[var(--text-dim)] mt-2 leading-relaxed">
                        {b.description}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      {b.is_used ? (
                        <span className="text-xs font-mono text-[var(--text-dim)] uppercase">Used</span>
                      ) : (
                        <>
                          <p className="font-mono font-bold text-[var(--gold)]">
                            {bpsToMultiplier(effBps)}
                          </p>
                          <p className="text-xs text-[var(--text-muted)] font-mono">effective</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Prediction history */}
      {predictions.length > 0 && (
        <div>
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-4">
            — Prediction History —
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
                  <p className="text-sm text-[var(--text)] font-semibold">
                    {pred.fight_id}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                    {OUTCOME_LABELS[pred.predicted_outcome]}
                    {pred.predicted_round > 0 && ` · R${pred.predicted_round}`}
                    {" · "}{pred.predicted_winner}
                    {pred.booster_multiplier > 100 && (
                      <span className="text-[var(--gold)]">
                        {" · "}{bpsToMultiplier(pred.booster_multiplier)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  {pred.settled ? (
                    <>
                      <p className={`font-mono font-bold text-sm ${pred.is_correct ? "text-[var(--green)]" : "text-zinc-600"}`}>
                        {pred.is_correct ? "+" : ""}{pred.points_earned} pts
                      </p>
                      <p className="text-xs font-mono text-[var(--text-muted)]">
                        {pred.is_correct ? "✓ Correct" : "✗ Wrong"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                      Pending
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}