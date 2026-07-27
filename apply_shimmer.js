const fs = require("fs");
const path = require("path");

const pages = [
  "AdminApprovalsPage.tsx",
  "AdminBountiesPage.tsx",
  "AdminHuntersPage.tsx",
  "AdminPayoutsPage.tsx",
  "AdminPostersPage.tsx",
  "AdminRefundsPage.tsx",
  "AdminSubmissionsPage.tsx",
  "AdminTreasuryPage.tsx",
  "ContributorContributionsPage.tsx",
  "PosterBountiesPage.tsx"
];

for (const page of pages) {
  const filePath = path.join("app", "pages", page);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${page} (not found)`);
    continue;
  }
  
  let content = fs.readFileSync(filePath, "utf8");
  
  // Find column count
  const thCount = (content.match(/<th/g) || []).length || 6;
  
  // Replace map array
  const pattern = /Array\.from\(\{\s*length:\s*\d+\s*\}\)\.map\(\(\_,\s*[a-zA-Z]+\)\s*=>\s*\(\s*<tr[\s\S]*?<\/tr>\s*\)\s*\)/g;
  
  if (pattern.test(content)) {
    content = content.replace(pattern, `<AdminTableBodyShimmer columns={${thCount}} rows={5} />`);
    
    if (!content.includes("AdminTableBodyShimmer")) {
      console.log(`Failed to inject import for ${page}`);
    } else if (!content.includes('import { AdminTableBodyShimmer }')) {
      content = content.replace(/(^import .*?;\r?\n)(?!import )/m, `$1import { AdminTableBodyShimmer } from "@/components/dashboard/ShimmerLoaders";\n`);
    }
    
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Updated ${page} with ${thCount} columns`);
  } else {
    console.log(`Pattern not matched in ${page}`);
  }
}
