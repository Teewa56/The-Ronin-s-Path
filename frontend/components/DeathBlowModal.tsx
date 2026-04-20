"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { CONTRACT, SUI_CLOCK_ID, type DeathBlowMoment, type FanProfile } from "@/lib/sui";

interface Props {
  moment: DeathBlowMoment;
  profile: FanProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeathBlowModal({ moment, profile, onClose, onSuccess }: Props) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [answered, setAnswered] = useState(false);
  const [error, setError] = useState("");
  const [msLeft, setMsLeft] = useState(
    Math.max(0, moment.expires_at_ms - Date.now())
  );

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, moment.expires_at_ms - Date.now());
      setMsLeft(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [moment.expires_at_ms]);

  const secondsLeft = Math.ceil(msLeft / 1000);
  const progressPct = Math.min(
    100,
    ((moment.expires_at_ms - Date.now()) /
      (moment.expires_at_ms - (moment.expires_at_ms - 60_000))) *
      100
  );

  function buildTx(answer: boolean): Transaction {
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONTRACT.PREDICTION_PKG}::prediction::answer_death_blow`,
      arguments: [
        tx.object(moment.id),
        tx.object(profile.id),
        tx.pure.bool(answer),
        tx.object(SUI_CLOCK_ID),
      ],
    });
    return tx;
  }

  function submit(answer: boolean) {
    setError("");
    signAndExecute(
      { transaction: buildTx(answer) },
      {
        onSuccess: () => { setAnswered(true); setTimeout(onSuccess, 1500); },
        onError: (e) => setError(e.message),
      }
    );
  }

  const expired = msLeft === 0;

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-[var(--crimson)] bg-[var(--bg-card)] overflow-hidden pulse-red"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xl">⚡</span>
            <p
              className="text-sm font-bold uppercase tracking-widest text-[var(--crimson)]"
              style={{ fontFamily: "Cinzel, serif" }}
            >
              Death Blow Moment
            </p>
          </div>
          <p className="text-[var(--text)] font-semibold text-lg leading-tight">
            {moment.prompt}
          </p>
        </div>

        {/* Countdown bar */}
        <div className="h-1.5 bg-[var(--border)]">
          <div
            className="h-full bg-[var(--crimson)] transition-all"
            style={{
              width: `${progressPct}%`,
              animation: `shrink ${secondsLeft}s linear forwards`,
            }}
          />
        </div>

        <div className="px-6 py-4">
          <p className="text-center font-mono text-4xl font-bold text-[var(--crimson)] mb-4">
            {expired ? "0" : secondsLeft}s
          </p>

          {answered ? (
            <p className="text-center text-[var(--green)] font-semibold py-2">
              ✓ Answer locked in!
            </p>
          ) : expired ? (
            <p className="text-center text-[var(--text-muted)] text-sm py-2">
              Window closed.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => submit(true)}
                disabled={isPending || !account}
                className="py-4 border-2 border-[var(--green)] text-[var(--green)] font-bold text-lg uppercase tracking-widest hover:bg-[var(--green)]/10 disabled:opacity-50 transition-colors"
              >
                YES
              </button>
              <button
                onClick={() => submit(false)}
                disabled={isPending || !account}
                className="py-4 border-2 border-[var(--crimson)] text-[var(--crimson)] font-bold text-lg uppercase tracking-widest hover:bg-[var(--crimson)]/10 disabled:opacity-50 transition-colors"
              >
                NO
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-[var(--crimson)] font-mono mt-3 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center">
          <button
            onClick={onClose}
            className="text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] font-mono tracking-widest uppercase"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}