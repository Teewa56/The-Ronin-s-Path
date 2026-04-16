/// Module: prediction
/// Core prediction quest logic for The Ronin's Path.
/// Fans lock in fight predictions, optionally equip Boosters,
/// and scores are settled atomically via PTBs post-fight.
module prediction::prediction {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::{Self, String};
    use fanship::fanship::{FanProfile, get_owner, is_veteran};
    use prediction::booster::{Booster, consume_booster};

    // ============================================================
    // Errors
    // ============================================================
    const EWindowClosed: u64         = 0;
    const EWindowNotClosed: u64      = 1;
    const EAlreadyPredicted: u64     = 2;
    const ENotAuthorized: u64        = 3;
    const EFightNotFound: u64        = 4;
    const EFightAlreadySettled: u64  = 5;
    const EInvalidOutcome: u64       = 6;
    const EDeathBlowExpired: u64     = 7;

    // ============================================================
    // Constants — Outcomes
    // ============================================================
    /// Fight outcome types
    const OUTCOME_KO: u8         = 0;
    const OUTCOME_SUBMISSION: u8 = 1;
    const OUTCOME_DECISION: u8   = 2;
    const OUTCOME_DQ: u8         = 3;

    /// Base points
    const POINTS_CORRECT_OUTCOME: u64 = 100;
    const POINTS_CORRECT_METHOD: u64  = 50;
    const POINTS_CORRECT_ROUND: u64   = 50;
    const POINTS_DEATH_BLOW: u64      = 75;
    const VETERAN_BONUS_BPS: u64      = 110; // 10% bonus in basis points

    /// Death Blow window duration in milliseconds (60 seconds)
    const DEATH_BLOW_DURATION_MS: u64 = 60_000;

    // ============================================================
    // Structs
    // ============================================================

    public struct AdminCap has key, store {
        id: UID,
    }

    /// Shared object representing a single fight's prediction market
    public struct FightPredictionPool has key {
        id: UID,
        fight_id: String,
        fighter_a: String,
        fighter_b: String,
        event_name: String,
        /// Whether the prediction window is open
        window_open: bool,
        /// Whether the fight has been settled
        settled: bool,
        /// Actual outcome (set at settlement)
        actual_outcome: u8,
        actual_round: u64,
        actual_winner: String,
        /// fan address → Prediction ID
        predictions: Table<address, ID>,
        total_predictions: u64,
        total_correct: u64,
    }

    /// A fan's prediction for a single fight. Owned by the fan.
    public struct Prediction has key, store {
        id: UID,
        fan: address,
        fight_id: String,
        predicted_outcome: u8,    // KO / Submission / Decision / DQ
        predicted_round: u64,     // 0 = no round prediction
        predicted_winner: String,
        booster_multiplier: u64,  // in basis points; 100 = 1x (no booster)
        /// Points earned after settlement (0 until settled)
        points_earned: u64,
        is_correct: bool,
        settled: bool,
    }

    /// A Death Blow Moment — real-time mid-fight micro-prediction.
    /// Created by oracle/admin when a key fight moment is detected.
    public struct DeathBlowMoment has key {
        id: UID,
        fight_id: String,
        prompt: String,           // e.g., "Will there be a knockdown in the next 60 seconds?"
        expires_at_ms: u64,       // epoch ms when window closes
        settled: bool,
        correct_answer: bool,     // set at settlement
        responses: Table<address, bool>, // fan → their answer
        correct_fans: u64,
    }

    /// A fan's Death Blow response. Owned by the fan.
    public struct DeathBlowResponse has key, store {
        id: UID,
        fan: address,
        moment_id: ID,
        fight_id: String,
        answer: bool,
        points_earned: u64,
        settled: bool,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct FightPoolCreated has copy, drop {
        fight_id: String,
        fighter_a: String,
        fighter_b: String,
        event_name: String,
    }

