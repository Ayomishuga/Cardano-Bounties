"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { useToast } from "@/components/toast/ToastProvider";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { authFetch } from "@/lib/api";
import { getEscrowLovelace } from "@/lib/cardano/amounts";
import { initiateBountyEscrow } from "@/lib/cardano/transactions/bountyEscrow";
import { MAX_REWARD_ADA, MAX_WINNERS, LOVELACE_PER_ADA, PLATFORM_FEE_RATE, PAYOUT_TYPE } from "@/lib/bountyContract";
import type { PayoutType } from "@/lib/bountyContract";
import styles from "./PostBountyPage.module.css";

type BountyForm = {
  title: string;
  type: string;
  customType: string;
  reward_amount: string;
  deadline: string;
  project_name: string;
  project_logo_url: string;
  description: string;
  bounty_instructions: string;
};

type FieldErrors = Partial<Record<keyof BountyForm | "prize_structure" | "max_winners" | "payout_type", string>>;

type CreatedBounty = {
  id?: string;
  title?: string;
  error?: string;
  retryable?: boolean;
  verification_pending?: boolean;
  escrow_tx_hash?: string;
  bounty?: {
    id?: string;
    title?: string;
    escrow_tx_hash?: string | null;
  };
};

type UploadResponse = {
  url?: string;
  error?: string;
};

