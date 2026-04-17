import {
  SuiClient,
  getFullnodeUrl,
} from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/sui/utils";
import pino from "pino";

const log = pino({ name: "publisher" });

// Sui system clock object ID — constant across all networks
const SUI_CLOCK_ID = "0x6";

// ─── Outcome encoding mirrors prediction.move constants ──────────────────────
const OUTCOME_MAP: Record<string, number> = {
  KO: 0,
  SUBMISSION: 1,
  DECISION: 2,
  DQ: 3,
};

export interface PublisherConfig {
  network: "mainnet" | "testnet" | "devnet" | "localnet";
  privateKey: string;          // base64 encoded 32-byte seed

  // Package IDs — set after deployment
  predictionPackageId: string;
  fanshipPackageId: string;
  clanPackageId: string;

  // Shared object IDs — set after deployment
  predictionAdminCapId: string;
  clanRegistryId: string;
}

export class OnChainPublisher {
  private readonly client: SuiClient;
  private readonly keypair: Ed25519Keypair;
  private readonly cfg: PublisherConfig;

  constructor(cfg: PublisherConfig) {
    this.cfg = cfg;
    this.client = new SuiClient({ url: getFullnodeUrl(cfg.network) });

    // Accept raw base64 seed (32 bytes) or Sui bech32 private key
    if (cfg.privateKey.startsWith("suiprivkey")) {
      this.keypair = Ed25519Keypair.fromSecretKey(cfg.privateKey);
    } else {
      const seed = fromB64(cfg.privateKey);
      this.keypair = Ed25519Keypair.fromSecretKey(seed);
    }

    log.info(
      { address: this.keypair.getPublicKey().toSuiAddress() },
      "Oracle signer initialised"
    );
  }

  // ── Fight pool management ─────────────────────────────────────────────────

  /**
   * Create a FightPredictionPool and open the prediction window.
   * Call this when a fight is confirmed on the event card.
   */
  async createFightPool(
    fightId: string,
    fighterA: string,
    fighterB: string,
    eventName: string
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.cfg.predictionPackageId}::prediction::create_fight_pool`,
      arguments: [
        tx.object(this.cfg.predictionAdminCapId),
        tx.pure.vector("u8", Array.from(Buffer.from(fightId))),
        tx.pure.vector("u8", Array.from(Buffer.from(fighterA))),
        tx.pure.vector("u8", Array.from(Buffer.from(fighterB))),
        tx.pure.vector("u8", Array.from(Buffer.from(eventName))),
      ],
    });

    return this.execute(tx, "create_fight_pool");
  }

  /**
   * Close the prediction window. Call when fighters are about to walk out.
   */
  async closePredictionWindow(fightPoolId: string): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.cfg.predictionPackageId}::prediction::close_prediction_window`,
      arguments: [
        tx.object(this.cfg.predictionAdminCapId),
        tx.object(fightPoolId),
      ],
    });

    return this.execute(tx, "close_prediction_window");
  }

  /**
   * Settle the fight with the official result.
   */
  async settleFight(
    fightPoolId: string,
    outcome: "KO" | "SUBMISSION" | "DECISION" | "DQ",
    round: number,
    winner: string
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.cfg.predictionPackageId}::prediction::settle_fight`,
      arguments: [
        tx.object(this.cfg.predictionAdminCapId),
        tx.object(fightPoolId),
        tx.pure.u8(OUTCOME_MAP[outcome]),
        tx.pure.u64(round),
        tx.pure.vector("u8", Array.from(Buffer.from(winner))),
      ],
    });

    return this.execute(tx, "settle_fight");
  }

  // ── Death Blow Moments ────────────────────────────────────────────────────

  /**
   * Open a 60-second Death Blow micro-prediction window.
   * Returns the new DeathBlowMoment object ID for tracking.
   */
  async createDeathBlow(
    fightId: string,
    prompt: string
  ): Promise<{ digest: string; momentId: string }> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.cfg.predictionPackageId}::prediction::create_death_blow`,
      arguments: [
        tx.object(this.cfg.predictionAdminCapId),
        tx.pure.vector("u8", Array.from(Buffer.from(fightId))),
        tx.pure.vector("u8", Array.from(Buffer.from(prompt))),
        tx.object(SUI_CLOCK_ID),
      ],
    });

    const digest = await this.execute(tx, "create_death_blow");

    // Fetch the transaction to extract the created DeathBlowMoment object ID
    const txData = await this.client.getTransactionBlock({
      digest,
      options: { showObjectChanges: true },
    });

    const momentId = txData.objectChanges
      ?.filter(
        (c) =>
          c.type === "created" &&
          "objectType" in c &&
          c.objectType.includes("DeathBlowMoment")
      )
      .map((c) => ("objectId" in c ? c.objectId : ""))[0] ?? "";

    log.info({ momentId, fightId }, "Death Blow Moment created");
    return { digest, momentId };
  }

  /**
   * Settle a Death Blow Moment with the correct answer.
   */
  async settleDeathBlow(
    momentId: string,
    correctAnswer: boolean
  ): Promise<string> {
    const tx = new Transaction();

    tx.moveCall({
      target: `${this.cfg.predictionPackageId}::prediction::settle_death_blow`,
      arguments: [
        tx.object(this.cfg.predictionAdminCapId),
        tx.object(momentId),
        tx.pure.bool(correctAnswer),
      ],
    });

    return this.execute(tx, "settle_death_blow");
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async execute(tx: Transaction, label: string): Promise<string> {
    try {
      const result = await this.client.signAndExecuteTransaction({
        signer: this.keypair,
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      if (result.effects?.status.status !== "success") {
        throw new Error(
          `Transaction failed: ${result.effects?.status.error ?? "unknown"}`
        );
      }

      log.info(
        { label, digest: result.digest },
        "Transaction confirmed"
      );
      return result.digest;
    } catch (err) {
      log.error({ err, label }, "Transaction failed");
      throw err;
    }
  }
}