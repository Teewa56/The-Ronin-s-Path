# ⚔️ The Ronin's Path
### A Gamified On-Chain Fan Prediction Quest — Powered by Sui

> *"A warrior's legacy is written in every battle. So is a fan's."*

**The Ronin's Path** is a real-time, on-chain prediction and fan engagement platform built for ONE Championship's Japanese audience. Fans join regional Clans, lock in fight predictions boosted by their verified fan history, compete in Dojo Wars across events, and earn an on-chain legacy that grows with every bout — all powered by Sui's Programmable Transaction Blocks and sub-second finality.

---

## 🧩 The Problem

ONE Championship's Japanese fanbase is passionate — but passive. Fans watch, cheer, and leave. There is no gamified, long-term engagement layer that rewards loyalty, tests fight knowledge, or builds community between events. The martial arts world also suffers from unverifiable credentials and fan histories that exist nowhere except memory.

---

## 💡 The Solution

**The Ronin's Path** turns every ONE Samurai event into an interactive quest:

| Feature | Description |
|---|---|
| ⚔️ **Prediction Quest** | Fans lock in fight predictions before each bout (e.g., "Submission in Round 2") |
| 🧪 **Booster System** | Fans equip digital Boosters earned from past events to multiply prediction scores |
| 🏯 **Clan Clash** | Fans join regional Clans (e.g., Team Tokyo vs. Team Osaka) and compete for communal prizes |
| ⚡ **Death Blow Moments** | Real-time mid-fight micro-predictions triggered by live oracles, settled instantly on-chain |
| 🗡️ **Dojo Wars** | A season-long meta-game where Clan standings accumulate across all ONE Samurai events |
| 📜 **True Fanship (Kensho Layer)** | On-chain fan history that weights Boosters — longer, truer fans get mechanical advantages |

---

## 🏗️ How It Works

### 1. Fan Onboarding
- Fan connects their Sui wallet
- Fan selects or is assigned to a regional **Clan** (based on location or preference)
- Fan's on-chain history is read — past events attended, predictions made, Boosters earned — to compute their **Fanship Score**

### 2. Pre-Fight Prediction
- Before each fight, a **Prediction Window** opens on-chain via a Sui smart contract
- Fan submits a prediction (outcome, method, round) as a Sui object
- Fan optionally **equips a Booster** (a previously earned digital item) to increase potential score
- Booster power is weighted by the fan's **Fanship History** — rare Boosters held by long-time fans carry more weight

### 3. Live — Death Blow Moments
- During the fight, a live oracle pushes real-time fight events on-chain
- A **micro-prediction window** (60 seconds) opens mid-fight
- Fans can submit a fast prediction (e.g., "Knockdown in next 60s") settled instantly via Sui's sub-second finality
- Correct micro-predictions earn **bonus XP** and **Booster fragments**

### 4. Post-Fight Settlement
- Sui's PTBs batch-settle all predictions atomically after the fight
- Points are distributed to correct predictors and aggregated to their Clan's season score
- New Boosters, badges, and rank certificates are minted and delivered to winning fans

### 5. Dojo Wars (Season Meta-Game)
- Clan scores accumulate across every ONE Samurai event
- The top-ranked Clan at season end earns the right to **sponsor a fighter's corner** at the next event — displayed on-chain and on broadcast
- A dedicated **meet-and-greet** is awarded to the communal prize pool winners

---

## 🔗 Sui Technology Used

| Tech | Usage |
|---|---|
| **Programmable Transaction Blocks (PTBs)** | Batch-settle all fan predictions atomically in a single transaction post-fight |
| **Sui Objects** | Predictions, Boosters, Clan memberships, and Rank Certificates are all on-chain objects |
| **Sui Kiosk** | Dojos and Clans can sell/transfer Trial Memberships and Booster packs as verifiable NFTs |
| **On-chain Oracles** | Feed live fight events to trigger Death Blow Moment micro-prediction windows |
| **Move Smart Contracts** | Govern prediction logic, Booster weighting, Clan scoring, and Fanship history tracking |
| **Walrus (Storage)** | Store fan profiles, Clan histories, and lineage metadata off-chain but verifiably |

---

## 📁 Folder Structure

