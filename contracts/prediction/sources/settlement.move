/// Module: settlement
/// Handles post-fight batch settlement helpers and season-end
/// point aggregation from prediction scores into clan totals.
/// Designed to be called inside a single PTB for atomic execution.
module prediction::settlement {

    use sui::tx_context::{Self, TxContext};
    use fanship::fanship::{AdminCap as FanshipCap, FanProfile, record_prediction};
    use clan::clan::{AdminCap as ClanAdminCap, Clan, ClanRegistry, ClanMembership, add_clan_points};
    use prediction::prediction::{
        FightPredictionPool, Prediction,
        get_points, is_correct, is_settled
    };

    // ============================================================
    // Errors
    // ============================================================
    const EPredictionNotSettled: u64 = 0;
    const ENotOwner: u64             = 1;

    // ============================================================
    // Settlement Aggregation
    // ============================================================

    /// Full post-fight settlement for a single fan in one PTB call:
    /// 1. Reads points from the already-scored Prediction object
    /// 2. Updates the fan's Fanship profile (correct/incorrect flag)
    /// 3. Pushes earned points to the fan's Clan
    ///
    /// Call this for every fan in the same PTB after `score_prediction`
    /// to achieve atomic batch settlement via Sui's PTBs.
    public entry fun settle_fan(
        prediction: &Prediction,
        profile: &mut FanProfile,
        clan: &mut Clan,
        clan_registry: &ClanRegistry,
        membership: &mut ClanMembership,
        fanship_cap: &FanshipCap,
        clan_cap: &ClanAdminCap,
        ctx: &mut TxContext
    ) {
        assert!(is_settled(prediction), EPredictionNotSettled);

        let points = get_points(prediction);
        let correct = is_correct(prediction);

        // 1. Update fanship history
        record_prediction(fanship_cap, profile, correct, ctx);

        // 2. Push points to clan if fan earned any
        if (points > 0) {
            let fan_addr = tx_context::sender(ctx);
            add_clan_points(clan_cap, clan, clan_registry, fan_addr, points, membership, ctx);
        };
    }

    /// Lightweight version — only updates fanship, skips clan.
    /// Use when fan has no clan membership yet.
    public entry fun settle_fan_no_clan(
        prediction: &Prediction,
        profile: &mut FanProfile,
        fanship_cap: &FanshipCap,
        ctx: &mut TxContext
    ) {
        assert!(is_settled(prediction), EPredictionNotSettled);
        let correct = is_correct(prediction);
        record_prediction(fanship_cap, profile, correct, ctx);
    }

    /// Settle a Death Blow response into the fanship record.
    /// Points from Death Blow moments are clan-agnostic (individual XP only).
    public entry fun settle_death_blow_fan(
        points_earned: u64,
        was_correct: bool,
        profile: &mut FanProfile,
        fanship_cap: &FanshipCap,
        ctx: &mut TxContext
    ) {
        // Record the prediction attempt on the fanship profile
        record_prediction(fanship_cap, profile, was_correct, ctx);
        // Note: Death Blow points are tracked individually on the
        // DeathBlowResponse object — clan aggregation is done separately
        // by the admin in a follow-up PTB call to add_clan_points.
        let _ = points_earned;
    }
}