const bountyTypes = [
  { value: "development", label: "Development" },
  { value: "design", label: "Design" },
  { value: "content", label: "Content" },
  { value: "hackathon", label: "Hackathon" },
  { value: "documentation", label: "Documentation" },
  { value: "research", label: "Research" },
  { value: "community", label: "Community" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
const MIN_TITLE_LENGTH = 8;
const MAX_TITLE_LENGTH = 120;
const MIN_CUSTOM_TYPE_LENGTH = 3;
const MAX_CUSTOM_TYPE_LENGTH = 80;
const MIN_DESCRIPTION_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 2000;
const MIN_INSTRUCTIONS_LENGTH = 20;
const MAX_INSTRUCTIONS_LENGTH = 2000;
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const adaFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const initialForm: BountyForm = {
  title: "",
  type: "development",
  customType: "",
  reward_amount: "",
  deadline: "",
  project_name: "",
  project_logo_url: "",
  description: "",
  bounty_instructions: "",
};

function getBountyType(form: BountyForm) {
  return form.type === "other" ? form.customType.trim() : form.type;
}

function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isValid ? date : null;
}

function getAmountBreakdown(value: string) {
  const contributorReward = Number(value);

  if (!value || Number.isNaN(contributorReward) || contributorReward <= 0) {
    return {
      contributorReward: 0,
      platformFee: 0,
      totalFunding: 0,
      isValid: false,
    };
  }

  const platformFee = contributorReward * PLATFORM_FEE_RATE;

  return {
    contributorReward,
    platformFee,
    totalFunding: contributorReward + platformFee,
    isValid: true,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function recordEscrowWithRetry({
  bountyId,
  txHash,
  escrowAddress,
  onRetry,
}: {
  bountyId: string;
  txHash: string;
  escrowAddress: string;
  onRetry: (attempt: number) => void;
}) {
  const maxAttempts = 10;
  const retryDelayMs = 6000;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const escrowResponse = await authFetch(`/api/bounties/${bountyId}/escrow`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: JSON.stringify({
        escrow_tx_hash: txHash,
        escrow_address: escrowAddress,
      }),
    });

    const escrowData = (await escrowResponse.json()) as CreatedBounty;

    if (escrowResponse.ok) return escrowData;

    lastError =
      escrowData.error ||
      `Escrow transaction submitted, but the app could not save the transaction hash: ${txHash}`;

    if (!escrowData.retryable && escrowResponse.status !== 425) {
      throw new Error(lastError);
    }

    if (attempt < maxAttempts) {
      onRetry(attempt);
      await wait(retryDelayMs);
    }
  }

  throw new Error(`${lastError} Transaction hash: ${txHash}`);
}

async function uploadProjectLogo(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await authFetch("/api/upload/logo", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as UploadResponse;

  if (!response.ok || !data.url) {
    throw new Error(data.error || "Unable to upload the project image.");
  }

  return data.url;
}

function validateForm(form: BountyForm) {
  const errors: FieldErrors = {};
  const reward = Number(form.reward_amount);
  const bountyType = getBountyType(form);
  const title = form.title.trim();
  const description = form.description.trim();
  const today = parseDateValue(getTodayDateValue());
  const deadline = form.deadline ? parseDateValue(form.deadline) : null;

  if (!title) {
    errors.title = "Add a clear bounty title.";
  } else if (title.length < MIN_TITLE_LENGTH) {
    errors.title = `Use at least ${MIN_TITLE_LENGTH} characters for the title.`;
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Keep the title under ${MAX_TITLE_LENGTH} characters.`;
  }

  if (!bountyType) {
    errors.type = form.type === "other" ? "Describe the bounty type you need." : "Choose a bounty type.";
  } else if (form.type === "other" && bountyType.length < MIN_CUSTOM_TYPE_LENGTH) {
    errors.type = `Use at least ${MIN_CUSTOM_TYPE_LENGTH} characters for the custom type.`;
  } else if (bountyType.length > MAX_CUSTOM_TYPE_LENGTH) {
    errors.type = `Keep the bounty type under ${MAX_CUSTOM_TYPE_LENGTH} characters.`;
  }

  if (!description) {
    errors.description = "Describe the work and expected outcome.";
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    errors.description = `Use at least ${MIN_DESCRIPTION_LENGTH} characters so contributors understand the brief.`;
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Keep the brief under ${MAX_DESCRIPTION_LENGTH} characters.`;
  }

  if (!form.bounty_instructions.trim()) {
    errors.bounty_instructions = "Add specific bounty instructions.";
  } else if (form.bounty_instructions.trim().length < MIN_INSTRUCTIONS_LENGTH) {
    errors.bounty_instructions = `Use at least ${MIN_INSTRUCTIONS_LENGTH} characters for the instructions.`;
  } else if (form.bounty_instructions.trim().length > MAX_INSTRUCTIONS_LENGTH) {
    errors.bounty_instructions = `Keep the instructions under ${MAX_INSTRUCTIONS_LENGTH} characters.`;
  }

  if (form.project_name.trim().length > MAX_PROJECT_NAME_LENGTH) {
    errors.project_name = `Keep the project name under ${MAX_PROJECT_NAME_LENGTH} characters.`;
  }

  if (!form.reward_amount.trim()) {
    errors.reward_amount = "Add the contributor reward in ADA.";
  } else if (Number.isNaN(reward) || reward <= 0) {
    errors.reward_amount = "Reward must be a positive ADA amount.";
  } else if (!/^\d+(\.\d{1,2})?$/.test(form.reward_amount.trim())) {
    errors.reward_amount = "Use up to two decimal places for ADA.";
  } else if (reward > MAX_REWARD_ADA) {
    errors.reward_amount = `Reward cannot exceed ${adaFormatter.format(MAX_REWARD_ADA)} ADA.`;
  }

  if (form.deadline && !deadline) {
    errors.deadline = "Choose a valid deadline.";
  } else if (deadline && today && deadline < today) {
    errors.deadline = "Deadline cannot be in the past.";
  }

  return errors;
}

export function PostBountyPage() {
  const router = useRouter();
  const { wallet, connected, isAuthenticated, reauthenticate } = useAppWallet();
  const toast = useToast();
  const [form, setForm] = useState<BountyForm>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [createdTitle, setCreatedTitle] = useState("");
  const [projectLogoFile, setProjectLogoFile] = useState<File | null>(null);
  const [projectLogoName, setProjectLogoName] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  // Payout structure state
  const [payoutType, setPayoutType] = useState<PayoutType>(PAYOUT_TYPE.Single);
  const [maxWinners, setMaxWinners] = useState<number | string>(2);
  const [prizeRows, setPrizeRows] = useState<{ rank: number; ada: string }[]>(
    [{ rank: 1, ada: "" }, { rank: 2, ada: "" }],
  );

  useEffect(() => {
    const saved = localStorage.getItem("cb_bounty_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTimeout(() => {
          setForm((current) => ({ ...current, ...parsed }));
        }, 0);
      } catch (err) {
        console.error("Failed to parse saved draft", err);
      }
    }
  }, []);

  useEffect(() => {
    if (JSON.stringify(form) === JSON.stringify(initialForm)) return;

    const timer = setTimeout(() => {
      localStorage.setItem("cb_bounty_draft", JSON.stringify(form));
      setIsDraftSaved(true);
      
      const statusTimer = setTimeout(() => {
        setIsDraftSaved(false);
      }, 3000);
      return () => clearTimeout(statusTimer);
    }, 1000);

    return () => clearTimeout(timer);
  }, [form]);

  const todayDateValue = useMemo(() => getTodayDateValue(), []);
  const displayType = getBountyType(form) || "Custom bounty";
  const amountBreakdown = useMemo(() => getAmountBreakdown(form.reward_amount), [form.reward_amount]);
  const rewardPreview = amountBreakdown.isValid
    ? `${adaFormatter.format(amountBreakdown.contributorReward)} ADA`
    : "Reward TBD";
  const totalFundingPreview = amountBreakdown.isValid
    ? `${adaFormatter.format(amountBreakdown.totalFunding)} ADA`
    : "Funding TBD";
  const projectNamePreview = form.project_name.trim() || "Project name optional";

  function updateField(field: keyof BountyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "customType" ? { type: undefined } : null),
    }));
    setSubmitError("");
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setErrors((current) => ({ ...current, project_logo_url: undefined }));
    setSubmitError("");

    if (!file) {
      setProjectLogoFile(null);
      setProjectLogoName("");
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setProjectLogoFile(null);
      setProjectLogoName("");
      setErrors((current) => ({ ...current, project_logo_url: "Upload a JPEG, PNG, WebP, or SVG image." }));
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setProjectLogoFile(null);
      setProjectLogoName("");
      setErrors((current) => ({ ...current, project_logo_url: "Project image must be under 2MB." }));
      return;
    }

    setProjectLogoFile(file);
    setProjectLogoName(file.name);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (payoutType !== PAYOUT_TYPE.Single) {
      const parsedWinners = Number(maxWinners);
      if (isNaN(parsedWinners) || parsedWinners < 2 || parsedWinners > MAX_WINNERS) {
        toast.error("Invalid winners count", `Number of winners must be between 2 and ${MAX_WINNERS}.`);
        return;
      }

      if (payoutType === PAYOUT_TYPE.ManualSplit) {
        const rewardAda = Number(form.reward_amount) || 0;
        const prizeSum = prizeRows.reduce((s, r) => s + (Number(r.ada) || 0), 0);
        const remaining = Math.round((rewardAda - prizeSum) * 1e6) / 1e6;
        if (Math.abs(remaining) > 0.001) {
          toast.error("Invalid prize allocation", "Prizes must sum exactly to the reward pool before submitting.");
          return;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Review the bounty form", "Fix the highlighted fields before funding escrow.");
      return;
    }

    if (!ESCROW_ADDRESS) {
      const message = "Escrow address is not configured. Add NEXT_PUBLIC_ESCROW_ADDRESS before posting bounties.";
      setSubmitError(message);
      toast.error("Escrow is not configured", message);
      return;
    }

    if (!connected || !wallet) {
      const message = "Connect your Cardano wallet before posting a bounty.";
      setSubmitError(message);
      toast.error("Wallet required", message);
      return;
    }

    setShowConfirmModal(true);
  }

  async function executeSubmit() {
    if (!wallet || !ESCROW_ADDRESS) {
      setSubmitError("Wallet not connected or escrow address is missing.");
      return;
    }
    setIsSubmitting(true);
    setSubmitStep("Preparing bounty...");
    setSubmitError("");
    setCreatedTitle("");

    let createdBountyId = "";
    let escrowTxSubmitted = false;

    try {
      if (!isAuthenticated) {
        setSubmitStep("Requesting wallet signature...");
        await reauthenticate();
      }

      const bountyType = getBountyType(form);
      let projectLogoUrl = form.project_logo_url;

      if (projectLogoFile) {
        setSubmitStep("Uploading project image...");
        projectLogoUrl = await uploadProjectLogo(projectLogoFile);
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        bounty_instructions: form.bounty_instructions.trim(),
        type: form.type,
        custom_type: form.type === "other" ? bountyType : null,
        reward_amount: amountBreakdown.contributorReward,
        platform_fee_amount: amountBreakdown.platformFee,
        total_funding_amount: amountBreakdown.totalFunding,
        deadline: form.deadline || null,
        project_name: form.project_name.trim() || null,
        project_logo_url: projectLogoUrl || null,
        // Payout structure
        payout_type: payoutType,
        max_winners: payoutType === PAYOUT_TYPE.Single ? 1 : Number(maxWinners),
        prize_structure: payoutType === PAYOUT_TYPE.ManualSplit
          ? prizeRows.map((r) => ({
              rank: r.rank,
              amount_lovelace: Math.round(Number(r.ada) * LOVELACE_PER_ADA),
            }))
          : null,
      };

      setSubmitStep("Creating bounty record...");
      const response = await authFetch("/api/bounties", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CreatedBounty;

      if (!response.ok) {
        throw new Error(data.error || "Unable to post this bounty right now.");
      }

      if (!data.id) {
        throw new Error("Bounty was created without an id. Escrow could not continue.");
      }

      createdBountyId = data.id;
      toast.info("Bounty created", "Approve the wallet transaction to lock the reward and platform fee.");

      setSubmitStep("Waiting for wallet approval...");
      const escrowLovelace = getEscrowLovelace(form.reward_amount).toString();
      const txHash = await initiateBountyEscrow({
        wallet,
        escrowAddress: ESCROW_ADDRESS,
        lovelace: escrowLovelace,
      });
      escrowTxSubmitted = true;

      setSubmitStep("Recording escrow transaction...");
      const escrowRecord = await recordEscrowWithRetry({
        bountyId: data.id,
        txHash,
        escrowAddress: ESCROW_ADDRESS,
        onRetry: (attempt) => {
          setSubmitStep(`Waiting for Blockfrost indexing... retry ${attempt}/9`);
        },
      });

      setCreatedTitle(escrowRecord.title || escrowRecord.bounty?.title || data.title || payload.title);
      setForm(initialForm);
      setProjectLogoFile(null);
      setProjectLogoName("");
      localStorage.removeItem("cb_bounty_draft");

      if (escrowRecord.verification_pending) {
        toast.success(
          "Escrow transaction submitted",
          "Your transaction hash is saved. We will keep checking on-chain confirmation from your dashboard.",
        );
      } else {
        toast.success("Bounty funded", "The bounty has been funded and is now awaiting admin review.");
      }

      router.push("/dashboard");
    } catch (error) {
      const message = getErrorMessage(error, "Unable to post this bounty right now.");

      if (createdBountyId && !escrowTxSubmitted) {
        try {
          await authFetch(`/api/bounties/${createdBountyId}`, {
            method: "DELETE",
            headers: { Accept: "application/json" },
          });
          toast.error("Bounty was not funded", "The unfunded bounty was invalidated. Please start again.");
        } catch {
          toast.error(
            "Escrow failed",
            "The wallet transaction failed, but the app could not invalidate the bounty automatically.",
          );
        }
      } else if (escrowTxSubmitted) {
        toast.error(
          "Escrow verification needs attention",
          "The wallet transaction was submitted, but the app could not complete escrow recording. Contact support before retrying.",
        );
      } else {
        toast.error("Bounty posting failed", message);
      }

      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
      setSubmitStep("");
    }
  }

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

          <aside className={styles.briefPreview} aria-label="Bounty preview">
            <span>Preview</span>
            <h2>{form.title || "Your bounty title"}</h2>
            <strong className={styles.projectPreviewName}>{projectNamePreview}</strong>
            <p>{form.description || "A concise contributor-facing summary will appear here as you write the brief."}</p>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{displayType}</dd>
              </div>
              <div>
                <dt>Reward</dt>
                <dd>{rewardPreview}</dd>
              </div>
              <div>
                <dt>Total funding</dt>
                <dd>{totalFundingPreview}</dd>
              </div>
              <div>
                <dt>Deadline</dt>
                <dd>{form.deadline || "Rolling"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className={styles.formSection}>
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
      </section>

      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Confirm Bounty Funding</h3>
            <p>You are about to post a new bounty and initiate an on-chain escrow transaction.</p>
            
            <div className={styles.modalBreakdown}>
              <div className={styles.modalBreakdownRow}>
                <span>Contributor Reward</span>
                <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.contributorReward) : "0"} ADA</strong>
              </div>
              <div className={styles.modalBreakdownRow}>
                <span>Platform Fee (10%)</span>
                <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.platformFee) : "0"} ADA</strong>
              </div>
              <hr className={styles.modalDivider} />
              <div className={styles.modalBreakdownRow} data-total="true">
                <span>Total Escrow Funding</span>
                <strong>{amountBreakdown.isValid ? adaFormatter.format(amountBreakdown.totalFunding) : "0"} ADA</strong>
              </div>
            </div>

            <p className={styles.modalWarning}>
              Please make sure your Cardano wallet is connected and has sufficient funds to cover the total amount plus transaction fees.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalConfirmButton}
                onClick={() => {
                  setShowConfirmModal(false);
                  void executeSubmit();
                }}
              >
                Confirm & Fund
              </button>
            </div>
          </div>
        </div>
      )}

      {isSubmitting && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} ${styles.processingContent}`}>
            <div className={styles.spinner} />
            <h3>Processing On-Chain Escrow</h3>
            <p className={styles.stepMessage}>{submitStep}</p>
            <p className={styles.processingNote}>
              Do not close this tab or disconnect your wallet. On-chain validation can take up to a minute.
            </p>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}
