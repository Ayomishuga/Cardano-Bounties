"use client";
import React, { useEffect, useState } from "react";

const initialStats = [
  ["200+", "Active Users"],
  ["6", "Bounty categories"],
  ["₳ ADA", "Rewards paid on-chain"],
  ["Open", "To all skill levels"],
];

export function Stats() {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    async function fetchUserCount() {
      try {
        const response = await fetch("/api/waitlist");
        const data = await response.json();
        if (data.count !== undefined) {
          setStats((prev) => {
            const newStats = [...prev];
            newStats[0] = [`${data.count}+`, "Active Users"];
            return newStats;
          });
        }
      } catch (error) {
        console.error("Failed to fetch user count:", error);
      }
    }

    fetchUserCount();
  }, []);

  return (
    <section className="stats-section" id="leaderboard">
      <div className="container stats-grid">
        {stats.map(([value, label]) => (
          <div className="stat-card" key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
