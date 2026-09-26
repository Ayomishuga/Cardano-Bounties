"use client";

import Link from "next/link";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { useBountyDetails } from "./useBountyDetails";
import { BountyHero } from "./BountyHero";
import { BriefTab, InstructionsTab, ContributionsTab, SubmitWorkTab, BountyMetaTab } from "./BountyTabs";
import styles from "../BountyDetailsPage.module.css";

export function BountyDetailsPage({ bountyId }: { bountyId: string }) {
  const {
    address,
    connected,
    isAuthenticated,
    bounty,
    isLoading,
    error,
    contributionLink,
    setContributionLink,
    contributionNotes,
    setContributionNotes,
    submissionError,
    submissionSuccess,
    isSubmitting,
    activeTab,
    setActiveTab,
    linkError,
    setLinkError,
    briefSections,
    instructionSections,
    submissions,
    acceptsContributions,
    detailTabs,
    handleTabKeyDown,
    handleContributionSubmit,
  } = useBountyDetails(bountyId);

  return (
    <main className={`page ${styles.detailsPage}`}>
      <Header />

      {isLoading ? (
        <section className={styles.stateSection}>
          <div className={`container ${styles.stateCard}`}>
            <span>Loading bounty</span>
            <h1>Fetching bounty details...</h1>
            <p>We are loading the current brief, reward, and deadline.</p>
          </div>
        </section>
      ) : error || !bounty ? (
        <section className={styles.stateSection}>
          <div className={`container ${styles.stateCard}`}>
            <span>Bounty unavailable</span>
            <h1>{error || "Bounty not found"}</h1>
            <p>This bounty may have been closed, cancelled, or removed from the public board.</p>
            <Link href="/explore">Back to bounties</Link>
          </div>
        </section>
      ) : (
        <>
          <BountyHero
            bounty={bounty}
            briefExcerpt={briefSections[0] || bounty.description || ""}
            acceptsContributions={acceptsContributions}
            setActiveTab={setActiveTab}
          />

          <section className={styles.detailsBody} id="bounty-details-tabs">
            <div className={`container ${styles.tabShell}`}>
              <div className={styles.tabList} role="tablist" aria-label="Bounty details">
                {detailTabs.map((tab, index) => (
                  <button
                    aria-controls={activeTab === tab.id ? `bounty-panel-${tab.id}` : undefined}
                    aria-selected={activeTab === tab.id}
                    className={activeTab === tab.id ? styles.activeTab : undefined}
                    id={`bounty-tab-${tab.id}`}
                    key={tab.id}
                    role="tab"
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                aria-labelledby={`bounty-tab-${activeTab}`}
                className={styles.tabPanel}
                id={`bounty-panel-${activeTab}`}
                role="tabpanel"
                tabIndex={0}
              >
                {activeTab === "brief" && (
                  <BriefTab sections={briefSections} fallback={bounty.description} />
                )}

                {activeTab === "instructions" && (
                  <InstructionsTab sections={instructionSections} />
                )}

                {activeTab === "contributions" && (
                  <ContributionsTab submissions={submissions} />
                )}

                {activeTab === "submit" && (
                  <SubmitWorkTab
                    acceptsContributions={acceptsContributions}
                    connected={connected}
                    isAuthenticated={isAuthenticated}
                    address={address}
                    isSubmitting={isSubmitting}
                    submissionSuccess={submissionSuccess}
                    submissionError={submissionError}
                    contributionLink={contributionLink}
                    setContributionLink={setContributionLink}
                    contributionNotes={contributionNotes}
                    setContributionNotes={setContributionNotes}
                    linkError={linkError}
                    setLinkError={setLinkError}
                    handleContributionSubmit={handleContributionSubmit}
                  />
                )}

                {activeTab === "details" && <BountyMetaTab bounty={bounty} />}
              </div>
            </div>
          </section>
        </>
      )}

      <Footer />
    </main>
  );
}

export default BountyDetailsPage;
