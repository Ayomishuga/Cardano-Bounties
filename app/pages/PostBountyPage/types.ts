export type BountyForm = {
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

export type FieldErrors = Partial<Record<keyof BountyForm | "prize_structure" | "max_winners" | "payout_type", string>>;

export type CreatedBounty = {
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

export type UploadResponse = {
  url?: string;
  error?: string;
};

export const bountyTypes = [
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

export const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
export const MIN_TITLE_LENGTH = 8;
export const MAX_TITLE_LENGTH = 120;
export const MIN_CUSTOM_TYPE_LENGTH = 3;
export const MAX_CUSTOM_TYPE_LENGTH = 80;
export const MIN_DESCRIPTION_LENGTH = 40;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MIN_INSTRUCTIONS_LENGTH = 20;
export const MAX_INSTRUCTIONS_LENGTH = 2000;
export const MAX_PROJECT_NAME_LENGTH = 120;
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export const adaFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

export const initialForm: BountyForm = {
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