    public struct PredictionSubmitted has copy, drop {
        fan: address,
        fight_id: String,
        predicted_outcome: u8,
        predicted_round: u64,
        booster_multiplier: u64,
    }

    public struct FightSettled has copy, drop {
        fight_id: String,
        actual_outcome: u8,
        actual_round: u64,
        total_correct: u64,
    }

    public struct PredictionScored has copy, drop {
        fan: address,
        fight_id: String,
        points_earned: u64,
        is_correct: bool,
    }

    public struct DeathBlowCreated has copy, drop {
        moment_id: ID,
        fight_id: String,
        prompt: String,
        expires_at_ms: u64,
    }

    public struct DeathBlowAnswered has copy, drop {
        fan: address,
        moment_id: ID,
        answer: bool,
    }

    public struct DeathBlowSettled has copy, drop {
        moment_id: ID,
        correct_answer: bool,
        correct_fans: u64,
    }

    // ============================================================
    // Init
    // ============================================================

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ============================================================
    // Admin — Fight Pool Management
    // ============================================================

    /// Create a new fight prediction pool and open the window.
    public entry fun create_fight_pool(
        _cap: &AdminCap,
        fight_id: vector<u8>,
        fighter_a: vector<u8>,
        fighter_b: vector<u8>,
        event_name: vector<u8>,
        ctx: &mut TxContext
    ) {
        let pool = FightPredictionPool {
            id: object::new(ctx),
            fight_id: string::utf8(fight_id),
            fighter_a: string::utf8(fighter_a),
            fighter_b: string::utf8(fighter_b),
            event_name: string::utf8(event_name),
            window_open: true,
            settled: false,
            actual_outcome: 0,
            actual_round: 0,
            actual_winner: string::utf8(b""),
            predictions: table::new(ctx),
            total_predictions: 0,
            total_correct: 0,
        };

        event::emit(FightPoolCreated {
            fight_id: pool.fight_id,
            fighter_a: pool.fighter_a,
            fighter_b: pool.fighter_b,
            event_name: pool.event_name,
        });

        transfer::share_object(pool);
    }

    /// Close the prediction window (called just before fight starts).
    public entry fun close_prediction_window(
        _cap: &AdminCap,
        pool: &mut FightPredictionPool,
        _ctx: &mut TxContext
    ) {
        pool.window_open = false;
    }

    /// Settle a fight: record actual result and score all predictions.
    /// Uses PTB to batch-process — call score_prediction for each fan in the same PTB.
    public entry fun settle_fight(
        _cap: &AdminCap,
        pool: &mut FightPredictionPool,
        actual_outcome: u8,
        actual_round: u64,
        actual_winner: vector<u8>,
        _ctx: &mut TxContext
    ) {
        assert!(!pool.settled, EFightAlreadySettled);
        assert!(!pool.window_open, EWindowNotClosed);
        assert!(actual_outcome <= OUTCOME_DQ, EInvalidOutcome);

        pool.actual_outcome = actual_outcome;
        pool.actual_round = actual_round;
        pool.actual_winner = string::utf8(actual_winner);
        pool.settled = true;

        event::emit(FightSettled {
            fight_id: pool.fight_id,
            actual_outcome,
            actual_round,
            total_correct: pool.total_correct,
        });
    }

    // ============================================================
    // Public — Fan Prediction Actions
    // ============================================================

    /// Submit a prediction without a booster.
    public entry fun submit_prediction(
        pool: &mut FightPredictionPool,
        profile: &FanProfile,
        predicted_outcome: u8,
        predicted_round: u64,
        predicted_winner: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_owner(profile) == sender, ENotAuthorized);
        assert!(pool.window_open, EWindowClosed);
        assert!(!table::contains(&pool.predictions, sender), EAlreadyPredicted);
        assert!(predicted_outcome <= OUTCOME_DQ, EInvalidOutcome);

