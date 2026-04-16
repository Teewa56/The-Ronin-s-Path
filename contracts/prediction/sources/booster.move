/// Module: booster
/// Handles Booster items — digital power-ups earned from past events.
/// Booster multipliers are weighted by the fan's Fanship Score.
module prediction::booster {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use std::string::{Self, String};
    use fanship::fanship::{FanProfile, get_booster_multiplier, get_owner};

    // ============================================================
    // Errors
    // ============================================================
    const ENotOwner: u64       = 0;
    const EBoosterUsed: u64    = 1;
    const EBoosterNotActive: u64 = 2;

    // ============================================================
    // Booster Rarity Tiers
    // ============================================================
    const RARITY_COMMON: u8    = 0;
    const RARITY_RARE: u8      = 1;
    const RARITY_LEGENDARY: u8 = 2;

    // Base multipliers in basis points per rarity (before fanship weight)
    const BASE_MULT_COMMON: u64    = 120; // 1.2x
    const BASE_MULT_RARE: u64      = 150; // 1.5x
    const BASE_MULT_LEGENDARY: u64 = 180; // 1.8x (up to 2x with veteran fanship)

    // ============================================================
    // Structs
    // ============================================================

    public struct AdminCap has key, store {
        id: UID,
    }

    /// A Booster object owned by a fan.
    public struct Booster has key, store {
        id: UID,
        owner: address,
        name: String,
        description: String,
        rarity: u8,
        /// Which ONE Samurai event this was earned at
        earned_at_event: String,
        /// Whether this booster has been consumed (used in a prediction)
        is_used: bool,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct BoosterMinted has copy, drop {
        booster_id: ID,
        owner: address,
        rarity: u8,
        earned_at_event: String,
    }

    public struct BoosterConsumed has copy, drop {
        booster_id: ID,
        owner: address,
        effective_multiplier: u64,
    }

    // ============================================================
    // Init
    // ============================================================

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ============================================================
    // Admin — Mint Boosters
    // ============================================================

    /// Mint a booster and send it to a fan. Called post-event by admin.
    public entry fun mint_booster(
        _cap: &AdminCap,
        recipient: address,
        name: vector<u8>,
        description: vector<u8>,
        rarity: u8,
        event_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        let booster = Booster {
            id: object::new(ctx),
            owner: recipient,
            name: string::utf8(name),
            description: string::utf8(description),
            rarity,
            earned_at_event: string::utf8(event_name),
            is_used: false,
        };

        let booster_id = object::id(&booster);

        event::emit(BoosterMinted {
            booster_id,
            owner: recipient,
            rarity,
            earned_at_event: booster.earned_at_event,
        });

        transfer::transfer(booster, recipient);
    }

    // ============================================================
    // Public — Booster Logic
    // ============================================================

    /// Compute the effective multiplier for a booster + fan profile combo.
    /// Returns multiplier in basis points (e.g., 200 = 2x).
    public fun compute_effective_multiplier(
        booster: &Booster,
        profile: &FanProfile
    ): u64 {
        assert!(!booster.is_used, EBoosterUsed);

        let base = if (booster.rarity == RARITY_LEGENDARY) {
            BASE_MULT_LEGENDARY
        } else if (booster.rarity == RARITY_RARE) {
            BASE_MULT_RARE
        } else {
            BASE_MULT_COMMON
        };

        // Fanship multiplier from profile (in basis points, e.g. 200 = 2x)
        let fanship_mult = get_booster_multiplier(profile);

        // Blend: effective = base + (fanship_mult - 100) / 2
        // This means a veteran fan gets extra on top of the booster base
        let bonus = (fanship_mult - 100) / 2;
        let effective = base + bonus;

        // Cap at 200 (2x)
        if (effective > 200) { 200 } else { effective }
    }

    /// Consume a booster during prediction. Marks it as used.
    /// Returns the effective multiplier to be applied to the prediction score.
    public fun consume_booster(
        booster: &mut Booster,
        profile: &FanProfile,
        ctx: &mut TxContext
    ): u64 {
        let sender = tx_context::sender(ctx);
        assert!(booster.owner == sender, ENotOwner);
        assert!(!booster.is_used, EBoosterUsed);
        assert!(get_owner(profile) == sender, ENotOwner);

        let effective_mult = compute_effective_multiplier(booster, profile);
        booster.is_used = true;

        event::emit(BoosterConsumed {
            booster_id: object::id(booster),
            owner: sender,
            effective_multiplier: effective_mult,
        });

        effective_mult
    }

    // ============================================================
    // View Helpers
    // ============================================================

    public fun is_used(booster: &Booster): bool { booster.is_used }
    public fun get_rarity(booster: &Booster): u8 { booster.rarity }
    public fun get_owner_addr(booster: &Booster): address { booster.owner }
    public fun rarity_common(): u8 { RARITY_COMMON }
    public fun rarity_rare(): u8 { RARITY_RARE }
    public fun rarity_legendary(): u8 { RARITY_LEGENDARY }
}
