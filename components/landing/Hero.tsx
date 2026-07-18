"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type HeroBounty = {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  reward_amount: number | string | null;
  deadline: string | null;
};

type BountyListResponse = {
  data?: HeroBounty[];
};

function formatAda(value: HeroBounty["reward_amount"]) {
  if (value === null || value === undefined || value === "") return "Reward TBD";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${value} ADA`;
  return `${new Intl.NumberFormat("en-US").format(amount)} ADA`;
}

function truncate(text: string | null, max = 72) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Skeleton card shown while loading
function SkeletonCard() {
  return (
    <article style={{ opacity: 0.6 }}>
      <div>
        <h3 style={{ background: "#e2e5ea", height: 14, borderRadius: 6, width: "70%" }}>&nbsp;</h3>
        <button type="button" aria-hidden="true" tabIndex={-1}>••</button>
      </div>
      <p style={{ background: "#e2e5ea", height: 24, borderRadius: 6, marginTop: 14 }}>&nbsp;</p>
      <div className="mini-avatars">
        <span /><span /><span />
      </div>
      <div className="mini-progress"><i style={{ width: "50%" }} /></div>
    </article>
  );
}

export function Hero() {
  const [bounties, setBounties] = useState<HeroBounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bounties?pageSize=2", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => r.json())
      .then((payload: BountyListResponse) => {
        if (!cancelled && Array.isArray(payload.data)) {
          setBounties(payload.data.slice(0, 2));
        }
      })
      .catch(() => {/* silently fall back to skeleton */})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Use real bounties if available, otherwise show skeletons
  const cards = loading
    ? [0, 1]
    : bounties.length > 0
      ? bounties
      : null; // no open bounties at all

  return (
    <section className="hero-section">
      <div className="hero-glow hero-glow-1"></div>
      <div className="hero-glow hero-glow-2"></div>
      <div className="container hero-inner">
        <span className="eyebrow"><i /> Built on Cardano · Pre-launch</span>
        <h1>
          From Learning to Earning,
          <br />
          Contribute to Cardano and Get Paid in ADA
        </h1>
        <p>Cardano bounties is an open platform where anyone regardless of experience or skill level can contribute to the Cardano ecosystem. Explore tasks, build in public, and earn ADA while contributing to real projects.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/explore">Explore Bounties</Link>
          <a className="button button-secondary" href="#pricing">See How It Works</a>
        </div>
        <div className="trust-nudge">No account needed · Connect your Cardano wallet · Free to participate</div>

        <div className="hero-product-wrapper">
          <div className="hero-product" aria-label="Open bounties preview">
            <section className="today-panel">
              <div className="today-head">
                <h2>Open Bounties</h2>
                <Link href="/explore">Explore {"\u203a"}</Link>
              </div>

              {loading ? (
                <div className="today-cards">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : cards ? (
                <div className="today-cards">
                  {cards.map((bounty) => {
                    const b = bounty as HeroBounty;
                    return (
                      <Link
                        key={b.id}
                        href={`/bounties/${b.id}`}
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                        title={b.title}
                      >
                        <article>
                          <div>
                            <h3>{b.title}</h3>
                            <span
                              style={{
                                width: 25,
                                height: 25,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                borderRadius: "999px",
                                background: "var(--blue-soft)",
                                color: "var(--blue)",
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                              aria-label={b.type ?? "bounty"}
                            >
                              {(b.type ?? "?").slice(0, 3)}
                            </span>
                          </div>
                          <p>{truncate(b.description)}</p>
                          <div className="mini-avatars">
                            <span /><span /><span />
                            <b>{formatAda(b.reward_amount)}</b>
                          </div>
                          <div className="mini-progress">
                            <i style={{ width: "65%" }} />
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                /* No open bounties yet — encourage the user to explore */
                <div style={{ padding: "20px 0", textAlign: "center", color: "#8a9099", fontSize: 13 }}>
                  No open bounties right now.{" "}
                  <Link href="/explore" style={{ color: "var(--blue)", fontWeight: 600 }}>
                    Check back soon →
                  </Link>
                </div>
              )}

              <div className="toast">
                <span>💙</span>
                <p>Earn ADA by contributing to real Cardano projects.</p>
                <Link
                  href="/explore"
                  style={{
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "999px",
                    background: "white",
                    color: "#111",
                    fontSize: 14,
                    marginLeft: "auto",
                    flexShrink: 0,
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                  aria-label="Explore bounties"
                >
                  ›
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
