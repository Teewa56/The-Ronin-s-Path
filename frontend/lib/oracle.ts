"use client";

import { suiClient, CONTRACT, parseDeathBlow, type DeathBlowMoment } from "./sui";

// ── Death Blow event subscription ─────────────────────────────────────────────
// Subscribes to on-chain DeathBlowCreated events and invokes a callback
// when a new Death Blow Moment appears. Returns an unsubscribe function.

export type DeathBlowHandler = (moment: DeathBlowMoment) => void;

async function getLatestEventCursor(filter: { MoveEventType: string }) {
  const page = await suiClient.queryEvents({
    query: filter,
    limit: 1,
    order: "descending",
  });
  return page.data[0]?.id ?? null;
}

export async function subscribeToDeathBlows(
  onMoment: DeathBlowHandler
): Promise<() => void> {
  if (!CONTRACT.PREDICTION_PKG) return () => {};

  const filter = {
    MoveEventType: `${CONTRACT.PREDICTION_PKG}::prediction::DeathBlowCreated`,
  } as const;

  let cursor = await getLatestEventCursor(filter);
  let cancelled = false;
  const interval = setInterval(async () => {
    if (cancelled) return;

    try {
      const page = await suiClient.queryEvents({
        query: filter,
        cursor: cursor ?? undefined,
        limit: 20,
        order: "ascending",
      });

      if (page.data.length > 0) {
        cursor = page.nextCursor ?? cursor;
        for (const event of page.data) {
          // The event carries moment_id — fetch the full object
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const momentId = (event.parsedJson as any)?.moment_id as string;
          if (!momentId) continue;

          try {
            const obj = await suiClient.getObject({
              id: momentId,
              options: { showContent: true },
            });
            if (!obj.data) continue;
            const moment = parseDeathBlow(obj.data);
            if (moment) onMoment(moment);
          } catch {
            /* object may not be indexed yet — ignore */
          }
        }
      }
    } catch {
      /* ignore polling failures */
    }
  }, 5000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}

// ── Fight pool settlement subscription ────────────────────────────────────────
// Notifies when a fight is settled on-chain.

export type FightSettledHandler = (fightId: string) => void;

export async function subscribeToFightSettlements(
  onSettled: FightSettledHandler
): Promise<() => void> {
  if (!CONTRACT.PREDICTION_PKG) return () => {};

  const filter = {
    MoveEventType: `${CONTRACT.PREDICTION_PKG}::prediction::FightSettled`,
  } as const;

  let cursor = await getLatestEventCursor(filter);
  let cancelled = false;
  const interval = setInterval(async () => {
    if (cancelled) return;

    try {
      const page = await suiClient.queryEvents({
        query: filter,
        cursor: cursor ?? undefined,
        limit: 20,
        order: "ascending",
      });

      if (page.data.length > 0) {
        cursor = page.nextCursor ?? cursor;
        for (const event of page.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fightId = (event.parsedJson as any)?.fight_id as string;
          if (fightId) onSettled(fightId);
        }
      }
    } catch {
      /* ignore polling failures */
    }
  }, 5000);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}