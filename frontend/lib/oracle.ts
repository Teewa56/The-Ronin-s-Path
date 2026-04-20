"use client";

import { suiClient, CONTRACT, parseDeathBlow, type DeathBlowMoment } from "./sui";

// ── Death Blow event subscription ─────────────────────────────────────────────
// Subscribes to on-chain DeathBlowCreated events and invokes a callback
// when a new Death Blow Moment appears. Returns an unsubscribe function.

export type DeathBlowHandler = (moment: DeathBlowMoment) => void;

export async function subscribeToDeathBlows(
  onMoment: DeathBlowHandler
): Promise<() => void> {
  if (!CONTRACT.PREDICTION_PKG) return () => {};

  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT.PREDICTION_PKG}::prediction::DeathBlowCreated`,
    },
    onMessage: async (event) => {
      // The event carries moment_id — fetch the full object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const momentId = (event.parsedJson as any)?.moment_id as string;
      if (!momentId) return;

      try {
        const obj = await suiClient.getObject({
          id: momentId,
          options: { showContent: true },
        });
        if (!obj.data) return;
        const moment = parseDeathBlow(obj.data);
        if (moment) onMoment(moment);
      } catch {
        /* object may not be indexed yet — ignore */
      }
    },
  });

  return unsubscribe;
}

// ── Fight pool settlement subscription ────────────────────────────────────────
// Notifies when a fight is settled on-chain.

export type FightSettledHandler = (fightId: string) => void;

export async function subscribeToFightSettlements(
  onSettled: FightSettledHandler
): Promise<() => void> {
  if (!CONTRACT.PREDICTION_PKG) return () => {};

  const unsubscribe = await suiClient.subscribeEvent({
    filter: {
      MoveEventType: `${CONTRACT.PREDICTION_PKG}::prediction::FightSettled`,
    },
    onMessage: (event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fightId = (event.parsedJson as any)?.fight_id as string;
      if (fightId) onSettled(fightId);
    },
  });

  return unsubscribe;
}