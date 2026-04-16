#[test_only]
module fanship::fanship_test {

    use sui::test_scenario::{Self as ts, Scenario};
    use sui::test_utils::assert_eq;
    use fanship::fanship::{
        Self, FanRegistry, FanProfile, AdminCap,
        get_fanship_score, is_veteran, get_booster_multiplier, has_profile
    };

    const ADMIN: address  = @0xAD;
    const FAN_A: address  = @0xA1;
    const FAN_B: address  = @0xA2;

    fun setup(): Scenario {
        let mut scenario = ts::begin(ADMIN);
        {
            fanship::init_for_testing(ts::ctx(&mut scenario));
        };
        scenario
    }

    #[test]
    fun test_create_profile() {
        let mut scenario = setup();

        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut registry = ts::take_shared<FanRegistry>(&scenario);
            fanship::create_profile(&mut registry, b"Ronin_Tokyo", ts::ctx(&mut scenario));
            assert!(has_profile(&registry, FAN_A), 0);
            ts::return_shared(registry);
        };

        ts::next_tx(&mut scenario, FAN_A);
        {
            let profile = ts::take_from_sender<FanProfile>(&scenario);
            assert_eq(get_fanship_score(&profile), 0);
            assert_eq(is_veteran(&profile), false);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_score_accumulation_and_veteran_status() {
        let mut scenario = setup();

        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut registry = ts::take_shared<FanRegistry>(&scenario);
            fanship::create_profile(&mut registry, b"Veteran_Fan", ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        // Admin records 5 event attendances (5 * 100 = 500 pts → veteran threshold)
        let mut i = 0;
        while (i < 5) {
            ts::next_tx(&mut scenario, ADMIN);
            {
                let cap = ts::take_from_sender<AdminCap>(&scenario);
                let mut profile = ts::take_from_address<FanProfile>(&scenario, FAN_A);
                fanship::record_event_attendance(&cap, &mut profile, b"ONE_SAMURAI_1", ts::ctx(&mut scenario));
                ts::return_to_address(FAN_A, profile);
                ts::return_to_sender(&scenario, cap);
            };
            i = i + 1;
        };

        ts::next_tx(&mut scenario, FAN_A);
        {
            let profile = ts::take_from_sender<FanProfile>(&scenario);
            assert_eq(get_fanship_score(&profile), 500);
            assert_eq(is_veteran(&profile), true);
            // Veteran gets 1.5x booster multiplier
            assert_eq(get_booster_multiplier(&profile), 150);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = fanship::fanship::EProfileAlreadyExists)]
    fun test_duplicate_profile_fails() {
        let mut scenario = setup();

        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut registry = ts::take_shared<FanRegistry>(&scenario);
            fanship::create_profile(&mut registry, b"First", ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut registry = ts::take_shared<FanRegistry>(&scenario);
            // Should abort — profile already exists
            fanship::create_profile(&mut registry, b"Second", ts::ctx(&mut scenario));
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }
}