```
ronins-path/
│
├── contracts/                  # Sui Move smart contracts
│   ├── prediction/             # Prediction quest logic
│   │   ├── sources/
│   │   │   ├── prediction.move
│   │   │   ├── booster.move
│   │   │   └── settlement.move
│   │   └── Move.toml
│   ├── clan/                   # Clan registration & scoring
│   │   ├── sources/
│   │   │   ├── clan.move
│   │   │   └── dojo_wars.move
│   │   └── Move.toml
│   └── fanship/                # True Fanship / Kensho layer
│       ├── sources/
│       │   ├── fanship.move
│       │   └── lineage.move
│       └── Move.toml
│
├── frontend/                   # Next.js web application
│   ├── app/
│   │   ├── page.tsx            # Landing / home
│   │   ├── clan/               # Clan selection & leaderboard
│   │   ├── quest/              # Prediction quest UI
│   │   ├── profile/            # Fan profile & Booster inventory
│   │   └── dojo-wars/          # Season standings
│   ├── components/
│   │   ├── PredictionCard.tsx
│   │   ├── BoosterEquip.tsx
│   │   ├── ClanLeaderboard.tsx
│   │   ├── DeathBlowModal.tsx  # Real-time micro-prediction UI
│   │   └── FanshipBadge.tsx
│   ├── lib/
│   │   ├── sui.ts              # Sui SDK client setup
│   │   ├── oracle.ts           # Live fight event oracle listener
│   │   └── fanship.ts          # Fanship score computation
│   ├── public/
│   └── package.json
│
├── oracle/                     # Live fight event oracle service
│   ├── index.ts                # Oracle server entry point
│   ├── feed.ts                 # Fight event data feed handler
│   └── publisher.ts            # On-chain event publisher
│
├── scripts/                    # Deployment & utility scripts
│   ├── deploy_contracts.sh
│   ├── seed_clans.ts
│   └── mint_boosters.ts
│
├── tests/                      # Contract unit tests
│   ├── prediction_test.move
│   ├── clan_test.move
│   └── fanship_test.move
│
├── .env.example
├── README.md
└── package.json
```

---

## ⚙️ Setup & Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) installed and configured
- A Sui wallet (e.g., Sui Wallet browser extension)
- Sui Testnet or Devnet access

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/ronins-path.git
cd ronins-path
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install oracle service dependencies
cd ../oracle
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID=<your_deployed_package_id>
NEXT_PUBLIC_CLAN_REGISTRY_ID=<clan_registry_object_id>
ORACLE_PRIVATE_KEY=<oracle_signer_private_key>
ORACLE_FEED_URL=<live_fight_data_feed_url>
WALRUS_ENDPOINT=<walrus_storage_endpoint>
```

### 4. Deploy Move Contracts

```bash
cd contracts/prediction
sui move build
sui client publish --gas-budget 100000000

cd ../clan
sui move build
sui client publish --gas-budget 100000000

cd ../fanship
sui move build
sui client publish --gas-budget 100000000
```

> Copy the published Package IDs into your `.env` file.

### 5. Seed Initial Clans

```bash
cd scripts
npx ts-node seed_clans.ts
```

### 6. Run the Oracle Service

```bash
cd oracle
npm run start
```

### 7. Run the Frontend

```bash
cd frontend
npm run dev
```

App will be live at `http://localhost:3000`

---

## 🎮 Core User Flow

```
Connect Wallet
     │
     ▼
Join a Clan (Team Tokyo, Team Osaka, etc.)
     │
     ▼
Fanship Score Computed from On-chain History
     │
     ▼
Pre-Fight: Lock in Prediction + Equip Booster
     │
     ▼
Mid-Fight: Death Blow Moment (60s micro-prediction)
     │
     ▼
Post-Fight: PTB settles all predictions atomically
     │
     ▼
Earn Points, Boosters, Badges → Clan Score Updated
     │
     ▼
Season End: Dojo Wars Winner Sponsors Fighter's Corner
```

---

## 🏆 Scoring & Fanship Weight

| Fan Action | Points |
|---|---|
| Correct pre-fight prediction | 100 pts |
| Correct method (e.g., submission) | +50 pts |
| Correct round | +50 pts |
| Correct Death Blow micro-prediction | +75 pts |
| Booster equipped (common) | 1.2x multiplier |
| Booster equipped (rare, long-time fan) | 2.0x multiplier |
| Fanship Score > 500 (veteran fan) | +10% base bonus |

Booster multipliers are weighted by **Fanship History** — a fan who has participated in 5+ events with a verified on-chain record gets stronger Booster effects than a newcomer equipping the same Booster.

---

## 🗺️ Roadmap

- [x] Core prediction quest contracts (Move)
- [x] Clan registration & scoring system
- [x] Booster minting & equip logic
- [x] Fanship / Kensho lineage layer
- [ ] Live oracle integration (Death Blow Moments)
- [ ] Dojo Wars season leaderboard UI
- [ ] Walrus-backed fan profile storage
- [ ] Mobile-optimized frontend
- [ ] Mainnet deployment

---

## 👥 Team

Built for the **Sui x ONE Samurai Tokyo Builders' Arena** hackathon (Apr 2026).

---

## 📄 License

MIT License. See `LICENSE` for details.
