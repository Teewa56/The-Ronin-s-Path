import "dotenv/config";
import pino from "pino";
import { FightFeed, FeedEvent, buildDeathBlowPrompt } from "./feed";
import { OnChainPublisher } from "./publisher";

const log = pino({ name: "oracle" });

// ─── Config validation ────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

// ─── State: track active fight pools and death blow moments ──────────────────

interface ActiveFight {
  fightPoolId: string;   // on-chain FightPredictionPool object ID
  fightId: string;
  windowOpen: boolean;
}

// Maps fight_id → active fight state
const activeFights = new Map<string, ActiveFight>();

// Maps fight_id → list of pending death blow moment IDs (unresolved)
const pendingMoments = new Map<string, string[]>();

// ─── Event router ─────────────────────────────────────────────────────────────

async function handleFeedEvent(
  event: FeedEvent,
  publisher: OnChainPublisher
): Promise<void> {
  const { type, fight_id } = event;

  switch (type) {
    // ── Prediction window opens ─────────────────────────────────────────────
    case "fight_scheduled": {
      if (!event.fighter_a || !event.fighter_b || !event.event_name) {
        log.warn({ event }, "fight_scheduled missing fighter or event name");
        return;
      }

      log.info({ fight_id }, "Opening prediction pool");
      const digest = await publisher.createFightPool(
        fight_id,
        event.fighter_a,
        event.fighter_b,
        event.event_name
      );
      
      log.info({ digest, fight_id }, "Fight pool created on-chain");
      break;
    }

    // ── Prediction window closes ────────────────────────────────────────────
    case "fight_start": {
      const fightPoolId = event.fight_pool_id ?? event.fightPoolId;
      let fight = activeFights.get(fight_id);

      if (!fight) {
        if (!fightPoolId) {
          log.warn(
            { event },
            "fight_start missing fight_pool_id and no active fight tracked"
          );
          return;
        }

        registerFight(fight_id, fightPoolId);
        fight = activeFights.get(fight_id)!;
      }

      if (!fight.windowOpen) return;

      log.info({ fight_id, fightPoolId: fight.fightPoolId }, "Closing prediction window");
      await publisher.closePredictionWindow(fight.fightPoolId);
      fight.windowOpen = false;
      break;
    }

    // ── Death Blow Moments ──────────────────────────────────────────────────
    case "knockdown":
    case "submission_attempt":
    case "cut_stoppage":
    case "near_finish": {
      const fight = activeFights.get(fight_id);
      if (!fight) {
        log.warn({ fight_id, type }, "Death blow event for unknown fight");
        return;
      }

      const prompt = buildDeathBlowPrompt(event);
      log.info({ fight_id, prompt }, "Creating Death Blow Moment");

      const { momentId } = await publisher.createDeathBlow(fight_id, prompt);

      if (momentId) {
        const moments = pendingMoments.get(fight_id) ?? [];
        moments.push(momentId);
        pendingMoments.set(fight_id, moments);

        setTimeout(async () => {
          log.info({ momentId }, "Auto-settling Death Blow Moment (no result received)");
          try {
            // Default: incorrect (false) if no explicit result came in
            await publisher.settleDeathBlow(momentId, false);
          } catch (err) {
            log.error({ err, momentId }, "Auto-settle failed");
          }
        }, 65_000);
      }
      break;
    }

    // ── Death Blow result from feed ─────────────────────────────────────────
    case "death_blow_result": {
      if (!event.moment_id || event.correct_answer === undefined) {
        log.warn({ event }, "death_blow_result missing moment_id or correct_answer");
        return;
      }

      log.info(
        { moment_id: event.moment_id, correct_answer: event.correct_answer },
        "Settling Death Blow Moment"
      );
      await publisher.settleDeathBlow(event.moment_id, event.correct_answer);

      // Remove from pending
      const moments = pendingMoments.get(fight_id) ?? [];
      pendingMoments.set(
        fight_id,
        moments.filter((id) => id !== event.moment_id)
      );
      break;
    }

    // ── Fight end ───────────────────────────────────────────────────────────
    case "fight_end": {
      const fight = activeFights.get(fight_id);
      if (!fight) {
        log.warn({ fight_id }, "fight_end received but no active fight tracked");
        return;
      }

      if (!event.outcome || !event.winner) {
        log.warn({ event }, "fight_end missing outcome or winner");
        return;
      }

      const round = event.round ?? 0;
      log.info(
        { fight_id, outcome: event.outcome, round, winner: event.winner },
        "Settling fight"
      );

      await publisher.settleFight(
        fight.fightPoolId,
        event.outcome,
        round,
        event.winner
      );

      activeFights.delete(fight_id);
      pendingMoments.delete(fight_id);
      break;
    }

    default:
      log.debug({ type, fight_id }, "Unhandled feed event type");
  }
}

// ─── Register an active fight (called externally or via feed event) ───────────

export function registerFight(
  fightId: string,
  fightPoolId: string
): void {
  activeFights.set(fightId, {
    fightId,
    fightPoolId,
    windowOpen: true,
  });
  log.info({ fightId, fightPoolId }, "Fight registered");
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.info("Starting Ronin's Path Oracle");

  const publisher = new OnChainPublisher({
    network: (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
      | "mainnet"
      | "testnet"
      | "devnet"
      | "localnet",
    privateKey: requireEnv("ORACLE_PRIVATE_KEY"),
    predictionPackageId: requireEnv("PREDICTION_PACKAGE_ID"),
    fanshipPackageId: requireEnv("FANSHIP_PACKAGE_ID"),
    clanPackageId: requireEnv("CLAN_PACKAGE_ID"),
    predictionAdminCapId: requireEnv("PREDICTION_ADMIN_CAP_ID"),
    clanRegistryId: requireEnv("NEXT_PUBLIC_CLAN_REGISTRY_ID"),
  });

  const feed = new FightFeed(requireEnv("ORACLE_FEED_URL"));

  feed.onEvent((event) => {
    handleFeedEvent(event, publisher).catch((err) =>
      log.error({ err, event }, "Unhandled error in event handler")
    );
  });

  feed.start();
  log.info("Oracle running — listening for fight events");

  // Graceful shutdown
  process.on("SIGTERM", () => {
    log.info("SIGTERM received — shutting down");
    feed.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log.info("SIGINT received — shutting down");
    feed.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  log.fatal({ err }, "Oracle crashed");
  process.exit(1);
});