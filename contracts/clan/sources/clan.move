/// Module: clan
/// Manages regional Clan registration, membership, season scoring,
/// and the Dojo Wars season-long meta-game for ONE Samurai fans.
module clan::clan {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use std::string::{Self, String};
    use fanship::fanship::{FanProfile, get_owner, get_clan_id};

    // ============================================================
    // Errors
    // ============================================================
    const EClanNotFound: u64        = 0;
    const EAlreadyMember: u64       = 1;
    const ENotMember: u64           = 2;
    const ENotAuthorized: u64       = 3;
    const ESeasonActive: u64        = 4;
    const ESeasonNotActive: u64     = 5;
    const EClanFull: u64            = 6;

    // ============================================================
    // Constants
    // ============================================================
    const MAX_CLAN_MEMBERS: u64 = 500;

    // ============================================================
    // Structs
    // ============================================================

    /// Admin capability for clan management
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Shared registry of all clans
    public struct ClanRegistry has key {
        id: UID,
        clans: Table<address, bool>, // clan_id → active
        total_clans: u64,
        current_season: u64,
        season_active: bool,
    }

    /// A regional Clan object — shared so all fans can join
    public struct Clan has key {
        id: UID,
        name: String,
        region: String,           // e.g., "Tokyo", "Osaka", "Nagoya"
        description: String,
        member_count: u64,
        members: Table<address, bool>,
        /// Season scores — season_number → total points
        season_scores: Table<u64, u64>,
        /// Current season accumulated score
        current_season_score: u64,
        /// Prize pool balance
        prize_pool: Balance<SUI>,
        /// Whether this clan won last season
        is_reigning_champion: bool,
    }

    /// A fan's non-transferable clan membership token
    public struct ClanMembership has key {
        id: UID,
        fan: address,
        clan_id: address,
        clan_name: String,
        joined_season: u64,
        /// Points contributed by this fan to the clan
        points_contributed: u64,
    }

    /// Season summary stored after each season ends
    public struct SeasonResult has key {
        id: UID,
        season: u64,
        winning_clan_id: address,
        winning_clan_name: String,
        winning_score: u64,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct ClanCreated has copy, drop {
        clan_id: address,
        name: String,
        region: String,
    }

    public struct FanJoinedClan has copy, drop {
        fan: address,
        clan_id: address,
        clan_name: String,
    }

    public struct ClanScoreUpdated has copy, drop {
        clan_id: address,
        points_added: u64,
        new_total: u64,
        season: u64,
    }

    public struct SeasonEnded has copy, drop {
        season: u64,
        winning_clan_id: address,
        winning_clan_name: String,
        winning_score: u64,
    }

    // ============================================================
    // Init
    // ============================================================

    fun init(ctx: &mut TxContext) {
        let registry = ClanRegistry {
            id: object::new(ctx),
            clans: table::new(ctx),
            total_clans: 0,
            current_season: 1,
            season_active: true,
        };
        transfer::share_object(registry);

        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ============================================================
    // Admin — Clan Management
    // ============================================================

    /// Create a new regional Clan. Only admin can create clans.
    public entry fun create_clan(
        _cap: &AdminCap,
        registry: &mut ClanRegistry,
        name: vector<u8>,
        region: vector<u8>,
        description: vector<u8>,
        ctx: &mut TxContext
    ) {
        let clan = Clan {
            id: object::new(ctx),
            name: string::utf8(name),
            region: string::utf8(region),
            description: string::utf8(description),
            member_count: 0,
            members: table::new(ctx),
            season_scores: table::new(ctx),
            current_season_score: 0,
            prize_pool: balance::zero(),
            is_reigning_champion: false,
        };

        let clan_addr = object::id_address(&clan);

        event::emit(ClanCreated {
            clan_id: clan_addr,
            name: clan.name,
            region: clan.region,
        });

        table::add(&mut registry.clans, clan_addr, true);
        registry.total_clans = registry.total_clans + 1;

        transfer::share_object(clan);
    }

    /// Add points to a clan after fight prediction settlement.
    /// Called by the prediction contract via admin cap.
    public entry fun add_clan_points(
        _cap: &AdminCap,
        clan: &mut Clan,
        registry: &ClanRegistry,
        fan: address,
        points: u64,
        membership: &mut ClanMembership,
        _ctx: &mut TxContext
    ) {
        assert!(registry.season_active, ESeasonNotActive);
        assert!(table::contains(&clan.members, fan), ENotMember);

        clan.current_season_score = clan.current_season_score + points;
        membership.points_contributed = membership.points_contributed + points;

        event::emit(ClanScoreUpdated {
            clan_id: object::id_address(clan),
            points_added: points,
            new_total: clan.current_season_score,
            season: registry.current_season,
        });
    }

    /// Fund a clan's prize pool
    public entry fun fund_prize_pool(
        clan: &mut Clan,
        payment: Coin<SUI>,
        _ctx: &mut TxContext
    ) {
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut clan.prize_pool, coin_balance);
    }

