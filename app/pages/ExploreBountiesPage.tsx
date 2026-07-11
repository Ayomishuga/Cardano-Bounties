"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import styles from "./ExploreBountiesPage.module.css";


type Bounty = {
  id: string;
  title: string;
  description: string;
  type: string | null;
  reward_amount: number | string | null;
  deadline: string | null;
  created_at: string | null;
  status?: string | null;
  project_name?: string | null;
  project_logo_url?: string | null;
  payout_type?: string | null;
  max_winners?: number | null;
  projects?: {
    name?: string | null;
    logo_url?: string | null;
  } | null;
};

type BountyPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type BountyListResponse = {
  data?: Bounty[];
  pagination?: BountyPagination;
  error?: string;
};

type CategoryOption = {
  value: string;
  label: string;
};

const categoryLabels: Record<string, string> = {
  code: "Code",
  development: "Code",
  dev: "Code",
  design: "Design",
  content: "Content",
  documentation: "Docs",
  docs: "Docs",
  research: "Research",
  community: "Community",
  security: "Security",
};

const categoryOptions: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "development", label: "Code" },
  { value: "design", label: "Design" },
  { value: "content", label: "Content" },
  { value: "documentation", label: "Docs" },
  { value: "research", label: "Research" },
  { value: "community", label: "Community" },
  { value: "security", label: "Security" },
  { value: "hackathon", label: "Hackathon" },
  { value: "other", label: "Other" },
];

const PAGE_SIZE = 9;

function normalizeType(type: string | null) {
  if (!type) return "Other";
  const key = type.trim().toLowerCase();
  return categoryLabels[key] ?? type.trim();
}

