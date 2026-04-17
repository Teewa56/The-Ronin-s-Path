#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy_contracts.sh
# Deploys all three Ronin's Path Move packages in dependency order:
#   1. fanship  (no deps)
#   2. clan     (depends on fanship)
#   3. prediction (depends on fanship + clan)
#
# After each deployment, extracts the PackageId and AdminCap object IDs
# and writes them into .env at the project root.
#
# Prerequisites:
#   - sui CLI installed and configured (sui client active-address shows your wallet)
#   - jq installed
#   - .env.example copied to .env
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"
ENV_FILE="$ROOT_DIR/.env"
GAS_BUDGET=200000000

# ─── Colour helpers ───────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()     { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ─── Sanity checks ────────────────────────────────────────────────────────────
command -v sui  >/dev/null 2>&1 || die "sui CLI not found"
command -v jq   >/dev/null 2>&1 || die "jq not found (brew install jq / apt install jq)"

[[ -f "$ENV_FILE" ]] || { warn ".env not found — copying from .env.example"; cp "$ROOT_DIR/.env.example" "$ENV_FILE"; }

ACTIVE_ADDR=$(sui client active-address 2>/dev/null)
info "Deploying as: $ACTIVE_ADDR"

# ─── Helper: write or update a key in .env ────────────────────────────────────
set_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${val}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
  info "  $key=$val"
}

# ─── Helper: publish a package and return its JSON output ────────────────────
publish_package() {
  local pkg_dir="$1"
  info "Building & publishing: $pkg_dir"
  pushd "$pkg_dir" > /dev/null

  local output
  output=$(sui client publish \
    --gas-budget "$GAS_BUDGET" \
    --json 2>/dev/null) || die "Publish failed in $pkg_dir"

  popd > /dev/null
  echo "$output"
}

# ─── Helper: extract field from publish output ────────────────────────────────
extract_package_id() {
  echo "$1" | jq -r '
    .objectChanges[]
    | select(.type == "published")
    | .packageId'
}

extract_object_id_by_type() {
  local output="$1" type_fragment="$2"
  echo "$output" | jq -r --arg t "$type_fragment" '
    .objectChanges[]
    | select(.type == "created" and (.objectType // "" | contains($t)))
    | .objectId' | head -n1
}

extract_shared_object_id_by_type() {
  local output="$1" type_fragment="$2"
  echo "$output" | jq -r --arg t "$type_fragment" '
    .objectChanges[]
    | select(
        .type == "created" and
        (.objectType // "" | contains($t)) and
        (.owner.Shared != null)
      )
    | .objectId' | head -n1
}

# ═════════════════════════════════════════════════════════════════════════════
# 1. FANSHIP
# ═════════════════════════════════════════════════════════════════════════════
info "── Step 1: fanship ──────────────────────────────────────"

FANSHIP_OUT=$(publish_package "$CONTRACTS_DIR/fanship")

FANSHIP_PKG=$(extract_package_id "$FANSHIP_OUT")
[[ -n "$FANSHIP_PKG" ]] || die "Could not extract fanship packageId"

FANSHIP_ADMIN_CAP=$(extract_object_id_by_type "$FANSHIP_OUT" "::fanship::AdminCap")
FANSHIP_REGISTRY=$(extract_shared_object_id_by_type "$FANSHIP_OUT" "::fanship::FanRegistry")

set_env "FANSHIP_PACKAGE_ID"   "$FANSHIP_PKG"
set_env "FANSHIP_ADMIN_CAP_ID" "$FANSHIP_ADMIN_CAP"
set_env "FANSHIP_REGISTRY_ID"  "$FANSHIP_REGISTRY"

# Patch clan/Move.toml so it resolves the deployed fanship address
info "Patching clan/Move.toml with deployed fanship address"
sed -i.bak "s|fanship = \"0x0\"|fanship = \"${FANSHIP_PKG}\"|g" \
  "$CONTRACTS_DIR/clan/Move.toml" && rm -f "$CONTRACTS_DIR/clan/Move.toml.bak"

# ═════════════════════════════════════════════════════════════════════════════
# 2. CLAN
# ═════════════════════════════════════════════════════════════════════════════
info "── Step 2: clan ─────────────────────────────────────────"

CLAN_OUT=$(publish_package "$CONTRACTS_DIR/clan")

CLAN_PKG=$(extract_package_id "$CLAN_OUT")
[[ -n "$CLAN_PKG" ]] || die "Could not extract clan packageId"

CLAN_ADMIN_CAP=$(extract_object_id_by_type "$CLAN_OUT" "::clan::AdminCap")
CLAN_REGISTRY=$(extract_shared_object_id_by_type "$CLAN_OUT" "::clan::ClanRegistry")

set_env "CLAN_PACKAGE_ID"                 "$CLAN_PKG"
set_env "CLAN_ADMIN_CAP_ID"               "$CLAN_ADMIN_CAP"
set_env "NEXT_PUBLIC_CLAN_REGISTRY_ID"    "$CLAN_REGISTRY"

# Patch prediction/Move.toml
info "Patching prediction/Move.toml with deployed addresses"
sed -i.bak \
  -e "s|fanship = \"0x0\"|fanship = \"${FANSHIP_PKG}\"|g" \
  -e "s|clan = \"0x0\"|clan = \"${CLAN_PKG}\"|g" \
  "$CONTRACTS_DIR/prediction/Move.toml" && rm -f "$CONTRACTS_DIR/prediction/Move.toml.bak"

# ═════════════════════════════════════════════════════════════════════════════
# 3. PREDICTION
# ═════════════════════════════════════════════════════════════════════════════
info "── Step 3: prediction ───────────────────────────────────"

PREDICTION_OUT=$(publish_package "$CONTRACTS_DIR/prediction")

PREDICTION_PKG=$(extract_package_id "$PREDICTION_OUT")
[[ -n "$PREDICTION_PKG" ]] || die "Could not extract prediction packageId"

PREDICTION_ADMIN_CAP=$(extract_object_id_by_type "$PREDICTION_OUT" "::prediction::AdminCap")

set_env "PREDICTION_PACKAGE_ID"   "$PREDICTION_PKG"
set_env "PREDICTION_ADMIN_CAP_ID" "$PREDICTION_ADMIN_CAP"

# Also set the combined NEXT_PUBLIC_PACKAGE_ID expected by the frontend
set_env "NEXT_PUBLIC_PACKAGE_ID" "$PREDICTION_PKG"

# ═════════════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════════════
echo ""
info "════════════════════════════════════════"
info "Deployment complete. Addresses written to .env:"
info ""
info "  FANSHIP_PACKAGE_ID   = $FANSHIP_PKG"
info "  CLAN_PACKAGE_ID      = $CLAN_PKG"
info "  PREDICTION_PACKAGE_ID= $PREDICTION_PKG"
info ""
info "  FANSHIP_ADMIN_CAP_ID = $FANSHIP_ADMIN_CAP"
info "  CLAN_ADMIN_CAP_ID    = $CLAN_ADMIN_CAP"
info "  PREDICTION_ADMIN_CAP = $PREDICTION_ADMIN_CAP"
info ""
info "  CLAN_REGISTRY_ID     = $CLAN_REGISTRY"
info "  FANSHIP_REGISTRY_ID  = $FANSHIP_REGISTRY"
info "════════════════════════════════════════"
info "Next step: run 'npx ts-node scripts/seed_clans.ts'"