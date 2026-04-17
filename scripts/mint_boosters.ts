/**
 * mint_boosters.ts
 * Mints initial Booster packs and distributes them to fan addresses.
 * Run after seed_clans.ts or post-event to reward participants.
 *
 * Usage:
 *   npx ts-node scripts/mint_boosters.ts
 *
 * To mint for a specific list of winners, update the RECIPIENTS array below
 * or pipe addresses in via RECIPIENTS_FILE env var pointing to a JSON file:
 *   [{ "address": "0x...", "rarity": 0, "event": "ONE Samurai 1" }]
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/sui/utils";

// ─── Rarity constants (mirrors booster.move) ─────────────────────────────────

const RARITY_COMMON    = 0;
const RARITY_RARE      = 1;
const RARITY_LEGENDARY = 2;

const RARITY_LABEL: Record<number, string> = {
  [RARITY_COMMON]:    "Common",
  [RARITY_RARE]:      "Rare",
  [RARITY_LEGENDARY]: "Legendary",
};

// ─── Booster definitions ──────────────────────────────────────────────────────

interface BoosterDef {
  name: string;
  description: string;
  rarity: number;
}

const BOOSTER_CATALOG: BoosterDef[] = [
  {
    name: "Ronin's Mark",
    description: "Earned by a faithful fan. The path begins here.",
    rarity: RARITY_COMMON,
  },
  {
    name: "Dojo Seal",
    description:
      "Granted to fans who predicted correctly at their first event. Rare and coveted.",
    rarity: RARITY_RARE,
  },
  {
    name: "Samurai's Legacy",
    description:
      "The mark of a veteran — held only by those who have walked the full path.",
    rarity: RARITY_LEGENDARY,
  },
];

// ─── Recipient spec ───────────────────────────────────────────────────────────

interface RecipientSpec {
  address: string;
  rarity: number;         // 0 = common, 1 = rare, 2 = legendary
  event: string;          // which ONE Samurai event it was earned at
  boosterIndex?: number;  // index into BOOSTER_CATALOG; defaults to matching rarity
}

// ── Default: mint one of each rarity to a test address ───────────────────────
// Replace or extend this array for production use.
const DEFAULT_RECIPIENTS: RecipientSpec[] = [
  {
    address: process.env.TEST_RECIPIENT ?? "0x0000000000000000000000000000000000000000000000000000000000000001",
    rarity: RARITY_COMMON,
    event: "ONE Samurai 1",
  },
  {
    address: process.env.TEST_RECIPIENT ?? "0x0000000000000000000000000000000000000000000000000000000000000001",
    rarity: RARITY_RARE,
    event: "ONE Samurai 1",
  },
  {
    address: process.env.TEST_RECIPIENT ?? "0x0000000000000000000000000000000000000000000000000000000000000001",
    rarity: RARITY_LEGENDARY,
    event: "ONE Samurai 1",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function toBytes(s: string): number[] {
  return Array.from(Buffer.from(s, "utf8"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function loadRecipients(): RecipientSpec[] {
  const file = process.env.RECIPIENTS_FILE;
  if (!file) return DEFAULT_RECIPIENTS;

  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as RecipientSpec[];
    console.log(`Loaded ${parsed.length} recipients from ${file}`);
    return parsed;
  } catch (err) {
    console.error(`Failed to load RECIPIENTS_FILE (${file}):`, err);
    process.exit(1);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const network = (process.env.NEXT_PUBLIC_SUI_NETWORK ?? "testnet") as
    | "mainnet"
    | "testnet"
    | "devnet"
    | "localnet";

  const client = new SuiClient({ url: getFullnodeUrl(network) });

  const privateKey = requireEnv("ORACLE_PRIVATE_KEY");
  const keypair = privateKey.startsWith("suiprivkey")
    ? Ed25519Keypair.fromSecretKey(privateKey)
    : Ed25519Keypair.fromSecretKey(fromB64(privateKey));

  const predictionPackageId = requireEnv("PREDICTION_PACKAGE_ID");
  const boosterAdminCapId   = requireEnv("PREDICTION_ADMIN_CAP_ID");

  const recipients = loadRecipients();

  console.log(`\n🧪 Minting Boosters on ${network}`);
  console.log(`   Signer    : ${keypair.getPublicKey().toSuiAddress()}`);
  console.log(`   Package   : ${predictionPackageId}`);
  console.log(`   Boosters  : ${recipients.length}\n`);

  let minted = 0;
  let failed = 0;

  for (const spec of recipients) {
    // Pick booster definition: explicit index or first matching rarity
    const boosterDef =
      spec.boosterIndex !== undefined
        ? BOOSTER_CATALOG[spec.boosterIndex]
        : BOOSTER_CATALOG.find((b) => b.rarity === spec.rarity) ??
          BOOSTER_CATALOG[0];

    process.stdout.write(
      `Minting ${RARITY_LABEL[spec.rarity]} "${boosterDef.name}" → ${spec.address.slice(0, 10)}...  `
    );

    const tx = new Transaction();

    tx.moveCall({
      target: `${predictionPackageId}::booster::mint_booster`,
      arguments: [
        tx.object(boosterAdminCapId),
        tx.pure.address(spec.address),
        tx.pure.vector("u8", toBytes(boosterDef.name)),
        tx.pure.vector("u8", toBytes(boosterDef.description)),
        tx.pure.u8(spec.rarity),
        tx.pure.vector("u8", toBytes(spec.event)),
      ],
    });

    try {
      const result = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showEffects: true },
      });

      if (result.effects?.status.status !== "success") {
        throw new Error(result.effects?.status.error ?? "unknown failure");
      }

      console.log(`✓  ${result.digest}`);
      minted++;
    } catch (err) {
      console.error(`✗  ${(err as Error).message}`);
      failed++;
    }

    await sleep(1_200);
  }

  console.log("\n── Mint Summary ──────────────────────────────────────────");
  console.log(`  ✓ Minted : ${minted}`);
  if (failed > 0) console.log(`  ✗ Failed : ${failed}`);
  console.log();
}

main().catch((err) => {
  console.error("mint_boosters failed:", err);
  process.exit(1);
});