        let prediction = Prediction {
            id: object::new(ctx),
            fan: sender,
            fight_id: pool.fight_id,
            predicted_outcome,
            predicted_round,
            predicted_winner: string::utf8(predicted_winner),
            booster_multiplier: 100, // 1x — no booster
            points_earned: 0,
            is_correct: false,
            settled: false,
        };

        let pred_id = object::id(&prediction);
        table::add(&mut pool.predictions, sender, pred_id);
        pool.total_predictions = pool.total_predictions + 1;

        event::emit(PredictionSubmitted {
            fan: sender,
            fight_id: pool.fight_id,
            predicted_outcome,
            predicted_round,
            booster_multiplier: 100,
        });

        transfer::transfer(prediction, sender);
    }

    /// Submit a prediction WITH a booster equipped.
    public entry fun submit_prediction_with_booster(
        pool: &mut FightPredictionPool,
        profile: &FanProfile,
        booster: &mut Booster,
        predicted_outcome: u8,
        predicted_round: u64,
        predicted_winner: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_owner(profile) == sender, ENotAuthorized);
        assert!(pool.window_open, EWindowClosed);
        assert!(!table::contains(&pool.predictions, sender), EAlreadyPredicted);
        assert!(predicted_outcome <= OUTCOME_DQ, EInvalidOutcome);

        // Consume booster and get fanship-weighted multiplier
        let booster_multiplier = consume_booster(booster, profile, ctx);

        let prediction = Prediction {
            id: object::new(ctx),
            fan: sender,
            fight_id: pool.fight_id,
            predicted_outcome,
            predicted_round,
            predicted_winner: string::utf8(predicted_winner),
            booster_multiplier,
            points_earned: 0,
            is_correct: false,
            settled: false,
        };

        let pred_id = object::id(&prediction);
        table::add(&mut pool.predictions, sender, pred_id);
        pool.total_predictions = pool.total_predictions + 1;

        event::emit(PredictionSubmitted {
            fan: sender,
            fight_id: pool.fight_id,
            predicted_outcome,
            predicted_round,
            booster_multiplier,
        });

