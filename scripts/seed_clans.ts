/**
 * seed_clans.ts
 * Creates the initial set of ONE Samurai regional clans on-chain.
 * Run after deploy_contracts.sh:
 *   npx ts-node scripts/seed_clans.ts
 */

import "dotenv/config";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromB64 } from "@mysten/sui/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClanDef {
  name: string;
  region: string;
  description: string;
}

// ─── Clan definitions ─────────────────────────────────────────────────────────

const CLANS: ClanDef[] = [
  {
    name: "Team Tokyo",
    region: "Tokyo",
    description:
      "The capital's finest — where champions are forged in the neon shadow of the big city.",
  },
  {
    name: "Team Osaka",
    region: "Osaka",
    description:
      "Relentless fighters from the merchant heart of Japan. Brawlers first, always.",
  },
  {
    name: "Team Nagoya",
    region: "Nagoya",
    description:
      "Industrial grit and samurai discipline from the heart of Aichi.",
  },
  {
    name: "Team Kyoto",
    region: "Kyoto",
    description:
      "Ancient traditions meet modern martial arts. Technique over brute force.",
  },
  {
    name: "Team Fukuoka",
    region: "Fukuoka",
    description:
      "The gateway to Asia — fighters shaped by continental influences and fierce local pride.",
  },
  {
    name: "Team Sapporo",
    region: "Sapporo",
    description:
      "Battle-hardened in the cold north. Hokkaido's warriors never quit.",
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

  const clanPackageId  = requireEnv("CLAN_PACKAGE_ID");
  const adminCapId     = requireEnv("CLAN_ADMIN_CAP_ID");
  const clanRegistryId = requireEnv("NEXT_PUBLIC_CLAN_REGISTRY_ID");

  console.log(`\n⚔️  Seeding clans on ${network}`);
  console.log(`   Signer : ${keypair.getPublicKey().toSuiAddress()}`);
  console.log(`   Package: ${clanPackageId}\n`);

  const results: { name: string; digest: string; clanId: string }[] = [];

  for (const clan of CLANS) {
    process.stdout.write(`Creating "${clan.name}" (${clan.region})... `);

    const tx = new Transaction();

    tx.moveCall({
      target: `${clanPackageId}::clan::create_clan`,
      arguments: [
        tx.object(adminCapId),
        tx.object(clanRegistryId),
        tx.pure.vector("u8", toBytes(clan.name)),
        tx.pure.vector("u8", toBytes(clan.region)),
        tx.pure.vector("u8", toBytes(clan.description)),
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: { showObjectChanges: true, showEffects: true },
    });

    if (result.effects?.status.status !== "success") {
      console.error(`\n  ✗ Failed: ${result.effects?.status.error}`);
      continue;
    }

    // Extract the created Clan shared object ID
    const clanId =
      result.objectChanges
        ?.filter(
          (c) =>
            c.type === "created" &&
            "objectType" in c &&
            c.objectType.includes("::clan::Clan") &&
            "owner" in c &&
            typeof (c as { owner: unknown }).owner === "object" &&
            (c as { owner: { Shared?: unknown } }).owner.Shared !== undefined
        )
        .map((c) => ("objectId" in c ? c.objectId : ""))[0] ?? "unknown";

    console.log(`✓  ${result.digest}`);
    results.push({ name: clan.name, digest: result.digest, clanId });

    // Brief pause between transactions to avoid rate limiting on public nodes
    await sleep(1_500);
  }

  console.log("\n── Seeded Clans ──────────────────────────────────────────");
  for (const r of results) {
    console.log(`  ${r.name}`);
    console.log(`    Clan Object ID : ${r.clanId}`);
    console.log(`    Digest         : ${r.digest}`);
  }
  console.log("\n  Copy clan object IDs into your frontend config as needed.");
  console.log("  Next: run 'npx ts-node scripts/mint_boosters.ts'\n");
}

main().catch((err) => {
  console.error("seed_clans failed:", err);
  process.exit(1);
});