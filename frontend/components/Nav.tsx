"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@mysten/dapp-kit";

const LINKS = [
  { href: "/quest",      label: "Quest" },
  { href: "/clan",       label: "Clan" },
  { href: "/dojo-wars",  label: "Dojo Wars" },
  { href: "/profile",    label: "Profile" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg font-bold tracking-widest text-[var(--text)] uppercase"
        >
          <span className="text-[var(--crimson)]">⚔</span> Ronin&apos;s Path
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-semibold tracking-wider uppercase transition-colors ${
                pathname === l.href
                  ? "text-[var(--crimson)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Wallet */}
        <ConnectButton />
      </div>
    </nav>
  );
}