    /// End the current season and declare a winner.
    /// Admin supplies the winning clan (typically determined off-chain or by comparison).
    public entry fun end_season(
        _cap: &AdminCap,
        registry: &mut ClanRegistry,
        winning_clan: &mut Clan,
        ctx: &mut TxContext
    ) {
        assert!(registry.season_active, ESeasonNotActive);

        let season = registry.current_season;
        let clan_addr = object::id_address(winning_clan);

        // Snapshot the winning clan's score for this season
        table::add(
            &mut winning_clan.season_scores,
            season,
            winning_clan.current_season_score
        );
        winning_clan.is_reigning_champion = true;

        // Store season result on-chain
        let result = SeasonResult {
            id: object::new(ctx),
            season,
            winning_clan_id: clan_addr,
            winning_clan_name: winning_clan.name,
            winning_score: winning_clan.current_season_score,
        };

        event::emit(SeasonEnded {
            season,
            winning_clan_id: clan_addr,
            winning_clan_name: winning_clan.name,
            winning_score: winning_clan.current_season_score,
        });

        // Advance season
        registry.current_season = registry.current_season + 1;
        registry.season_active = false;

        transfer::share_object(result);
    }

    /// Re-open the next season
    public entry fun start_season(
        _cap: &AdminCap,
        registry: &mut ClanRegistry,
        _ctx: &mut TxContext
    ) {
        assert!(!registry.season_active, ESeasonActive);
        registry.season_active = true;
    }

    // ============================================================
    // Public — Fan Actions
    // ============================================================

    /// Fan joins a clan. Profile must have clan_id set to this clan's address.
    public entry fun join_clan(
        clan: &mut Clan,
        registry: &ClanRegistry,
        profile: &FanProfile,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(get_owner(profile) == sender, ENotAuthorized);
        assert!(clan.member_count < MAX_CLAN_MEMBERS, EClanFull);

        let clan_addr = object::id_address(clan);
        assert!(get_clan_id(profile) == clan_addr, ENotAuthorized);
        assert!(!table::contains(&clan.members, sender), EAlreadyMember);

        table::add(&mut clan.members, sender, true);
        clan.member_count = clan.member_count + 1;

        let membership = ClanMembership {
            id: object::new(ctx),
            fan: sender,
            clan_id: clan_addr,
            clan_name: clan.name,
            joined_season: registry.current_season,
            points_contributed: 0,
        };

        event::emit(FanJoinedClan {
            fan: sender,
            clan_id: clan_addr,
            clan_name: clan.name,
        });

        // Membership is soulbound — transfer to fan but non-transferable
        transfer::transfer(membership, sender);
    }

    // ============================================================
    // View Helpers
    // ============================================================

    public fun get_season_score(clan: &Clan): u64 {
        clan.current_season_score
    }

    public fun get_member_count(clan: &Clan): u64 {
        clan.member_count
    }

    public fun get_clan_name(clan: &Clan): String {
        clan.name
    }

    public fun is_member(clan: &Clan, fan: address): bool {
        table::contains(&clan.members, fan)
    }

    public fun get_current_season(registry: &ClanRegistry): u64 {
        registry.current_season
    }
}
