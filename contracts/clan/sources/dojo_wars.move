/// Module: dojo_wars
/// Season-long meta-game tracking Clan standings across all ONE Samurai events.
/// The top-ranked Clan at season end earns the right to sponsor a fighter's corner
/// at the next event — recorded on-chain and visible on broadcast.
module clan::dojo_wars {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use std::string::{Self, String};
    use clan::clan::{
        AdminCap, ClanRegistry, Clan,
        get_season_score, get_clan_name, get_current_season
    };

    // ============================================================
    // Errors
    // ============================================================
    const ELeaderboardNotFound: u64  = 0;
    const ESeasonAlreadyFinalized: u64 = 1;
    const ENotEnoughClans: u64       = 2;
    const ENotAuthorized: u64        = 3;

    // ============================================================
    // Structs
    // ============================================================

    /// Shared leaderboard tracking all clans' scores for the current season.
    /// Updated after every ONE Samurai event settlement.
    public struct DojoWarsLeaderboard has key {
        id: UID,
        season: u64,
        /// clan_id → SeasonEntry
        entries: Table<address, SeasonEntry>,
        clan_count: u64,
        finalized: bool,
        /// Address of the season champion clan
        champion_clan_id: address,
        champion_clan_name: String,
    }

    public struct SeasonEntry has store, drop {
        clan_id: address,
        clan_name: String,
        total_points: u64,
        events_participated: u64,
        rank: u64, // updated at finalization
    }

    /// The Corner Sponsorship Right — awarded to the winning clan.
    /// Non-transferable. Displayed on-chain during fighter's next bout.
    public struct CornerSponsorshipRight has key {
        id: UID,
        season: u64,
        clan_id: address,
        clan_name: String,
        recipient: address,
        fighter_name: String,    // assigned when fight is booked
        event_name: String,      // which event they sponsor
        is_activated: bool,
    }

    /// A season snapshot stored permanently on-chain after finalization.
    public struct SeasonSnapshot has key {
        id: UID,
        season: u64,
        champion_clan_id: address,
        champion_clan_name: String,
        champion_score: u64,
        runner_up_clan_id: address,
        runner_up_clan_name: String,
        runner_up_score: u64,
        total_clans: u64,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct LeaderboardCreated has copy, drop {
        leaderboard_id: ID,
        season: u64,
    }

    public struct LeaderboardUpdated has copy, drop {
        clan_id: address,
        clan_name: String,
        new_total: u64,
        season: u64,
    }

    public struct SeasonFinalized has copy, drop {
        season: u64,
        champion_clan_id: address,
        champion_clan_name: String,
        champion_score: u64,
    }

    public struct CornerRightAwarded has copy, drop {
        clan_id: address,
        clan_name: String,
        recipient: address,
        season: u64,
    }

    // ============================================================
    // Init — Create Leaderboard for Season 1
    // ============================================================

    fun init(ctx: &mut TxContext) {
        let leaderboard = DojoWarsLeaderboard {
            id: object::new(ctx),
            season: 1,
            entries: table::new(ctx),
            clan_count: 0,
            finalized: false,
            champion_clan_id: @0x0,
            champion_clan_name: string::utf8(b""),
        };

        event::emit(LeaderboardCreated {
            leaderboard_id: object::id(&leaderboard),
            season: 1,
        });

        transfer::share_object(leaderboard);
    }

    // ============================================================
    // Admin Actions
    // ============================================================

    /// Register a clan on the leaderboard at the start of a season.
    public entry fun register_clan_on_leaderboard(
        _cap: &AdminCap,
        leaderboard: &mut DojoWarsLeaderboard,
        clan: &Clan,
        _ctx: &mut TxContext
    ) {
        assert!(!leaderboard.finalized, ESeasonAlreadyFinalized);

        let clan_id = sui::object::id_address(clan);
        if (!table::contains(&leaderboard.entries, clan_id)) {
            let entry = SeasonEntry {
                clan_id,
                clan_name: get_clan_name(clan),
                total_points: 0,
                events_participated: 0,
                rank: 0,
            };
            table::add(&mut leaderboard.entries, clan_id, entry);
            leaderboard.clan_count = leaderboard.clan_count + 1;
        };
    }

    /// Sync a clan's score from the Clan object into the leaderboard.
    /// Called by admin after each event's prediction settlement batch.
    public entry fun sync_clan_score(
        _cap: &AdminCap,
        leaderboard: &mut DojoWarsLeaderboard,
        clan: &Clan,
        _ctx: &mut TxContext
    ) {
        assert!(!leaderboard.finalized, ESeasonAlreadyFinalized);

        let clan_id = sui::object::id_address(clan);
        assert!(table::contains(&leaderboard.entries, clan_id), ELeaderboardNotFound);

        let entry = table::borrow_mut(&mut leaderboard.entries, clan_id);
        entry.total_points = get_season_score(clan);
        entry.events_participated = entry.events_participated + 1;

        event::emit(LeaderboardUpdated {
            clan_id,
            clan_name: get_clan_name(clan),
            new_total: entry.total_points,
            season: leaderboard.season,
        });
    }