function formatAda(value: Bounty["reward_amount"]) {
  if (value === null || value === undefined || value === "") return "Reward TBD";
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${value} ADA`;
  return `${new Intl.NumberFormat("en-US").format(amount)} ADA`;
}

function formatDate(value: string | null) {
  if (!value) return "Rolling deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Rolling deadline";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getDeadlineState(value: string | null) {
  if (!value) return "Open";
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return "Open";

  const diff = deadline.getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "Reviewing";
  if (days === 0) return "Due today";
  if (days <= 7) return `${days}d left`;
  return "Open";
}

function getBountyState(bounty: Bounty) {
  if (bounty.status === "in_review") return "In review";
  return getDeadlineState(bounty.deadline);
}

function isBountyInReview(bounty: Bounty) {
  return bounty.status === "in_review";
}

function getProjectName(bounty: Bounty) {
  return bounty.project_name || bounty.projects?.name || "Independent bounty";
}

function getProjectLogoUrl(bounty: Bounty) {
  return bounty.project_logo_url || bounty.projects?.logo_url || "";
}

export function ExploreBountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [pagination, setPagination] = useState<BountyPagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeType, setActiveType] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  const loadBounties = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (debouncedQuery.trim()) params.set("search", debouncedQuery.trim());
      if (activeType !== "all") params.set("type", activeType);

      const response = await fetch(`/api/bounties?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const payload = (await response.json()) as BountyListResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load bounties right now.");
      }

      setBounties(Array.isArray(payload.data) ? payload.data : []);
      setPagination(
        payload.pagination || {
          page,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load bounties right now.");
    } finally {
      setIsLoading(false);
    }
  }, [activeType, page, debouncedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBounties();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBounties]);

  function updateSearch(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updateType(value: string) {
    setActiveType(value);
    setPage(1);
  }

  const totalRewards = useMemo(
    () =>
      bounties.reduce((sum, bounty) => {
        const amount = Number(bounty.reward_amount);
        return Number.isNaN(amount) ? sum : sum + amount;
      }, 0),
    [bounties],
  );

  return (
    <main className={`page ${styles.explorePage}`}>
      <Header />

      <section className={styles.exploreHero}>
        <div className={`container ${styles.exploreHeroGrid}`}>
          <div className={styles.exploreHeroCopy}>
            <span className="eyebrow">
              <i /> Contribution board
            </span>
            <h1>Explore live bounties</h1>
            <p>
              Find active and in-review tasks across engineering, design, content, research, and community work.
              Open bounties accept contributions; in-review bounties remain visible for transparency.
            </p>
          </div>

          <div className={styles.exploreSummary} aria-label="Bounty board summary">
            <div>
              <span>Visible bounties</span>
              <strong>{isLoading ? "--" : pagination.total}</strong>
            </div>
            <div>
              <span>Total rewards</span>
              <strong>{isLoading ? "--" : formatAda(totalRewards)}</strong>
            </div>
            <div>
              <span>Categories</span>
              <strong>{isLoading ? "--" : categoryOptions.length - 1}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.exploreBoard} aria-label="Explore bounties">
        <div className="container">
          <div className={styles.exploreToolbar}>
            <label className={styles.searchField}>
              <span>Search bounties</span>
              <div className={styles.searchInputWrapper}>
                <svg className={styles.searchIcon} viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="search"
                  value={query}
                  placeholder="Search by title, project, type, or brief"
                  onChange={(event) => updateSearch(event.target.value)}
                />
              </div>
            </label>

            <div className={styles.filterControls}>
              <label className={styles.selectField}>
                <span>Filter by category</span>
                <select value={activeType} onChange={(event) => updateType(event.target.value)}>
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className={styles.clearFilters}
                type="button"
                disabled={!query && activeType === "all"}
                onClick={() => {
                  updateSearch("");
                  updateType("all");
                }}
              >
                Clear filters
              </button>
            </div>

            <div className={styles.toolbarSummary} aria-live="polite">
              <span>
                {isLoading
                  ? "Loading bounties"
                  : pagination.total > 0
                    ? `Showing ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                        pagination.page * pagination.pageSize,
                        pagination.total,
                      )} of ${pagination.total} bounties`
                    : "No bounties found"}
              </span>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
            </div>
          </div>

          {isLoading ? (
            <div className={styles.bountyGrid} aria-label="Loading bounties">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <article className={`${styles.bountyCard} ${styles.bountyCardSkeleton}`} key={item}>
                  <span />
                  <h2 />
                  <p />
                  <p />
                </article>
              ))}
            </div>
          ) : error ? (
            <div className={styles.exploreState} role="alert">
              <h2>Could not load bounties</h2>
              <p>{error}</p>
              <button type="button" onClick={() => void loadBounties()}>
                Retry
              </button>
            </div>
          ) : bounties.length === 0 ? (
            <div className={styles.exploreState}>
              <h2>No matching bounties</h2>
              <p>Try a broader search or switch to another bounty type.</p>
            </div>
          ) : (
            <>
              <div className={styles.bountyGrid}>
                {bounties.map((bounty) => (
                  <article className={`${styles.bountyCard} ${isBountyInReview(bounty) ? styles.bountyCardInReview : ""}`} id={bounty.id} key={bounty.id}>
                    <div className={styles.bountyCardTop}>
                      <span>{normalizeType(bounty.type)}</span>
                      {bounty.payout_type && bounty.payout_type !== "single" && (
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--blue)", background: "rgba(1,81,194,0.08)", padding: "2px 7px", borderRadius: 999 }}>
                          {bounty.payout_type === "equal_split" ? "Split" : "Ranked"}
                        </span>
                      )}
                      <b>{getBountyState(bounty)}</b>
                    </div>
                    <div className={styles.projectIdentity}>
                      <span aria-hidden="true" className={styles.projectLogo}>
                        {getProjectLogoUrl(bounty) && (
                          <Image
                            src={getProjectLogoUrl(bounty)}
                            alt=""
                            width={36}
                            height={36}
                            className={styles.projectLogoImg}
                            unoptimized
                          />
                        )}
                      </span>
                      <strong>{getProjectName(bounty)}</strong>
                    </div>
                    <h2>{bounty.title}</h2>
                    <p>{bounty.description}</p>
                    {isBountyInReview(bounty) ? (
                      <div className={styles.reviewNotice}>
                        This bounty is in review and no longer accepting contributions.
                      </div>
                    ) : null}
                    <dl className={styles.bountyMeta}>
                      <div>
                        <dt>{bounty.payout_type === "equal_split" ? `Pool (${bounty.max_winners ?? 2} winners)` : bounty.payout_type === "manual_split" ? `Pool (${bounty.max_winners ?? 2} places)` : "Reward"}</dt>
                        <dd>{formatAda(bounty.reward_amount)}</dd>
                      </div>
                      <div>
                        <dt>Deadline</dt>
                        <dd>{formatDate(bounty.deadline)}</dd>
                      </div>
                    </dl>
                    <Link className={styles.bountyAction} href={`/bounties/${bounty.id}`}>
                      {isBountyInReview(bounty) ? "View review status" : "View bounty"}
                    </Link>
                  </article>
                ))}
              </div>

              <nav className={styles.pagination} aria-label="Bounty pagination">
                <button
                  type="button"
                  disabled={!pagination.hasPreviousPage || isLoading}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </button>
                <span>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={!pagination.hasNextPage || isLoading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
