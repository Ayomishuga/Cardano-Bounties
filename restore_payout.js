const fs = require('fs');
const file = 'app/pages/AdminPayoutsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('resolvingAddress')) {
  // Add state variables
  content = content.replace(
    /const \[txHash, setTxHash\] = useState\(\"\"\);/,
    'const [txHash, setTxHash] = useState("");\n  const [resolvingAddress, setResolvingAddress] = useState(false);\n  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);\n  const [resolvedSource, setResolvedSource] = useState<string | null>(null);\n  const [resolveError, setResolveError] = useState<string | null>(null);'
  );

  // Update openReleaseModal
  content = content.replace(
    /const openReleaseModal = \(alloc: Allocation, bounty: Bounty\) => \{\s+setSelectedAlloc\(alloc\);\s+setSelectedBounty\(bounty\);\s+setTxHash\(\"\"\);\s+\};/,
    `const openReleaseModal = (alloc: Allocation, bounty: Bounty) => {
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
  };`
  );

  // Update closeModal
  content = content.replace(
    /const closeModal = \(\) => \{\s+setSelectedAlloc\(null\);\s+setSelectedBounty\(null\);\s+setTxHash\(\"\"\);\s+\};/,
    `const closeModal = () => {
    setSelectedAlloc(null);
    setSelectedBounty(null);
    setTxHash("");
    setResolvingAddress(false);
    setResolvedAddress(null);
    setResolvedSource(null);
    setResolveError(null);
  };`
  );

  // Update Modal UI
  content = content.replace(
    /<div className=\{styles\.contentValue\} style=\{\{ fontFamily: \"ui-monospace, monospace\", fontSize: 12, wordBreak: \"break-all\" \}\}>\s*\{selectedAlloc\.users\?\.stake_address \|\| \"Address not recorded\"\}\s*<\/div>/,
    `<div className={styles.contentValue} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, wordBreak: "break-all" }}>
                    {resolvingAddress ? (
                      <Shimmer style={{ height: "16px", width: "100%", borderRadius: "4px" }} />
                    ) : resolvedAddress ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ color: "var(--foreground)" }}>{resolvedAddress}</span>
                        {resolvedSource && (
                          <span style={{ fontSize: "10px", color: "var(--muted)", alignSelf: "flex-start", padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--border)" }}>
                            Resolved via {resolvedSource}
                          </span>
                        )}
                      </div>
                    ) : resolveError ? (
                      <span style={{ color: "#dc2626", fontSize: 11, fontWeight: 500 }}>
                        ⚠️ {resolveError}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontStyle: "italic" }}>No payment address resolved</span>
                    )}
                  </div>`
  );

  // Add Shimmer import if not present
  if (!content.includes('Shimmer')) {
    content = content.replace(
      /import \{ authFetch \} from \"@\/lib\/api\";/,
      `import { authFetch } from "@/lib/api";\nimport { AdminTableBodyShimmer, Shimmer } from "@/components/dashboard/ShimmerLoaders";`
    );
  } else if (!content.includes('Shimmer }')) {
    content = content.replace(
      /import \{ AdminTableBodyShimmer \} from \"@\/components\/dashboard\/ShimmerLoaders\";/,
      `import { AdminTableBodyShimmer, Shimmer } from "@/components/dashboard/ShimmerLoaders";`
    );
  }

  // Also replace needs_allocation logic
  content = content.replace(
    /if \(filter === \"needs_allocation\"\) list = list\.filter\(\(b\) => b\.status === \"in_review\" && !b\.winners_finalized\);/,
    `if (filter === "needs_allocation") {
      list = list.filter((b) => {
        if (b.winners_finalized) return false;
        if (b.status === "in_review") return true;
        if (b.status === "open") {
          return (b.submissions ?? []).some((sub) => sub.status === "approved");
        }
        return false;
      });
    }`
  );

  // ADD SORTING STATE
  if (!content.includes('sortCol')) {
    content = content.replace(
      /const \[filter, setFilter\] = useState<.*?>\(\"all\"\);/,
      `const [filter, setFilter] = useState<"all" | "needs_allocation" | "ready_to_pay" | "partially_paid" | "completed">("all");
  const [sortCol, setSortCol] = useState<"title" | "status">("status");
  const [sortDesc, setSortDesc] = useState(true);`
    );

    content = content.replace(
      /return list;\n  \}, \[data, search, filter\]\);/,
      `// Sort the list
    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortCol === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDesc ? -cmp : cmp;
    });

    return list;
  }, [data, search, filter, sortCol, sortDesc]);`
    );

    // Add handleSort and renderSortIndicator
    content = content.replace(
      /const startReview = async/,
      `const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(true);
    }
  };

  const renderSortIndicator = (col: typeof sortCol) => {
    if (sortCol !== col) return null;
    return sortDesc ? "▼" : "▲";
  };

  const startReview = async`
    );

    // Add sortable headers
    content = content.replace(
      /<th><div className=\{styles\.thContent\}>Bounty<\/div><\/th>/,
      `<th data-sortable="true" onClick={() => handleSort("title")} aria-sort={sortCol === "title" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={styles.thContent}>Bounty {renderSortIndicator("title")}</div>
                </th>`
    );
    content = content.replace(
      /<th><div className=\{\`\$\{styles\.thContent\} \$\{styles\.right\}\`\}>Bounty status<\/div><\/th>/,
      `<th data-sortable="true" onClick={() => handleSort("status")} aria-sort={sortCol === "status" ? (sortDesc ? "descending" : "ascending") : "none"}>
                  <div className={\`\${styles.thContent} \${styles.right}\`}>Bounty status {renderSortIndicator("status")}</div>
                </th>`
    );
  }

  fs.writeFileSync(file, content);
  console.log('Restored bugfixes in AdminPayoutsPage.tsx');
} else {
  console.log('Already has resolvingAddress');
}
