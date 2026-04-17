/// Module: lineage
/// On-chain Lineage Tree for martial arts dojos and ONE athletes.
/// Reputable senseis issue Rank Certificates as Sui objects.
/// Community members can Vouch for local dojos.
/// Builds a decentralized map of legitimate martial arts training centers.
module fanship::lineage {

    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};
    use sui::event;
    use std::string::{Self, String};

    // ============================================================
    // Errors
    // ============================================================
    const ENotSensei: u64             = 0;
    const EDojoNotFound: u64          = 1;
    const EAlreadyVouched: u64        = 2;
    const ENotAuthorized: u64         = 3;
    const ECertificateNotValid: u64   = 4;
    const EAlreadyRegistered: u64     = 5;

    // ============================================================
    // Rank Constants
    // ============================================================
    const RANK_WHITE: u8  = 0;
    const RANK_BLUE: u8   = 1;
    const RANK_PURPLE: u8 = 2;
    const RANK_BROWN: u8  = 3;
    const RANK_BLACK: u8  = 4;
    const RANK_RED: u8    = 5; // Coral/Red — grandmaster level

    // ============================================================
    // Structs
    // ============================================================

    /// Admin capability — platform-level authority
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Shared registry of all registered dojos
    public struct DojoRegistry has key {
        id: UID,
        dojos: Table<address, bool>, // dojo_id → verified
        total_dojos: u64,
    }

    /// A Dojo object — shared so community can vouch and fans can verify
    public struct Dojo has key {
        id: UID,
        name: String,
        style: String,           // e.g., "Muay Thai", "BJJ", "Karate"
        location: String,        // e.g., "Shinjuku, Tokyo"
        head_sensei: address,    // wallet of the head sensei
        founded_year: u64,
        is_verified: bool,       // platform-verified dojo
        vouch_count: u64,
        vouchers: Table<address, bool>, // who vouched
        member_count: u64,
        lineage_parent: address, // parent dojo (0x0 if root/independent)
    }

    /// A Sensei capability — issued by admin to verified senseis.
    /// Required to issue Rank Certificates.
    public struct SenseiCap has key, store {
        id: UID,
        sensei: address,
        dojo_id: address,
        style: String,
    }

    /// A Rank Certificate — issued by a sensei to a student or athlete.
    /// Non-transferable (soulbound to recipient).
    public struct RankCertificate has key {
        id: UID,
        recipient: address,
        recipient_name: String,
        rank: u8,
        style: String,
        issuing_dojo_id: address,
        issuing_dojo_name: String,
        issuing_sensei: address,
        issued_at_event: String,  // e.g., "ONE Samurai 1" or "Dojo Training 2026"
        notes: String,
    }

    /// An Athlete Lineage Profile — links a ONE athlete to their dojo tree.
    /// Displayed during ONE Championship broadcasts.
    public struct AthleteLineage has key {
        id: UID,
        athlete: address,
        athlete_name: String,
        primary_dojo_id: address,
        primary_dojo_name: String,
        style: String,
        /// All rank certificates earned — cert ID list stored as parallel table
        cert_count: u64,
        certs: Table<u64, ID>, // index → cert ID
        /// Training history notes
        training_notes: String,
    }

    // ============================================================
    // Events
    // ============================================================

    public struct DojoRegistered has copy, drop {
        dojo_id: address,
        name: String,
        style: String,
        location: String,
        head_sensei: address,
    }

    public struct DojoVerified has copy, drop {
        dojo_id: address,
        name: String,
    }

    public struct DojoVouched has copy, drop {
        dojo_id: address,
        voucher: address,
        new_vouch_count: u64,
    }

    public struct RankIssued has copy, drop {
        cert_id: ID,
        recipient: address,
        rank: u8,
        style: String,
        issuing_dojo_id: address,
    }

    public struct AthleteLineageCreated has copy, drop {
        athlete: address,
        athlete_name: String,
        primary_dojo_id: address,
    }

    // ============================================================
    // Init
    // ============================================================

    fun init(ctx: &mut TxContext) {
        let registry = DojoRegistry {
            id: object::new(ctx),
            dojos: table::new(ctx),
            total_dojos: 0,
        };
        transfer::share_object(registry);

        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ============================================================
    // Admin Actions
    // ============================================================

    /// Platform verifies a dojo (sets is_verified = true)
    public entry fun verify_dojo(
        _cap: &AdminCap,
        dojo: &mut Dojo,
        _ctx: &mut TxContext
    ) {
        dojo.is_verified = true;
        event::emit(DojoVerified {
            dojo_id: object::id_address(dojo),
            name: dojo.name,
        });
    }

    /// Issue a SenseiCap to a verified sensei wallet
    public entry fun issue_sensei_cap(
        _cap: &AdminCap,
        sensei: address,
        dojo_id: address,
        style: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sensei_cap = SenseiCap {
            id: object::new(ctx),
            sensei,
            dojo_id,
            style: string::utf8(style),
        };
        transfer::transfer(sensei_cap, sensei);
    }

    // ============================================================
    // Dojo Actions
    // ============================================================

    /// Register a new dojo. Anyone can register — verification is separate.
    public entry fun register_dojo(
        registry: &mut DojoRegistry,
        name: vector<u8>,
        style: vector<u8>,
        location: vector<u8>,
        founded_year: u64,
        lineage_parent: address,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let dojo = Dojo {
            id: object::new(ctx),
            name: string::utf8(name),
            style: string::utf8(style),
            location: string::utf8(location),
            head_sensei: sender,
            founded_year,
            is_verified: false,
            vouch_count: 0,
            vouchers: table::new(ctx),
            member_count: 0,
            lineage_parent,
        };

        let dojo_addr = object::id_address(&dojo);
        table::add(&mut registry.dojos, dojo_addr, false);
        registry.total_dojos = registry.total_dojos + 1;

        event::emit(DojoRegistered {
            dojo_id: dojo_addr,
            name: dojo.name,
            style: dojo.style,
            location: dojo.location,
            head_sensei: sender,
        });

        transfer::share_object(dojo);
    }

    /// Community members vouch for a dojo to build decentralized trust.
    public entry fun vouch_for_dojo(
        dojo: &mut Dojo,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(!table::contains(&dojo.vouchers, sender), EAlreadyVouched);

        table::add(&mut dojo.vouchers, sender, true);
        dojo.vouch_count = dojo.vouch_count + 1;

        event::emit(DojoVouched {
            dojo_id: object::id_address(dojo),
            voucher: sender,
            new_vouch_count: dojo.vouch_count,
        });
    }

    // ============================================================
    // Sensei Actions — Issue Rank Certificates
    // ============================================================

    /// Sensei issues a Rank Certificate to a student or ONE athlete.
    /// The cert is soulbound — transferred to recipient and non-moveable.
    public entry fun issue_rank_certificate(
        cap: &SenseiCap,
        dojo: &Dojo,
        recipient: address,
        recipient_name: vector<u8>,
        rank: u8,
        event_name: vector<u8>,
        notes: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(cap.dojo_id == object::id_address(dojo), ENotSensei);
        assert!(rank <= RANK_RED, ECertificateNotValid);

        let cert = RankCertificate {
            id: object::new(ctx),
            recipient,
            recipient_name: string::utf8(recipient_name),
            rank,
            style: dojo.style,
            issuing_dojo_id: object::id_address(dojo),
            issuing_dojo_name: dojo.name,
            issuing_sensei: cap.sensei,
            issued_at_event: string::utf8(event_name),
            notes: string::utf8(notes),
        };

        let cert_id = object::id(&cert);

        event::emit(RankIssued {
            cert_id,
            recipient,
            rank,
            style: cert.style,
            issuing_dojo_id: object::id_address(dojo),
        });

        // Soulbound — transfer to recipient only
        transfer::transfer(cert, recipient);
    }

    // ============================================================
    // Athlete Lineage
    // ============================================================

    /// Create an on-chain lineage profile for a ONE athlete.
    /// Displayed on broadcast when athlete fights.
    public entry fun create_athlete_lineage(
        athlete_name: vector<u8>,
        primary_dojo_id: address,
        primary_dojo_name: vector<u8>,
        style: vector<u8>,
        training_notes: vector<u8>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);

        let lineage = AthleteLineage {
            id: object::new(ctx),
            athlete: sender,
            athlete_name: string::utf8(athlete_name),
            primary_dojo_id,
            primary_dojo_name: string::utf8(primary_dojo_name),
            style: string::utf8(style),
            cert_count: 0,
            certs: table::new(ctx),
            training_notes: string::utf8(training_notes),
        };

        event::emit(AthleteLineageCreated {
            athlete: sender,
            athlete_name: lineage.athlete_name,
            primary_dojo_id,
        });

        transfer::transfer(lineage, sender);
    }

    /// Athlete links a received RankCertificate to their lineage profile.
    public entry fun link_cert_to_lineage(
        lineage: &mut AthleteLineage,
        cert: &RankCertificate,
        ctx: &mut TxContext
    ) {
        assert!(lineage.athlete == tx_context::sender(ctx), ENotAuthorized);
        assert!(cert.recipient == tx_context::sender(ctx), ENotAuthorized);

        let cert_id = object::id(cert);
        table::add(&mut lineage.certs, lineage.cert_count, cert_id);
        lineage.cert_count = lineage.cert_count + 1;
    }

    // ============================================================
    // View Helpers
    // ============================================================

    public fun get_vouch_count(dojo: &Dojo): u64 { dojo.vouch_count }
    public fun is_verified(dojo: &Dojo): bool { dojo.is_verified }
    public fun get_dojo_style(dojo: &Dojo): String { dojo.style }
    public fun get_lineage_parent(dojo: &Dojo): address { dojo.lineage_parent }
    public fun get_cert_count(lineage: &AthleteLineage): u64 { lineage.cert_count }
    public fun get_rank(cert: &RankCertificate): u8 { cert.rank }
    public fun rank_black(): u8 { RANK_BLACK }
    public fun rank_red(): u8 { RANK_RED }
}