"use client";

import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { MAX_REWARD_ADA, MAX_WINNERS, PAYOUT_TYPE } from "@/lib/bountyContract";
import type { PayoutType } from "@/types/bounty";
import type { BountyForm, FieldErrors } from "./types";
import {
  bountyTypes,
  MIN_TITLE_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_CUSTOM_TYPE_LENGTH,
  MAX_CUSTOM_TYPE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MIN_INSTRUCTIONS_LENGTH,
  MAX_INSTRUCTIONS_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  adaFormatter,
} from "./types";
import styles from "../PostBountyPage.module.css";

export function PostBountyFormFields({
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
  submitError,
  createdTitle,
  handleSubmit,
  amountBreakdown,
  todayDateValue,
}: {
  form: BountyForm;
  errors: FieldErrors;
  updateField: (field: keyof BountyForm, value: string) => void;
  handleLogoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  projectLogoName: string;
  isDraftSaved: boolean;
  payoutType: PayoutType;
  setPayoutType: (type: PayoutType) => void;
  maxWinners: number | string;
  setMaxWinners: (val: number | string) => void;
  prizeRows: { rank: number; ada: string }[];
  setPrizeRows: (rows: { rank: number; ada: string }[]) => void;
  isSubmitting: boolean;
  submitError: string;
  createdTitle: string;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  amountBreakdown: { contributorReward: number; platformFee: number; totalFunding: number; isValid: boolean };
  todayDateValue: string;
}) {
  return (
    <div className={`container ${styles.formGrid}`}>
      <form className={styles.bountyForm} onSubmit={handleSubmit} noValidate>
        <div className={styles.formHeader}>
          <span>Bounty details</span>
          <h2>Describe the work clearly</h2>
          <p>Choose a known bounty category or describe a custom one. Rewards are entered in ADA.</p>
        </div>

        {createdTitle ? (
          <div className={styles.successMessage} role="status">
            <strong>Bounty posted.</strong>
            <span>{createdTitle} is funded and awaiting admin review.</span>
          </div>
        ) : null}

        {submitError ? (
          <div className={styles.errorMessage} role="alert">
            {submitError}
          </div>
        ) : null}

        <div className={styles.fieldGroup}>
          <label htmlFor="title">Bounty title</label>
          <input
            id="title"
            type="text"
            value={form.title}
            placeholder="Example: Build a wallet onboarding checklist"
            minLength={MIN_TITLE_LENGTH}
            maxLength={MAX_TITLE_LENGTH}
            onChange={(event) => updateField("title", event.target.value)}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : "title-hint"}
          />
          {errors.title ? <span id="title-error">{errors.title}</span> : null}
          {!errors.title ? (
            <small id="title-hint" className={styles.fieldHint}>
              {form.title.trim().length}/{MAX_TITLE_LENGTH} characters
            </small>
          ) : null}
        </div>

        <div className={styles.splitFields}>
          <div className={styles.fieldGroup}>
            <label htmlFor="type">Bounty type</label>
            <select
              id="type"
              value={form.type}
              onChange={(event) => {
                updateField("type", event.target.value);
                if (event.target.value !== "other") updateField("customType", "");
              }}
              aria-invalid={Boolean(errors.type)}
              aria-describedby={errors.type ? "type-error" : undefined}
            >
              {bountyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.type && form.type !== "other" ? <span id="type-error">{errors.type}</span> : null}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="reward">Reward pool</label>
            <input
              id="reward"
              type="number"
              min="0"
              max={MAX_REWARD_ADA}
              step="0.01"
              inputMode="decimal"
              value={form.reward_amount}
              placeholder="1200"
              onChange={(event) => updateField("reward_amount", event.target.value)}
              aria-invalid={Boolean(errors.reward_amount)}
              aria-describedby={errors.reward_amount ? "reward-error" : "reward-hint"}
            />
            {errors.reward_amount ? <span id="reward-error">{errors.reward_amount}</span> : null}
            {!errors.reward_amount ? (
              <small id="reward-hint" className={styles.fieldHint}>
                Total reward pool in ADA. Platform fee is added below.
              </small>
            ) : null}
          </div>
        </div>

        {form.type === "other" ? (
          <div className={`${styles.fieldGroup} ${styles.customTypeField}`}>
            <label htmlFor="custom-type">Describe bounty type</label>
            <input
              id="custom-type"
              type="text"
              value={form.customType}
              placeholder="Example: Tokenomics review, governance facilitation"
              minLength={MIN_CUSTOM_TYPE_LENGTH}
              maxLength={MAX_CUSTOM_TYPE_LENGTH}
              onChange={(event) => updateField("customType", event.target.value)}
              aria-invalid={Boolean(errors.type)}
              aria-describedby={errors.type ? "custom-type-error" : "custom-type-hint"}
            />
            {errors.type ? <span id="custom-type-error">{errors.type}</span> : null}
            {!errors.type ? (
              <small id="custom-type-hint" className={styles.fieldHint}>
                {form.customType.trim().length}/{MAX_CUSTOM_TYPE_LENGTH} characters
              </small>
            ) : null}
          </div>
        ) : null}

        {/* Payout structure section */}
        <div className={styles.fieldGroup}>
          <label>Payout structure</label>
          <div className={styles.payoutTypeGroup}>
            {[
              { value: PAYOUT_TYPE.Single, label: "Single winner", hint: "Full pool goes to one contributor" },
              { value: PAYOUT_TYPE.EqualSplit, label: "Equal split", hint: "Pool divided equally among N winners" },
              { value: PAYOUT_TYPE.ManualSplit, label: "Ranked prizes", hint: "Set custom amounts per placement" },
            ].map((opt) => (
              <label key={opt.value} className={`${styles.payoutRadio} ${payoutType === opt.value ? styles.payoutRadioActive : ""}`}>
                <input
                  type="radio"
                  name="payout_type"
                  value={opt.value}
                  checked={payoutType === opt.value}
                  onChange={() => {
                    setPayoutType(opt.value as PayoutType);
                    if (opt.value === PAYOUT_TYPE.Single) {
                      setMaxWinners(2);
                      setPrizeRows([{ rank: 1, ada: "" }, { rank: 2, ada: "" }]);
                    }
                  }}
                />
                <span className={styles.payoutRadioLabel}>{opt.label}</span>
                <span className={styles.payoutRadioHint}>{opt.hint}</span>
              </label>
            ))}
          </div>
        </div>

        {payoutType !== PAYOUT_TYPE.Single ? (
          <div className={styles.fieldGroup}>
            <label htmlFor="max-winners">Number of winners</label>
            <input
              id="max-winners"
              type="number"
              min={2}
              max={MAX_WINNERS}
              value={maxWinners}
              onChange={(e) => {
                const val = e.target.value;
                setMaxWinners(val);
                const n = parseInt(val, 10);
                if (!isNaN(n) && n >= 2 && n <= MAX_WINNERS && payoutType === PAYOUT_TYPE.ManualSplit) {
                  setPrizeRows(
                    Array.from({ length: n }, (_, i) => ({
                      rank: i + 1,
                      ada: prizeRows[i]?.ada ?? "",
                    }))
                  );
                }
              }}
            />
            {maxWinners !== "" && (Number(maxWinners) < 2 || Number(maxWinners) > MAX_WINNERS || isNaN(Number(maxWinners))) ? (
              <span id="winners-error">Number of winners must be between 2 and {MAX_WINNERS}.</span>
            ) : (
              <small className={styles.fieldHint}>2 – {MAX_WINNERS} winners</small>
            )}
          </div>
        ) : null}

        {payoutType === PAYOUT_TYPE.ManualSplit ? (() => {
          const rewardAda = Number(form.reward_amount) || 0;
          const prizeSum = prizeRows.reduce((s, r) => s + (Number(r.ada) || 0), 0);
          const remaining = Math.round((rewardAda - prizeSum) * 1e6) / 1e6;
          const rankLabel = (r: number) => r === 1 ? "🥇 1st" : r === 2 ? "🥈 2nd" : r === 3 ? "🥉 3rd" : `${r}th`;
          return (
            <div className={styles.prizeStructureSection}>
              <label>Prize breakdown</label>
              {prizeRows.map((row, i) => (
                <div key={row.rank} className={styles.prizeRow}>
                  <span className={styles.prizeRankLabel}>{rankLabel(row.rank)} place</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="ADA"
                    value={row.ada}
                    aria-label={`${rankLabel(row.rank)} place prize in ADA`}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        const updated = [...prizeRows];
                        updated[i] = { ...updated[i], ada: val };
                        setPrizeRows(updated);
                      }
                    }}
                  />
                  <span className={styles.prizeAdaLabel}>ADA</span>
                </div>
              ))}
              <div className={`${styles.prizeTotal} ${Math.abs(remaining) > 0.001 ? styles.prizeTotalError : styles.prizeTotalOk}`}>
                <span>Pool: {rewardAda} ADA</span>
                <span>Allocated: {prizeSum.toFixed(6)} ADA</span>
                <span>Remaining: {remaining.toFixed(6)} ADA</span>
                {Math.abs(remaining) > 0.001 ? (
                  <span className={styles.prizeWarning}>Prizes must sum exactly to the reward pool before submitting.</span>
                ) : (
                  <span className={styles.prizeOk}>Prize allocation complete.</span>
                )}
              </div>
            </div>
          );
        })() : null}

        <section className={styles.feeBreakdown} aria-label="ADA funding breakdown">
          <div>
            <span>Contributor reward</span>
            <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.contributorReward) : "0"} ADA</strong>
          </div>
          <div>
            <span>Platform fee</span>
            <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.platformFee) : "0"} ADA</strong>
            <small>10% added automatically</small>
          </div>
          <div>
            <span>Total to fund</span>
            <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.totalFunding) : "0"} ADA</strong>
          </div>
        </section>

        <div className={styles.splitFields}>
          <div className={styles.fieldGroup}>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              type="text"
              value={form.project_name}
              placeholder="Optional project or team name"
              maxLength={MAX_PROJECT_NAME_LENGTH}
              onChange={(event) => updateField("project_name", event.target.value)}
              aria-invalid={Boolean(errors.project_name)}
              aria-describedby={errors.project_name ? "project-name-error" : "project-name-hint"}
            />
            {errors.project_name ? <span id="project-name-error">{errors.project_name}</span> : null}
            {!errors.project_name ? (
              <small id="project-name-hint" className={styles.fieldHint}>
                {form.project_name.trim().length}/{MAX_PROJECT_NAME_LENGTH} characters
              </small>
            ) : null}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="project-logo">Project image</label>
            <input
              id="project-logo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              aria-invalid={Boolean(errors.project_logo_url)}
              aria-describedby={errors.project_logo_url ? "project-logo-error" : "project-logo-hint"}
            />
            {errors.project_logo_url ? <span id="project-logo-error">{errors.project_logo_url}</span> : null}
            {!errors.project_logo_url ? (
              <small id="project-logo-hint" className={styles.fieldHint}>
                {projectLogoName || "Optional JPEG, PNG, WebP, or SVG under 2MB."}
              </small>
            ) : null}
          </div>
        </div>

        <div className={styles.splitFields}>
          <div className={styles.fieldGroup}>
            <label htmlFor="deadline">Deadline</label>
            <input
              id="deadline"
              type="date"
              min={todayDateValue}
              value={form.deadline}
              onChange={(event) => updateField("deadline", event.target.value)}
              aria-invalid={Boolean(errors.deadline)}
              aria-describedby={errors.deadline ? "deadline-error" : "deadline-hint"}
            />
            {errors.deadline ? <span id="deadline-error">{errors.deadline}</span> : null}
            {!errors.deadline ? (
              <small id="deadline-hint" className={styles.fieldHint}>
                Earliest selectable deadline is today.
              </small>
            ) : null}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="description">Bounty brief</label>
          <textarea
            id="description"
            value={form.description}
            placeholder="Explain the goal, deliverables, acceptance criteria, and any links contributors need."
            rows={8}
            minLength={MIN_DESCRIPTION_LENGTH}
            maxLength={MAX_DESCRIPTION_LENGTH}
            onChange={(event) => updateField("description", event.target.value)}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "description-error" : "description-hint"}
          />
          {errors.description ? <span id="description-error">{errors.description}</span> : null}
          {!errors.description ? (
            <small id="description-hint" className={styles.fieldHint}>
              {form.description.trim().length}/{MAX_DESCRIPTION_LENGTH} characters. Include deliverables and acceptance criteria.
            </small>
          ) : null}
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="bounty-instructions">Bounty instructions</label>
          <textarea
            id="bounty-instructions"
            value={form.bounty_instructions}
            placeholder="Explain how winners are selected, whether rewards go to one or multiple winners, review expectations, and any submission rules."
            rows={7}
            minLength={MIN_INSTRUCTIONS_LENGTH}
            maxLength={MAX_INSTRUCTIONS_LENGTH}
            onChange={(event) => updateField("bounty_instructions", event.target.value)}
            aria-invalid={Boolean(errors.bounty_instructions)}
            aria-describedby={errors.bounty_instructions ? "instructions-error" : "instructions-hint"}
          />
          {errors.bounty_instructions ? <span id="instructions-error">{errors.bounty_instructions}</span> : null}
          {!errors.bounty_instructions ? (
            <small id="instructions-hint" className={styles.fieldHint}>
              {form.bounty_instructions.trim().length}/{MAX_INSTRUCTIONS_LENGTH} characters. Include reward distribution and review rules.
            </small>
          ) : null}
        </div>

        <div className={styles.formActions}>
          <button type="submit" disabled={isSubmitting}>
            Post bounty
          </button>
          <Link href="/explore">View bounties</Link>
          {isDraftSaved && (
            <div className={styles.draftStatus}>
              <span className={styles.draftStatusDot} />
              <span>Draft saved</span>
            </div>
          )}
        </div>
      </form>

      <aside className={styles.guidancePanel}>
        <span>Before posting</span>
        <h2>What strong bounties include</h2>
        <ul>
          <li>One clear outcome contributors can deliver.</li>
          <li>Acceptance criteria that make review straightforward.</li>
          <li>Reward amount or a note that reward is still being finalized.</li>
          <li>Context links, design files, repos, or references when available.</li>
        </ul>
        <div>
          <strong>Current API status</strong>
          <p>Wallet authentication is required. After escrow is recorded, the bounty waits for admin review before it appears publicly.</p>
        </div>
      </aside>
    </div>
  );
}
