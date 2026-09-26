"use client";

import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { usePostBountyForm } from "./usePostBountyForm";
import { PostBountyPreview } from "./PostBountyPreview";
import { PostBountyFormFields } from "./PostBountyFormFields";
import { ConfirmFundingModal, ProcessingEscrowModal } from "./ConfirmFundingModal";
import styles from "../PostBountyPage.module.css";

export function PostBountyPage() {
  const {
    form,
    errors,
    updateField,
    handleLogoChange,
    projectLogoName,
    isDraftSaved,
    payoutType,
    setPayoutType,
    maxWinners,
    setMaxWinners,
    prizeRows,
    setPrizeRows,
    isSubmitting,
    submitStep,
    submitError,
    createdTitle,
    showConfirmModal,
    setShowConfirmModal,
    handleSubmit,
    executeSubmit,
    amountBreakdown,
    rewardPreview,
    totalFundingPreview,
    projectNamePreview,
    displayType,
    todayDateValue,
  } = usePostBountyForm();

  return (
    <main className={`page ${styles.postPage}`}>
      <Header />

      <section className={styles.postHero}>
        <div className={`container ${styles.postHeroGrid}`}>
          <div className={styles.postHeroCopy}>
            <span className="eyebrow">
              <i /> Project bounty intake
            </span>
            <h1>Post a Cardano bounty</h1>
            <p>
              Create a focused bounty brief with a clear scope, reward, and deadline so contributors can quickly
              understand the work and decide whether to apply.
            </p>
          </div>

          <PostBountyPreview
            form={form}
            projectNamePreview={projectNamePreview}
            displayType={displayType}
            rewardPreview={rewardPreview}
            totalFundingPreview={totalFundingPreview}
          />
        </div>
      </section>

      <section className={styles.formSection}>
        <PostBountyFormFields
          form={form}
          errors={errors}
          updateField={updateField}
          handleLogoChange={handleLogoChange}
          projectLogoName={projectLogoName}
          isDraftSaved={isDraftSaved}
          payoutType={payoutType}
          setPayoutType={setPayoutType}
          maxWinners={maxWinners}
          setMaxWinners={setMaxWinners}
          prizeRows={prizeRows}
          setPrizeRows={setPrizeRows}
          isSubmitting={isSubmitting}
          submitError={submitError}
          createdTitle={createdTitle}
          handleSubmit={handleSubmit}
          amountBreakdown={amountBreakdown}
          todayDateValue={todayDateValue}
        />
      </section>

      {showConfirmModal && (
        <ConfirmFundingModal
          amountBreakdown={amountBreakdown}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => {
            setShowConfirmModal(false);
            void executeSubmit();
          }}
        />
      )}

      {isSubmitting && <ProcessingEscrowModal submitStep={submitStep} />}

      <Footer />
    </main>
  );
}

export default PostBountyPage;
