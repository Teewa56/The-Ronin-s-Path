/// Module: fanship
/// Tracks a fan's on-chain history across ONE Samurai events.
/// Computes a Fanship Score used to weight Booster multipliers in the prediction quest.
module fanship::fanship {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use std::string::{Self, String};

    // ============================================================
    // Errors
    // ============================================================
    const EProfileAlreadyExists: u64 = 0;
    const EProfileNotFound: u64     = 1;
    const ENotAuthorized: u64       = 2;

    // ============================================================
    // Constants — Fanship Score Thresholds
    // ============================================================
    const SCORE_PER_EVENT: u64       = 100;
    const SCORE_PER_PREDICTION: u64  = 10;
    const SCORE_PER_CORRECT: u64     = 25;
    const VETERAN_THRESHOLD: u64     = 500;  // qualifies for veteran bonus

    // ============================================================
    // Structs
    // ============================================================

    /// Shared registry: maps fan address → FanProfile ID
    public struct FanRegistry has key {
        id: UID,
        profiles: Table<address, ID>,
        total_fans: u64,
    }

    /// A fan's on-chain identity and history.
    /// Owned by the fan's wallet.
    public struct FanProfile has key, store {
        id: UID,
        owner: address,
        display_name: String,
        /// Number of ONE Samurai events participated in
        events_attended: u64,
        /// Total predictions ever submitted
        total_predictions: u64,
        /// Total correct predictions
        correct_predictions: u64,
        /// Accumulated fanship score
        fanship_score: u64,
        /// Whether the fan is a verified veteran (score >= VETERAN_THRESHOLD)
        is_veteran: bool,
        /// Clan ID this fan belongs to (0x0 if none)
        clan_id: address,
        /// Season the fan first joined
        joined_season: u64,
    }

    /// Admin capability — only held by the contract deployer.
    /// Used to record event participation and update scores.
    public struct AdminCap has key, store {
        id: UID,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct ProfileCreated has copy, drop {
        fan: address,
        profile_id: ID,
    }

    public struct ScoreUpdated has copy, drop {
        fan: address,
        new_score: u64,
        is_veteran: bool,
    }

    public struct EventAttended has copy, drop {
        fan: address,
        event_name: String,
        events_attended: u64,
    }

    // ============================================================
    // Init
    // ============================================================

    fun init(ctx: &mut TxContext) {
        // Create and share the fan registry
        let registry = FanRegistry {
            id: object::new(ctx),
            profiles: table::new(ctx),
            total_fans: 0,
        };
        transfer::share_object(registry);

        // Transfer admin cap to deployer
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ============================================================
    // Public — Fan Actions
    // ============================================================

    /// Create a new fan profile. Each address can only have one profile.
    public entry fun create_profile(
        registry: &mut FanRegistry,
        display_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(!table::contains(&registry.profiles, sender), EProfileAlreadyExists);

        let profile = FanProfile {
            id: object::new(ctx),
            owner: sender,
            display_name: string::utf8(display_name),
            events_attended: 0,
            total_predictions: 0,
            correct_predictions: 0,
            fanship_score: 0,
            is_veteran: false,
            clan_id: @0x0,
            joined_season: 1,
        };

        let profile_id = object::id(&profile);
        table::add(&mut registry.profiles, sender, profile_id);
        registry.total_fans = registry.total_fans + 1;

        event::emit(ProfileCreated { fan: sender, profile_id });

        transfer::transfer(profile, sender);
    }

    /// Fan sets their clan affiliation.
    public entry fun set_clan(
        profile: &mut FanProfile,
        clan_id: address,
        ctx: &mut TxContext
    ) {
        assert!(profile.owner == tx_context::sender(ctx), ENotAuthorized);
        profile.clan_id = clan_id;
    }

    // ============================================================
    // Admin — Record On-Chain History
    // ============================================================

    /// Called by admin after each ONE Samurai event to record attendance.
    public entry fun record_event_attendance(
        _cap: &AdminCap,
        profile: &mut FanProfile,
        event_name: vector<u8>,
        _ctx: &mut TxContext
    ) {
        profile.events_attended = profile.events_attended + 1;
        profile.fanship_score = profile.fanship_score + SCORE_PER_EVENT;
        refresh_veteran_status(profile);

        event::emit(EventAttended {
            fan: profile.owner,
            event_name: string::utf8(event_name),
            events_attended: profile.events_attended,
        });
    }

    /// Called by the prediction contract after each prediction submission.
    public entry fun record_prediction(
        _cap: &AdminCap,
        profile: &mut FanProfile,
        was_correct: bool,
        _ctx: &mut TxContext
    ) {
        profile.total_predictions = profile.total_predictions + 1;
        profile.fanship_score = profile.fanship_score + SCORE_PER_PREDICTION;

        if (was_correct) {
            profile.correct_predictions = profile.correct_predictions + 1;
            profile.fanship_score = profile.fanship_score + SCORE_PER_CORRECT;
        };

        refresh_veteran_status(profile);

        event::emit(ScoreUpdated {
            fan: profile.owner,
            new_score: profile.fanship_score,
            is_veteran: profile.is_veteran,
        });
    }

    // ============================================================
    // View Helpers
    // ============================================================

    /// Returns the fan's booster multiplier in basis points (100 = 1x, 200 = 2x).
    /// Veterans with high scores get up to 2x.
    public fun get_booster_multiplier(profile: &FanProfile): u64 {
        if (profile.fanship_score >= 1000) {
            200 // 2.0x
        } else if (profile.fanship_score >= VETERAN_THRESHOLD) {
            150 // 1.5x
        } else if (profile.fanship_score >= 200) {
            130 // 1.3x
        } else {
            120 // 1.2x (base)
        }
    }

    public fun get_fanship_score(profile: &FanProfile): u64 {
        profile.fanship_score
    }

    public fun is_veteran(profile: &FanProfile): bool {
        profile.is_veteran
    }

    public fun get_owner(profile: &FanProfile): address {
        profile.owner
    }

    public fun get_clan_id(profile: &FanProfile): address {
        profile.clan_id
    }

    public fun has_profile(registry: &FanRegistry, fan: address): bool {
        table::contains(&registry.profiles, fan)
    }

    // ============================================================
    // Internal
    // ============================================================

    fun refresh_veteran_status(profile: &mut FanProfile) {
        if (profile.fanship_score >= VETERAN_THRESHOLD) {
            profile.is_veteran = true;
        };
    }
}
