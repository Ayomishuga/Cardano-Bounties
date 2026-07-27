const fs = require("fs");
const path = require("path");

const filePath = path.join("app", "pages", "AdminPayoutsPage.tsx");
let content = fs.readFileSync(filePath, "utf8");

// 1. Add state variables for address resolution
const stateAnchor = `const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");`;
const stateAdditions = `const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedSource, setResolvedSource] = useState<"db" | "blockfrost" | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);`;
content = content.replace(stateAnchor, stateAdditions);

// 2. Add Shimmer import if not present (it is already imported as AdminTableBodyShimmer, let's also import Shimmer)
content = content.replace(
  `import { AdminTableBodyShimmer } from "@/components/dashboard/ShimmerLoaders";`,
  `import { AdminTableBodyShimmer, Shimmer } from "@/components/dashboard/ShimmerLoaders";`
);

// 3. Update openReleaseModal & closeModal
const handlersAnchor = `  const openReleaseModal = (alloc: Allocation, bounty: Bounty) => {
    setSelectedAlloc(alloc);
    setSelectedBounty(bounty);
    setTxHash("");
  };

  const closeModal = () => {
    setSelectedAlloc(null);
    setSelectedBounty(null);
    setTxHash("");
  };`;

const handlersReplacement = `  const openReleaseModal = (alloc: Allocation, bounty: Bounty) => {
    setSelectedAlloc(alloc);
    setSelectedBounty(bounty);
    setTxHash("");
    setResolvedAddress(null);
    setResolvedSource(null);
    setResolveError(null);
    
    const stake = alloc.users?.stake_address;
    if (stake) {
      setResolvingAddress(true);
      authFetch(\`/api/users/resolve-address?stake=\${stake}\`)
        .then(async (res) => {
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.error || "Failed to resolve payment address");
          }
          setResolvedAddress(payload.payment_address || null);
          setResolvedSource(payload.source || "blockfrost");
        })
        .catch((err) => {
          setResolveError(err instanceof Error ? err.message : "Unable to resolve payment address.");
        })
        .finally(() => {
          setResolvingAddress(false);
        });
    } else {
      setResolveError("Contributor stake address is missing.");
    }
  };

  const closeModal = () => {
    setSelectedAlloc(null);
    setSelectedBounty(null);
    setTxHash("");
    setResolvingAddress(false);
    setResolvedAddress(null);
    setResolvedSource(null);
    setResolveError(null);
  };`;

content = content.replace(handlersAnchor, handlersReplacement);

// 4. Update executeOnChainPayout to use resolvedAddress directly
const executeAnchor = `  const executeOnChainPayout = async () => {
    if (!selectedAlloc || !selectedBounty) return;
    if (!wallet || !address) {
      toast.error("Wallet required", "Connect a wallet to execute on-chain payouts.");
      return;
    }
    const stakeAddress = selectedAlloc.users?.stake_address;
      if (!stakeAddress) {
        toast.error("Data missing", "Contributor stake address is missing.");
        return;
      }
      if (!selectedBounty.escrow_tx_hash) {
        toast.error("Data missing", "Bounty escrow transaction hash is missing.");
        return;
      }
      
      setIsExecutingOnChain(true);
      try {
        toast.info("Resolving address", "Looking up the contributor's payment address...");
        const resolveRes = await authFetch(\`/api/users/resolve-address?stake=\${stakeAddress}\`);
        const resolveData = await resolveRes.json().catch(() => ({}));
        
        if (!resolveRes.ok) {
          throw new Error(resolveData.error || "Unable to resolve payment address.");
        }
        
        const recipientAddress = resolveData.payment_address;
        if (!recipientAddress) {
          throw new Error("No payment address found for this contributor.");
        }
  
        toast.info("Building transaction", "Preparing payout transaction...");
        const newTxHash = await releaseBountyPayout({`;

const executeReplacement = `  const executeOnChainPayout = async () => {
    if (!selectedAlloc || !selectedBounty) return;
    if (!wallet || !address) {
      toast.error("Wallet required", "Connect a wallet to execute on-chain payouts.");
      return;
    }
    if (!resolvedAddress) {
      toast.error("Address error", resolveError || "No valid payment address available.");
      return;
    }
    if (!selectedBounty.escrow_tx_hash) {
      toast.error("Data missing", "Bounty escrow transaction hash is missing.");
      return;
    }
    
    setIsExecutingOnChain(true);
    try {
      toast.info("Building transaction", "Preparing payout transaction...");
      const newTxHash = await releaseBountyPayout({
        wallet,
        recipientAddress: resolvedAddress,`;

content = content.replace(executeAnchor, executeReplacement);

// 5. Enhance Modal UI with Payment Address resolution block, Shimmer, badges, and Error Alert
const modalSectionAnchor = `              <div className={styles.contentSection}>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Recipient stake address</div>
                  <div className={styles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
                    {selectedAlloc.users?.stake_address || "Address not recorded"}
                  </div>
                </div>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Payout amount</div>`;

const modalSectionReplacement = `              <div className={styles.contentSection}>
                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Recipient stake address</div>
                  <div className={styles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
                    {selectedAlloc.users?.stake_address || "Address not recorded"}
                  </div>
                </div>

                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Resolved payment address (addr1...)</span>
                    {resolvedSource && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: resolvedSource === "db" ? "rgba(22, 163, 74, 0.1)" : "rgba(1, 81, 194, 0.1)",
                        color: resolvedSource === "db" ? "#16a34a" : "var(--blue)",
                        textTransform: "uppercase"
                      }}>
                        {resolvedSource === "db" ? "DB Cache" : "Blockfrost"}
                      </span>
                    )}
                  </div>
                  <div className={styles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all", minHeight: 24, display: "flex", alignItems: "center" }}>
                    {resolvingAddress ? (
                      <Shimmer style={{ height: "16px", width: "100%", borderRadius: "4px" }} />
                    ) : resolvedAddress ? (
                      <span style={{ color: "var(--foreground)" }}>{resolvedAddress}</span>
                    ) : resolveError ? (
                      <span style={{ color: "#dc2626", fontSize: 11, fontWeight: 500 }}>
                        ⚠️ {resolveError}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No payment address resolved</span>
                    )}
                  </div>
                </div>

                <div className={styles.contentBlock}>
                  <div className={styles.contentLabel}>Payout amount</div>`;

content = content.replace(modalSectionAnchor, modalSectionReplacement);

// 6. Update Approve button in Modal
const buttonAnchor = `<button type="button" className={styles.approveBtn} disabled={isSubmitting || isExecutingOnChain} onClick={() => void executeOnChainPayout()}>
                {isExecutingOnChain ? <div className={styles.spinner} /> : "Release On-Chain"}
              </button>`;

const buttonReplacement = `<button type="button" className={styles.approveBtn} disabled={isSubmitting || isExecutingOnChain || resolvingAddress || !resolvedAddress} onClick={() => void executeOnChainPayout()}>
                {isExecutingOnChain ? (
                  <div className={styles.spinner} />
                ) : resolvingAddress ? (
                  "Resolving Address..."
                ) : (
                  "Release On-Chain"
                )}
              </button>`;

content = content.replace(buttonAnchor, buttonReplacement);

fs.writeFileSync(filePath, content, "utf8");
console.log("Modal enhancements applied successfully!");