    /// Finalize the season. Admin supplies the top 2 clan IDs
    /// (determined off-chain by reading leaderboard entries).
    /// In production this would do full on-chain sorting, and the
    /// corner sponsorship is awarded to the supplied representative address.
    public entry fun finalize_season(
        _cap: &AdminCap,
        leaderboard: &mut DojoWarsLeaderboard,
        champion_clan: &Clan,
        runner_up_clan: &Clan,
        representative: address,
        ctx: &mut TxContext
    ) {
        assert!(!leaderboard.finalized, ESeasonAlreadyFinalized);
        assert!(leaderboard.clan_count >= 2, ENotEnoughClans);

        let champion_id = sui::object::id_address(champion_clan);
        let runner_up_id = sui::object::id_address(runner_up_clan);

        let champion_score = get_season_score(champion_clan);
        let runner_up_score = get_season_score(runner_up_clan);

        leaderboard.champion_clan_id = champion_id;
        leaderboard.champion_clan_name = get_clan_name(champion_clan);
        leaderboard.finalized = true;

        // Store permanent snapshot on-chain
        let snapshot = SeasonSnapshot {
            id: object::new(ctx),
            season: leaderboard.season,
            champion_clan_id: champion_id,
            champion_clan_name: get_clan_name(champion_clan),
            champion_score,
            runner_up_clan_id: runner_up_id,
            runner_up_clan_name: get_clan_name(runner_up_clan),
            runner_up_score,
            total_clans: leaderboard.clan_count,
        };

        event::emit(SeasonFinalized {
            season: leaderboard.season,
            champion_clan_id: champion_id,
            champion_clan_name: get_clan_name(champion_clan),
            champion_score,
        });

        transfer::share_object(snapshot);

        // Award corner sponsorship right to the winning clan's representative.
        let corner_right = CornerSponsorshipRight {
            id: object::new(ctx),
            season: leaderboard.season,
            clan_id: champion_id,
            clan_name: get_clan_name(champion_clan),
            recipient: representative,
            fighter_name: string::utf8(b"TBD"),
            event_name: string::utf8(b"TBD"),
            is_activated: false,
        };

        event::emit(CornerRightAwarded {
            clan_id: champion_id,
            clan_name: get_clan_name(champion_clan),
            recipient: representative,
            season: leaderboard.season,
        });

        // Transfer the sponsorship right directly to the representative.
        transfer::transfer(corner_right, representative);
    }

    /// Assign the corner sponsorship to a specific fighter and event.
    /// Called once the next event card is announced.
    public entry fun activate_corner_sponsorship(
        _cap: &AdminCap,
        right: &mut CornerSponsorshipRight,
        fighter_name: vector<u8>,
        event_name: vector<u8>,
        _ctx: &mut TxContext
    ) {
        right.fighter_name = string::utf8(fighter_name);
        right.event_name = string::utf8(event_name);
        right.is_activated = true;
    }

    /// Start a new Dojo Wars leaderboard for the next season.
    public entry fun start_new_season(
        _cap: &AdminCap,
        registry: &ClanRegistry,
        ctx: &mut TxContext
    ) {
        let new_season = get_current_season(registry);

        let leaderboard = DojoWarsLeaderboard {
            id: object::new(ctx),
            season: new_season,
            entries: table::new(ctx),
            clan_count: 0,
            finalized: false,
            champion_clan_id: @0x0,
            champion_clan_name: string::utf8(b""),
        };

        event::emit(LeaderboardCreated {
            leaderboard_id: object::id(&leaderboard),
            season: new_season,
        });

        transfer::share_object(leaderboard);
    }

    // ============================================================
    // View Helpers
    // ============================================================

    public fun get_clan_points(
        leaderboard: &DojoWarsLeaderboard,
        clan_id: address
    ): u64 {
        if (table::contains(&leaderboard.entries, clan_id)) {
            table::borrow(&leaderboard.entries, clan_id).total_points
        } else {
            0
        }
    }

    public fun is_finalized(leaderboard: &DojoWarsLeaderboard): bool {
        leaderboard.finalized
    }

    public fun get_champion(leaderboard: &DojoWarsLeaderboard): address {
        leaderboard.champion_clan_id
    }

    public fun get_season(leaderboard: &DojoWarsLeaderboard): u64 {
        leaderboard.season
    }

    public fun corner_is_activated(right: &CornerSponsorshipRight): bool {
        right.is_activated
    }
}