"use client";

import Image from "next/image";
import React from "react";
import styles from "./PartnersMarquee.module.css";

const PARTNERS = [
  { name: "Discover Cardano", logo: "/discover_cardano.JPG", url: "#", focus: "Community onboarding" },
  { name: "Gimbalabs", logo: "/gimbalabs.jpeg", url: "#", focus: "Learning infrastructure" },
  { name: "Andamio", logo: "/andamio.JPG", url: "#", focus: "Contributor tooling" },
  { name: "45B", logo: "/45B.png", url: "#", focus: "Builder network" },
];

export function PartnersMarquee() {
  return (
    <section className={styles.partnersSection} aria-labelledby="partners-title">
      <div className={`container ${styles.partnersShell}`}>
        <div className={styles.partnersHeader}>
          <span className={styles.eyebrow}>Ecosystem network</span>
          <div>
            <h2 id="partners-title">Built around trusted Cardano communities</h2>
            <p>
              Cardano Bounties connects contribution opportunities with education, onboarding, and builder
              communities already active across the ecosystem.
            </p>
          </div>
        </div>

        <div className={styles.partnersGrid}>
          {PARTNERS.map((partner) => (
            <a href={partner.url} className={styles.partnerTile} aria-label={`Visit ${partner.name}`} key={partner.name}>
              <span className={styles.logoFrame}>
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={132}
                  height={64}
                  className={styles.partnerLogoImg}
                  unoptimized
                />
              </span>
              <span className={styles.partnerText}>
                <strong>{partner.name}</strong>
                <small>{partner.focus}</small>
              </span>
            </a>
          ))}
        </div>

        <p className={styles.partnersNote}>
          Partner slots are curated for projects that help contributors learn, ship, and stay visible.
        </p>
      </div>
    </section>
  );
}
