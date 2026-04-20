"use client";

import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { CONTRACT, OUTCOME_LABELS, type FightPool, type FanProfile, type Booster, NULL_ADDRESS } from "@/lib/sui";
import BoosterEquip from "./BoosterEquip";

interface Props {
  pool: FightPool;
  profile: FanProfile;
  boosters: Booster[];
  existingPrediction?: boolean;
  onSuccess?: () => void;
}

export default function PredictionCard({
  pool,
  profile,
  boosters,
  existingPrediction,
  onSuccess,
}: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [outcome, setOutcome] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [winner, setWinner] = useState("");
  const [selectedBooster, setSelectedBooster] = useState<Booster | null>(null);
  const [error, setError] = useState("");

  const availableBoosters = boosters.filter((b) => !b.is_used);
  const fighters = [pool.fighter_a, pool.fighter_b];

  function buildTx(): Transaction {
    const tx = new Transaction();

    if (selectedBooster) {
      tx.moveCall({
        target: `${CONTRACT.PREDICTION_PKG}::prediction::submit_prediction_with_booster`,
        arguments: [
          tx.object(pool.id),
          tx.object(profile.id),
          tx.object(selectedBooster.id),
          tx.pure.u8(outcome!),
          tx.pure.u64(round),
          tx.pure.vector("u8", Array.from(Buffer.from(winner))),
        ],
      });
    } else {
      tx.moveCall({
        target: `${CONTRACT.PREDICTION_PKG}::prediction::submit_prediction`,
        arguments: [
          tx.object(pool.id),
          tx.object(profile.id),
          tx.pure.u8(outcome!),
          tx.pure.u64(round),
          tx.pure.vector("u8", Array.from(Buffer.from(winner))),
        ],
      });
    }
    return tx;
  }

  function submit() {
    if (outcome === null) { setError("Select an outcome."); return; }
    if (!winner)          { setError("Select a winner."); return; }
    setError("");

    signAndExecute(
      { transaction: buildTx() },
      {
        onSuccess: () => onSuccess?.(),
        onError: (e) => setError(e.message),
      }
    );
  }

  const disabled = !pool.window_open || pool.settled || !!existingPrediction || !account;

  return (
    <div className="border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">
            {pool.event_name}
          </p>
          <h3
            className="text-xl font-bold uppercase tracking-wide"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            <span className="text-[var(--text)]">{pool.fighter_a}</span>
            <span className="text-[var(--text-muted)] mx-3 font-light">vs</span>
            <span className="text-[var(--text)]">{pool.fighter_b}</span>
          </h3>
        </div>

        <span
          className={`text-xs font-mono font-bold px-3 py-1 uppercase tracking-wider ${
            pool.settled
              ? "bg-zinc-800 text-zinc-500"
              : pool.window_open
              ? "bg-[var(--crimson)]/20 text-[var(--crimson)]"
              : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {pool.settled
            ? "Settled"
            : pool.window_open
            ? "● Live"
            : "Closed"}
        </span>
      </div>

      {/* Settled result */}
      {pool.settled && (
        <div className="px-5 py-4 bg-[var(--bg-raised)] border-b border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1">
            Result
          </p>
          <p className="font-semibold text-[var(--gold)]">
            {pool.actual_winner} by {OUTCOME_LABELS[pool.actual_outcome]}{" "}
            {pool.actual_round > 0 && `(Round ${pool.actual_round})`}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono mt-1">
            {pool.total_correct}/{pool.total_predictions} correct
          </p>
        </div>
      )}

      {/* Already predicted */}
      {existingPrediction && !pool.settled && (
        <div className="px-5 py-4 text-sm text-[var(--green)] bg-[var(--green)]/5 border-b border-[var(--border)]">
          ✓ Your prediction is locked in.
        </div>
      )}

      {/* Prediction form */}
      {!disabled && !existingPrediction && (
        <div className="px-5 py-5 space-y-5">
          {/* Outcome */}
          <div>
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Outcome
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OUTCOME_LABELS).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setOutcome(Number(k))}
                  className={`py-2 px-3 text-sm font-semibold uppercase tracking-wider border transition-colors ${
                    outcome === Number(k)
                      ? "border-[var(--crimson)] text-[var(--crimson)] bg-[var(--crimson)]/10"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hi)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Winner */}
          <div>
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Winner
            </p>
            <div className="grid grid-cols-2 gap-2">
              {fighters.map((fighter) => (
                <button
                  key={fighter}
                  onClick={() => setWinner(fighter)}
                  className={`py-2 px-3 text-sm font-semibold uppercase tracking-wider border transition-colors ${
                    winner === fighter
                      ? "border-[var(--gold)] text-[var(--gold)] bg-[var(--gold)]/10"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hi)]"
                  }`}
                >
                  {fighter}
                </button>
              ))}
            </div>
          </div>

          {/* Round */}
          <div>
            <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
              Round (optional)
            </p>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => setRound(r)}
                  className={`w-10 h-10 text-sm font-mono font-bold border transition-colors ${
                    round === r
                      ? "border-[var(--text-muted)] text-[var(--text)]"
                      : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-hi)]"
                  }`}
                >
                  {r === 0 ? "—" : r}
                </button>
              ))}
            </div>
          </div>

          {/* Booster */}
          {availableBoosters.length > 0 && (
            <BoosterEquip
              boosters={availableBoosters}
              profile={profile}
              selected={selectedBooster}
              onSelect={setSelectedBooster}
            />
          )}

          {error && (
            <p className="text-xs text-[var(--crimson)] font-mono">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={isPending}
            className="w-full py-3 bg-[var(--crimson)] hover:bg-[var(--crimson-hi)] disabled:opacity-50 text-white font-bold uppercase tracking-widest text-sm transition-colors"
          >
            {isPending ? "Submitting…" : "Lock In Prediction"}
          </button>
        </div>
      )}

      {/* Stats footer */}
      <div className="px-5 py-3 border-t border-[var(--border)] flex gap-6">
        <p className="text-xs font-mono text-[var(--text-muted)]">
          {pool.total_predictions} predictions
        </p>
      </div>
    </div>
  );
}