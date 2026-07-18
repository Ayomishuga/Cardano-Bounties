"use client";
import Link from "next/link";
import React, { useState } from "react";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { navItems } from "./constants";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header">
      <nav
        className={`nav-shell ${isMenuOpen ? "is-open" : ""}`}
        aria-label="Primary navigation"
        style={{ position: "relative" }}
      >
        <Link className="brand" href="/" aria-label="Cardano Bounties home" onClick={closeMenu}>
          <img className="brand-logo" src="/cardano_bounties_logo.png" alt="Cardano Bounties" />
        </Link>

        <div
          className="nav-links"
          style={isMenuOpen ? { flex: "0 0 100%" } : undefined}
        >
          {navItems.map(([item, href]) => (
            <Link key={item} href={href} onClick={closeMenu}>{item}</Link>
          ))}
        </div>

        <div className="nav-wallet">
          <WalletConnect />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <NotificationBell />
          <button
            className="mobile-menu"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            onClick={toggleMenu}
          >
            {isMenuOpen ? (
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
