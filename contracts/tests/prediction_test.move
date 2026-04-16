#[test_only]
module prediction::prediction_test {

    use sui::test_scenario::{Self as ts};
    use sui::test_utils::assert_eq;
    use sui::clock;
    use fanship::fanship::{Self, FanRegistry, FanProfile};
    use prediction::prediction::{
        Self, FightPredictionPool, Prediction, AdminCap,
        get_points, is_correct, is_settled, pool_is_open, pool_is_settled,
        outcome_ko, outcome_submission, outcome_decision
    };

    const ADMIN: address = @0xAD;
    const FAN_A: address = @0xA1;
    const FAN_B: address = @0xA2;

    fun setup_with_profile(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, ADMIN);
        {
            fanship::init_for_testing(ts::ctx(scenario));
            prediction::init_for_testing(ts::ctx(scenario));
        };

        ts::next_tx(scenario, FAN_A);
        {
            let mut registry = ts::take_shared<FanRegistry>(scenario);
            fanship::create_profile(&mut registry, b"FanA", ts::ctx(scenario));
            ts::return_shared(registry);
        };
    }

    #[test]
    fun test_full_prediction_flow() {
        let mut scenario = ts::begin(ADMIN);
        setup_with_profile(&mut scenario);

        // Admin creates fight pool
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            prediction::create_fight_pool(
                &cap,
                b"fight_001",
                b"Takeru Segawa",
                b"Superbon",
                b"ONE Samurai 1",
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, cap);
        };

        // Fan submits prediction: KO, Round 2
        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut pool = ts::take_shared<FightPredictionPool>(&scenario);
            let profile = ts::take_from_sender<FanProfile>(&scenario);
            assert!(pool_is_open(&pool), 0);

            prediction::submit_prediction(
                &mut pool,
                &profile,
                outcome_ko(),
                2,
                b"Takeru Segawa",
                ts::ctx(&mut scenario)
            );

            ts::return_shared(pool);
            ts::return_to_sender(&scenario, profile);
        };

        // Admin closes window and settles fight: KO, Round 2, Takeru wins
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut pool = ts::take_shared<FightPredictionPool>(&scenario);
            prediction::close_prediction_window(&cap, &mut pool, ts::ctx(&mut scenario));
            prediction::settle_fight(&cap, &mut pool, outcome_ko(), 2, b"Takeru Segawa", ts::ctx(&mut scenario));
            assert!(pool_is_settled(&pool), 0);
            ts::return_shared(pool);
            ts::return_to_sender(&scenario, cap);
        };

        // Fan scores their prediction
        ts::next_tx(&mut scenario, FAN_A);
        {
            let pool = ts::take_shared<FightPredictionPool>(&scenario);
            let mut prediction = ts::take_from_sender<Prediction>(&scenario);
            let profile = ts::take_from_sender<FanProfile>(&scenario);

            prediction::score_prediction(&pool, &mut prediction, &profile, ts::ctx(&mut scenario));

            // Correct outcome (100) + correct round (50) + correct winner (50) = 200 pts
            assert_eq(get_points(&prediction), 200);
            assert!(is_correct(&prediction), 0);
            assert!(is_settled(&prediction), 0);

            ts::return_shared(pool);
            ts::return_to_sender(&scenario, prediction);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_wrong_prediction_earns_zero() {
        let mut scenario = ts::begin(ADMIN);
        setup_with_profile(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            prediction::create_fight_pool(&cap, b"fight_002", b"A", b"B", b"ONE Samurai 1", ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, cap);
        };

        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut pool = ts::take_shared<FightPredictionPool>(&scenario);
            let profile = ts::take_from_sender<FanProfile>(&scenario);
            // Fan predicts Submission but fight ends by KO
            prediction::submit_prediction(&mut pool, &profile, outcome_submission(), 1, b"A", ts::ctx(&mut scenario));
            ts::return_shared(pool);
            ts::return_to_sender(&scenario, profile);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut pool = ts::take_shared<FightPredictionPool>(&scenario);
            prediction::close_prediction_window(&cap, &mut pool, ts::ctx(&mut scenario));
            prediction::settle_fight(&cap, &mut pool, outcome_ko(), 3, b"B", ts::ctx(&mut scenario));
            ts::return_shared(pool);
            ts::return_to_sender(&scenario, cap);
        };

        ts::next_tx(&mut scenario, FAN_A);
        {
            let pool = ts::take_shared<FightPredictionPool>(&scenario);
            let mut pred = ts::take_from_sender<Prediction>(&scenario);
            let profile = ts::take_from_sender<FanProfile>(&scenario);
            prediction::score_prediction(&pool, &mut pred, &profile, ts::ctx(&mut scenario));
            assert_eq(get_points(&pred), 0);
            assert_eq(is_correct(&pred), false);
            ts::return_shared(pool);
            ts::return_to_sender(&scenario, pred);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_death_blow_moment() {
        let mut scenario = ts::begin(ADMIN);
        setup_with_profile(&mut scenario);

        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            prediction::create_death_blow(
                &cap,
                b"fight_003",
                b"Will there be a knockdown in the next 60 seconds?",
                &clk,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, cap);
        };

        clock::destroy_for_testing(clk);
        ts::end(scenario);
    }
}