        transfer::transfer(prediction, sender);
    }

    /// Score an individual prediction post-settlement.
    /// Designed to be called in a PTB alongside other fans' predictions.
    public entry fun score_prediction(
        pool: &mut FightPredictionPool,
        prediction: &mut Prediction,
        profile: &FanProfile,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(pool.settled, EWindowNotClosed);
        assert!(get_owner(profile) == sender, ENotAuthorized);
        assert!(!prediction.settled, EFightAlreadySettled);

        let mut base_points: u64 = 0;
        let mut is_correct = false;

        // Score outcome
        if (prediction.predicted_outcome == pool.actual_outcome) {
            base_points = base_points + POINTS_CORRECT_OUTCOME;
            is_correct = true;

            // Bonus for correct round
            if (prediction.predicted_round > 0 &&
                prediction.predicted_round == pool.actual_round) {
                base_points = base_points + POINTS_CORRECT_ROUND;
            };

            // Bonus for correct winner
            if (prediction.predicted_winner == pool.actual_winner) {
                base_points = base_points + POINTS_CORRECT_METHOD;
            };
        };

        // Veteran bonus (10%)
        if (is_veteran(profile) && base_points > 0) {
            base_points = (base_points * VETERAN_BONUS_BPS) / 100;
        };

        // Apply booster multiplier (basis points: 100 = 1x)
        let final_points = (base_points * prediction.booster_multiplier) / 100;

        prediction.points_earned = final_points;
        prediction.is_correct = is_correct;
        prediction.settled = true;

        if (is_correct) {
            pool.total_correct = pool.total_correct + 1;
        };

        event::emit(PredictionScored {
            fan: sender,
            fight_id: pool.fight_id,
            points_earned: final_points,
            is_correct,
        });
    }

    // ============================================================
    // Death Blow Moments — Real-Time Mid-Fight Micro-Predictions
    // ============================================================

    /// Oracle/admin creates a Death Blow Moment mid-fight.
    public entry fun create_death_blow(
        _cap: &AdminCap,
        fight_id: vector<u8>,
        prompt: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let now = clock::timestamp_ms(clock);
        let expires_at = now + DEATH_BLOW_DURATION_MS;

        let moment = DeathBlowMoment {
            id: object::new(ctx),
            fight_id: string::utf8(fight_id),
            prompt: string::utf8(prompt),
            expires_at_ms: expires_at,
            settled: false,
            correct_answer: false,
            responses: table::new(ctx),
            correct_fans: 0,
        };

        let moment_id = object::id(&moment);

        event::emit(DeathBlowCreated {
            moment_id,
            fight_id: moment.fight_id,
            prompt: moment.prompt,
            expires_at_ms: expires_at,
        });

        transfer::share_object(moment);
    }

    /// Fan submits a Death Blow answer (true/false) within the 60s window.
    public entry fun answer_death_blow(
        moment: &mut DeathBlowMoment,
        profile: &FanProfile,
        answer: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_owner(profile) == sender, ENotAuthorized);

        let now = clock::timestamp_ms(clock);
        assert!(now <= moment.expires_at_ms, EDeathBlowExpired);
        assert!(!moment.settled, EFightAlreadySettled);
        assert!(!table::contains(&moment.responses, sender), EAlreadyPredicted);

        table::add(&mut moment.responses, sender, answer);

        let response = DeathBlowResponse {
            id: object::new(ctx),
            fan: sender,
            moment_id: object::id(moment),
            fight_id: moment.fight_id,
            answer,
            points_earned: 0,
            settled: false,
        };

        event::emit(DeathBlowAnswered {
            fan: sender,
            moment_id: object::id(moment),
            answer,
        });

        transfer::transfer(response, sender);
    }

    /// Settle a Death Blow Moment with the correct answer.
    public entry fun settle_death_blow(
        _cap: &AdminCap,
        moment: &mut DeathBlowMoment,
        correct_answer: bool,
        _ctx: &mut TxContext
    ) {
        assert!(!moment.settled, EFightAlreadySettled);
        moment.correct_answer = correct_answer;
        moment.settled = true;

        event::emit(DeathBlowSettled {
            moment_id: object::id(moment),
            correct_answer,
            correct_fans: moment.correct_fans,
        });
    }

    /// Score an individual Death Blow response.
    public entry fun score_death_blow_response(
        moment: &mut DeathBlowMoment,
        response: &mut DeathBlowResponse,
        profile: &FanProfile,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(moment.settled, EWindowNotClosed);
        assert!(get_owner(profile) == sender, ENotAuthorized);
        assert!(!response.settled, EFightAlreadySettled);

        let mut points: u64 = 0;
        if (response.answer == moment.correct_answer) {
            points = POINTS_DEATH_BLOW;
            // Veteran bonus
            if (is_veteran(profile)) {
                points = (points * VETERAN_BONUS_BPS) / 100;
            };
            moment.correct_fans = moment.correct_fans + 1;
        };

        response.points_earned = points;
        response.settled = true;
    }

    // ============================================================
    // View Helpers
    // ============================================================

    public fun get_points(prediction: &Prediction): u64 { prediction.points_earned }
    public fun is_correct(prediction: &Prediction): bool { prediction.is_correct }
    public fun is_settled(prediction: &Prediction): bool { prediction.settled }
    public fun get_multiplier(prediction: &Prediction): u64 { prediction.booster_multiplier }
    public fun pool_is_open(pool: &FightPredictionPool): bool { pool.window_open }
    public fun pool_is_settled(pool: &FightPredictionPool): bool { pool.settled }
    public fun outcome_ko(): u8 { OUTCOME_KO }
    public fun outcome_submission(): u8 { OUTCOME_SUBMISSION }
    public fun outcome_decision(): u8 { OUTCOME_DECISION }
}
