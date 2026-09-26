"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast/ToastProvider";
import { useAppWallet } from "@/components/wallet/WalletProvider";
import { authFetch } from "@/lib/api";
import { getEscrowLovelace } from "@/lib/cardano/amounts";
import { initiateBountyEscrow } from "@/lib/cardano/transactions/bountyEscrow";
import { MAX_WINNERS, LOVELACE_PER_ADA, PAYOUT_TYPE } from "@/lib/bountyContract";
import type { PayoutType } from "@/types/bounty";
import type { BountyForm, FieldErrors, CreatedBounty } from "./types";
import {
  initialForm,
  ESCROW_ADDRESS,
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_BYTES,
  adaFormatter,
} from "./types";
import {
  getBountyType,
  getTodayDateValue,
  getAmountBreakdown,
  getErrorMessage,
  validateForm,
  recordEscrowWithRetry,
  uploadProjectLogo,
} from "./helpers";

export function usePostBountyForm() {
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
  const [prizeRows, setPrizeRows] = useState<{ rank: number; ada: string }[]>([
    { rank: 1, ada: "" },
    { rank: 2, ada: "" },
  ]);

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
        payout_type: payoutType,
        max_winners: payoutType === PAYOUT_TYPE.Single ? 1 : Number(maxWinners),
        prize_structure:
          payoutType === PAYOUT_TYPE.ManualSplit
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

  return {
    form,
    errors,
    updateField,
    handleLogoChange,
    projectLogoFile,
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
  };
}
