#[test_only]
module clan::clan_test {

    use sui::test_scenario::{Self as ts};
    use sui::test_utils::assert_eq;
    use fanship::fanship::{Self, FanRegistry, FanProfile};
    use clan::clan::{
        Self, ClanRegistry, Clan, AdminCap, ClanMembership,
        get_season_score, get_member_count, is_member, get_current_season
    };

    const ADMIN: address  = @0xAD;
    const FAN_A: address  = @0xA1;
    const FAN_B: address  = @0xA2;

    fun setup(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, ADMIN);
        {
            fanship::init_for_testing(ts::ctx(scenario));
            clan::init_for_testing(ts::ctx(scenario));
        };
    }

    fun create_fan_profile(scenario: &mut ts::Scenario, fan: address, name: vector<u8>) {
        ts::next_tx(scenario, fan);
        {
            let mut registry = ts::take_shared<FanRegistry>(scenario);
            fanship::create_profile(&mut registry, name, ts::ctx(scenario));
            ts::return_shared(registry);
        };
    }

    #[test]
    fun test_create_clan() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<ClanRegistry>(&scenario);
            clan::create_clan(
                &cap,
                &mut registry,
                b"Team Tokyo",
                b"Tokyo",
                b"The pride of the capital",
                ts::ctx(&mut scenario)
            );
            assert_eq(registry.total_clans, 1);
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, cap);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_fan_joins_clan() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);
        create_fan_profile(&mut scenario, FAN_A, b"Tokyo_Ronin");

        // Admin creates clan
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<ClanRegistry>(&scenario);
            clan::create_clan(&cap, &mut registry, b"Team Tokyo", b"Tokyo", b"", ts::ctx(&mut scenario));
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, cap);
        };

        // Fan sets clan affiliation on profile
        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut clan = ts::take_shared<Clan>(&scenario);
            let clan_addr = sui::object::id_address(&clan);
            let mut profile = ts::take_from_sender<FanProfile>(&scenario);
            fanship::set_clan(&mut profile, clan_addr, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
            ts::return_shared(clan);
        };

        // Fan joins clan
        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut clan = ts::take_shared<Clan>(&scenario);
            let registry = ts::take_shared<ClanRegistry>(&scenario);
            let profile = ts::take_from_sender<FanProfile>(&scenario);
            clan::join_clan(&mut clan, &registry, &profile, ts::ctx(&mut scenario));
            assert_eq(get_member_count(&clan), 1);
            assert!(is_member(&clan, FAN_A), 0);
            ts::return_shared(clan);
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, profile);
        };

        // Verify membership token minted
        ts::next_tx(&mut scenario, FAN_A);
        {
            let membership = ts::take_from_sender<ClanMembership>(&scenario);
            assert_eq(membership.points_contributed, 0);
            ts::return_to_sender(&scenario, membership);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_clan_points_and_season() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);
        create_fan_profile(&mut scenario, FAN_A, b"Osaka_Warrior");

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<ClanRegistry>(&scenario);
            clan::create_clan(&cap, &mut registry, b"Team Osaka", b"Osaka", b"", ts::ctx(&mut scenario));
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, cap);
        };

        // Fan joins
        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut clan = ts::take_shared<Clan>(&scenario);
            let registry = ts::take_shared<ClanRegistry>(&scenario);
            let mut profile = ts::take_from_sender<FanProfile>(&scenario);
            let clan_addr = sui::object::id_address(&clan);
            fanship::set_clan(&mut profile, clan_addr, ts::ctx(&mut scenario));
            clan::join_clan(&mut clan, &registry, &profile, ts::ctx(&mut scenario));
            ts::return_shared(clan);
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, profile);
        };

        // Admin adds points
        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut clan = ts::take_shared<Clan>(&scenario);
            let registry = ts::take_shared<ClanRegistry>(&scenario);
            let mut membership = ts::take_from_address<ClanMembership>(&scenario, FAN_A);
            clan::add_clan_points(&cap, &mut clan, &registry, FAN_A, 200, &mut membership, ts::ctx(&mut scenario));
            assert_eq(get_season_score(&clan), 200);
            assert_eq(membership.points_contributed, 200);
            ts::return_shared(clan);
            ts::return_shared(registry);
            ts::return_to_address(FAN_A, membership);
            ts::return_to_sender(&scenario, cap);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = clan::clan::EAlreadyMember)]
    fun test_cannot_join_clan_twice() {
        let mut scenario = ts::begin(ADMIN);
        setup(&mut scenario);
        create_fan_profile(&mut scenario, FAN_A, b"DoubleJoin");

        ts::next_tx(&mut scenario, ADMIN);
        {
            let cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut registry = ts::take_shared<ClanRegistry>(&scenario);
            clan::create_clan(&cap, &mut registry, b"Team Kyoto", b"Kyoto", b"", ts::ctx(&mut scenario));
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, cap);
        };

        ts::next_tx(&mut scenario, FAN_A);
        {
            let mut clan = ts::take_shared<Clan>(&scenario);
            let registry = ts::take_shared<ClanRegistry>(&scenario);
            let mut profile = ts::take_from_sender<FanProfile>(&scenario);
            let clan_addr = sui::object::id_address(&clan);
            fanship::set_clan(&mut profile, clan_addr, ts::ctx(&mut scenario));
            clan::join_clan(&mut clan, &registry, &profile, ts::ctx(&mut scenario));
            // Second join should abort
            clan::join_clan(&mut clan, &registry, &profile, ts::ctx(&mut scenario));
            ts::return_shared(clan);
            ts::return_shared(registry);
            ts::return_to_sender(&scenario, profile);
        };

        ts::end(scenario);
    }
}