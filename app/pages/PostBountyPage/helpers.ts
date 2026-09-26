import { authFetch } from "@/lib/api";
import { PLATFORM_FEE_RATE, MAX_REWARD_ADA } from "@/lib/bountyContract";
import type { BountyForm, FieldErrors, CreatedBounty, UploadResponse } from "./types";
import {
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

export function getBountyType(form: BountyForm) {
  return form.type === "other" ? form.customType.trim() : form.type;
}

export function getTodayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isValid ? date : null;
}

export function getAmountBreakdown(value: string) {
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

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function recordEscrowWithRetry({
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
  let lastPendingRecord: CreatedBounty | null = null;

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
    const verificationPending =
      Boolean(escrowData.verification_pending) ||
      (escrowResponse.status === 202 && Boolean(escrowData.retryable));

    if (escrowResponse.ok && !verificationPending) return escrowData;

    lastError =
      escrowData.error ||
      `Escrow transaction submitted, but verification is still pending: ${txHash}`;

    if (verificationPending) {
      lastPendingRecord = escrowData;
    }

    if (!verificationPending && !escrowData.retryable && escrowResponse.status !== 425) {
      throw new Error(lastError);
    }

    if (attempt < maxAttempts) {
      onRetry(attempt);
      await wait(retryDelayMs);
    }
  }

  if (lastPendingRecord) {
    return lastPendingRecord;
  }

  throw new Error(`${lastError} Transaction hash: ${txHash}`);
}

export async function uploadProjectLogo(file: File) {
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

export function validateForm(form: BountyForm) {
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
