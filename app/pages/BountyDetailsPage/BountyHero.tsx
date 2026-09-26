"use client";

import Image from "next/image";
import Link from "next/link";
import type { Bounty } from "@/types/bounty";
import { formatAda, formatDate } from "@/lib/formatters";
import { getBountyState, getProjectName, getProjectLogoUrl } from "@/lib/bountyHelpers";
import styles from "../BountyDetailsPage.module.css";
import type { DetailTab } from "./types";

export function BountyHero({
  bounty,
  briefExcerpt,
  acceptsContributions,
  setActiveTab,
}: {
  bounty: Bounty;
  briefExcerpt: string;
  acceptsContributions: boolean;
  setActiveTab: (tab: DetailTab) => void;
}) {
  return (
    <section className={styles.detailsHero}>
      <div className={`container ${styles.detailsHeroGrid}`}>
        <div className={styles.detailsHeroCopy}>
          <span className="eyebrow">
            <i /> {bounty.type || "Bounty"}
          </span>
          <div className={styles.projectIdentity}>
            <span aria-hidden="true" className={styles.projectLogo}>
              {getProjectLogoUrl(bounty) && (
                <Image
                  src={getProjectLogoUrl(bounty)}
                  alt=""
                  width={40}
                  height={40}
                  className={styles.projectLogoImg}
                  unoptimized
                />
              )}
            </span>
            <strong>{getProjectName(bounty)}</strong>
          </div>
          <h1>{bounty.title}</h1>
          <p>{briefExcerpt}</p>
          <div className={styles.heroActions}>
            <Link href="/explore">Back to explore</Link>
            <a href="#bounty-details-tabs" onClick={() => setActiveTab(acceptsContributions ? "submit" : "details")}>
              {acceptsContributions ? "Submit work" : "View review status"}
            </a>
          </div>
        </div>

        <aside className={styles.summaryCard} aria-label="Bounty summary">
          <div>
            <span>
              {bounty.payout_type === "equal_split"
                ? `Reward pool (${bounty.max_winners ?? 2} winners)`
                : bounty.payout_type === "manual_split"
                  ? `Prize pool (${bounty.max_winners ?? 2} winners)`
                  : "Reward"}
            </span>
            <strong>{formatAda(bounty.reward_amount)}</strong>
          </div>

          {/* Payout type badge */}
          {bounty.payout_type && bounty.payout_type !== "single" && (
            <div style={{ paddingTop: 0, paddingBottom: 0 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--blue)",
                }}
              >
                {bounty.payout_type === "equal_split" ? "Equal split" : "Ranked prizes"}
              </span>
            </div>
          )}

          {/* Prize breakdown table for manual_split */}
          {bounty.payout_type === "manual_split" && bounty.prize_structure && bounty.prize_structure.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--muted)",
                }}
              >
                Prize breakdown
              </span>
              {bounty.prize_structure.map((p) => {
                const RANK_EMOJI: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
                const emoji = RANK_EMOJI[p.rank] ?? `#${p.rank}`;
                const ada = (p.amount_lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 });
                return (
                  <div key={p.rank} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>
                      {emoji} {p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `${p.rank}th`} place
                    </span>
                    <strong>{ada} ADA</strong>
                  </div>
                );
              })}
            </div>
          )}
          <div>
            <span>Deadline</span>
            <strong>{formatDate(bounty.deadline)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{getBountyState(bounty)}</strong>
          </div>
          {!acceptsContributions ? (
            <div className={styles.reviewStatusNotice}>
              <span>Submissions closed</span>
              <strong>This bounty is in review and no longer accepting contributions.</strong>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.submitWorkButton}
            onClick={() => {
              setActiveTab("submit");
              const element = document.getElementById("bounty-details-tabs");
              if (element) {
                element.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            {acceptsContributions ? "Submit Work" : "View Review Status"}
          </button>
        </aside>
      </div>
    </section>
  );
}
