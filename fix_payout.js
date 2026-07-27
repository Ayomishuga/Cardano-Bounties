const fs = require("fs");
const path = require("path");

const filePath = path.join("app", "pages", "AdminPayoutsPage.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Fix 1: Filter logic
const filterPattern = /if \(filter === "needs_allocation"\) list = list\.filter\(\(b\) => b\.status === "in_review" && !b\.winners_finalized\);/;
const filterReplacement = `if (filter === "needs_allocation") {
      list = list.filter((b) => 
        (b.status === "in_review" && !b.winners_finalized) ||
        (b.status === "open" && (b.submissions ?? []).some((s) => s.status === "approved"))
      );
    }`;
content = content.replace(filterPattern, filterReplacement);

// Fix 2: Address resolution in executeOnChainPayout
const executePattern = /const recipientAddress = selectedAlloc\.users\?\.stake_address;\s+if \(!recipientAddress\) \{\s+toast\.error\("Data missing", "Contributor stake address is missing\."\);\s+return;\s+\}\s+if \(!selectedBounty\.escrow_tx_hash\) \{\s+toast\.error\("Data missing", "Bounty escrow transaction hash is missing\."\);\s+return;\s+\}\s+setIsExecutingOnChain\(true\);\s+try \{\s+toast\.info\("Building transaction", "Preparing payout transaction\.\.\."\);\s+const newTxHash = await releaseBountyPayout\(\{/;

const executeReplacement = `const stakeAddress = selectedAlloc.users?.stake_address;
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
        const res = await authFetch(\`/api/users/resolve-address?stake=\${stakeAddress}\`);
        const resolveData = await res.json().catch(() => ({}));
        
        if (!res.ok) {
          throw new Error(resolveData.error || "Unable to resolve payment address.");
        }
        
        const recipientAddress = resolveData.payment_address;
        if (!recipientAddress) {
          throw new Error("No payment address found for this contributor.");
        }
  
        toast.info("Building transaction", "Preparing payout transaction...");
        const newTxHash = await releaseBountyPayout({`;

content = content.replace(executePattern, executeReplacement);

fs.writeFileSync(filePath, content, "utf8");
console.log("Successfully fixed AdminPayoutsPage.tsx");
