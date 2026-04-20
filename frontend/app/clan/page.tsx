"use client";

import { useState, useEffect, useCallback } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  getOwnedFanProfile,
  getOwnedMembership,
  getAllClans,
  CONTRACT,
  NULL_ADDRESS,
  type FanProfile,
  type ClanMembership,
  type Clan,
} from "@/lib/sui";
import ClanLeaderBoard from "@/components/ClanLeaderBoard";
import Link from "next/link";

export default function ClanPage() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [profile, setProfile]       = useState<FanProfile | null>(null);
  const [membership, setMembership] = useState<ClanMembership | null>(null);
  const [clans, setClans]           = useState<Clan[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [joining, setJoining]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    const [p, m, c] = await Promise.all([
      getOwnedFanProfile(account.address),
      getOwnedMembership(account.address),
      getAllClans(),
    ]);
    setProfile(p);
    setMembership(m);
    setClans(c);
    setLoading(false);
  }, [account]);

  useEffect(() => { load(); }, [load]);

  // Join clan = set_clan + join_clan in a single PTB
  function joinClan(clan: Clan) {
    if (!profile) return;
    setError("");
    setJoining(clan.id);

    const tx = new Transaction();

    // 1. Set clan affiliation on profile
    tx.moveCall({
      target: `${CONTRACT.FANSHIP_PKG}::fanship::set_clan`,
      arguments: [tx.object(profile.id), tx.pure.address(clan.id)],
    });

    // 2. Join the clan
    tx.moveCall({
      target: `${CONTRACT.CLAN_PKG}::clan::join_clan`,
      arguments: [
        tx.object(clan.id),
        tx.object(CONTRACT.CLAN_REGISTRY_ID),
        tx.object(profile.id),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => { setJoining(null); load(); },
        onError: (e) => { setError(e.message); setJoining(null); },
      }
    );
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <p className="text-3xl font-bold uppercase tracking-widest mb-4"
          style={{ fontFamily: "Cinzel, serif" }}>
          Connect Your Wallet
        </p>
        <p className="text-[var(--text-muted)]">Connect to view and join clans.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-[var(--text-muted)] animate-pulse">Loading clans…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-32 text-center">
        <p className="text-3xl font-bold uppercase tracking-widest mb-4"
          style={{ fontFamily: "Cinzel, serif" }}>
          Create Profile First
        </p>
        <Link href="/profile"
          className="px-8 py-3 bg-[var(--crimson)] text-white font-bold tracking-widest uppercase text-sm">
          Create Profile
        </Link>
      </div>
    );
  }

  const myClan = membership ? clans.find((c) => c.id === membership.clan_id) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-2">
          — Clan System —
        </p>
        <h1 className="text-4xl font-bold uppercase tracking-tight"
          style={{ fontFamily: "Cinzel, serif" }}>
          Clan Clash
        </h1>
      </div>

      {/* My clan banner */}
      {myClan && membership && (
        <div className="mb-10 border border-[var(--crimson)] bg-[var(--crimson)]/5 p-6">
          <p className="text-xs font-mono text-[var(--crimson)] uppercase tracking-widest mb-2">
            ⚔ Your Clan
          </p>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold uppercase tracking-wide"
                style={{ fontFamily: "Cinzel, serif" }}>
                {myClan.name}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-1">{myClan.description}</p>
            </div>
            <div className="text-right ml-6">
              <p className="font-mono font-bold text-3xl text-[var(--gold)]">
                {myClan.current_season_score.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
                Season Points
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-[var(--crimson)]/30">
            {[
              ["Region", myClan.region],
              ["Members", myClan.member_count],
              ["Your Points", membership.points_contributed.toLocaleString()],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-mono">{k}</p>
                <p className="font-semibold text-[var(--text)] mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {myClan.is_reigning_champion && (
            <div className="mt-4 text-xs font-mono text-[var(--gold)] uppercase tracking-wider">
              ♛ Reigning Champion
            </div>
          )}
        </div>
      )}

      {/* Season leaderboard */}
      <div className="mb-12">
        <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-4">
          — Season Standings —
        </p>
        <ClanLeaderBoard clans={clans} highlightId={myClan?.id} />
      </div>

      {/* Join a clan — only if no membership yet */}
      {!membership && (
        <div>
          <p className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-[0.4em] mb-4">
            — Choose Your Clan —
          </p>
          {error && (
            <p className="text-xs text-[var(--crimson)] font-mono mb-4">{error}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clans.map((clan) => (
              <div
                key={clan.id}
                className="border border-[var(--border)] hover:border-[var(--border-hi)] bg-[var(--bg-card)] p-5 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold uppercase tracking-wider text-[var(--text)]"
                      style={{ fontFamily: "Cinzel, serif" }}>
                      {clan.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                      {clan.region}
                    </p>
                  </div>
                  {clan.is_reigning_champion && (
                    <span className="text-xs text-[var(--gold)] font-mono">♛ Champion</span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
                  {clan.description}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-[var(--text-muted)]">
                    {clan.member_count} members
                  </p>
                  <button
                    onClick={() => joinClan(clan)}
                    disabled={isPending && joining === clan.id}
                    className="px-5 py-2 bg-[var(--crimson)] hover:bg-[var(--crimson-hi)] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    {isPending && joining === clan.id ? "Joining…" : "Join"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}