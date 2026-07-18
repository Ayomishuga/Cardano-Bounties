export const navItems = [
  ["Explore Bounties", "/explore"],
  ["Post Bounty", "/post-bounty"],
  ["Dashboard", "/dashboard"],
  ["How It Works", "/#pricing"],
  ["FAQs", "/#faq"],
];

export const benefits = [
  {
    title: "Wallet-based login",
    text: "No email, no password, no account setup. Your Cardano wallet is your identity on the platform. Connect once and you're in.",
    details: "Cardano Bounties uses CIP-30 (Cardano Improvement Proposal 30) to authenticate your identity directly through your wallet. When you connect, you sign a cryptographic message proving ownership of your stake address. This means you don't need to remember passwords, and your reputation on the platform is directly tied to your on-chain identity.",
    icon: "bolt",
    highlighted: true,
  },
  {
    title: "Real tasks, real rewards",
    text: "Browse open bounties, choose work that matches your skill level, submit your contribution, and earn ADA when approved.",
    details: "Every bounty posted on the platform has its ADA reward locked in a smart contract escrow or verified treasury reserve. When you complete a bounty and the admin approves your submission, the reward is released directly to the wallet you used to sign in. No minimum payout thresholds, no waiting for monthly billing cycles.",
    icon: "list",
  },
  {
    title: "Open to all skill levels",
    text: "Developers, designers, writers, researchers, and curious newcomers can all find meaningful work across the ecosystem.",
    details: "The Cardano ecosystem needs diverse skills to thrive. While there are highly technical Plutus and Aiken bounties, you'll also find tasks for graphic design, UI/UX, translating documentation, organizing local meetups, and writing articles. If you want to contribute to the ecosystem, there's a bounty here for you.",
    icon: "globe",
  },
];

export const features = [
  {
    title: "Code & Smart Contracts",
    text: "Build tools, fix bugs, write Plutus scripts, develop SDKs, and contribute to open source Cardano infrastructure.",
    type: "tasks",
  },
  {
    title: "Design & UI/UX",
    text: "Create interfaces, design assets, and improve user experience for Cardano apps and community platforms.",
    type: "time",
  },
  {
    title: "Content & Documentation",
    text: "Write guides, tutorials, explainers, and technical docs that help the Cardano community learn and grow.",
    type: "integrations",
  },
  {
    title: "Community & Research",
    text: "Research protocols, analyze data, moderate forums, run events, translate content, and onboard newcomers.",
    type: "collaboration",
  },
  {
    title: "Hackathons & Events",
    text: "Participate in global Cardano hackathons, build innovative dApps, compete for major ADA prize pools, and win team bounties.",
    type: "hackathons",
  },
];

export const plans = [
  {
    name: "01",
    intro: "Visit Cardano Bounties and connect Nami, Eternl, Lace, or any CIP-30 compatible wallet.",
    price: "Connect your wallet",
    features: [
      "No email or password required.",
      "Your wallet becomes your account.",
      "Free to participate.",
      "Built for Cardano contributors.",
    ],
  },
  {
    name: "02",
    intro: "Explore open bounties across categories. Filter by type, difficulty, or reward size.",
    price: "Browse and claim a bounty",
    action: "Explore Bounties",
    link: "/explore",
    featured: true,
    features: [
      "Code, design, content, and research.",
      "Beginner-friendly options.",
      "Clear briefs and reward amounts.",
      "Opt in when the work fits.",
    ],
  },
  {
    name: "03",
    intro: "Complete the task and submit your work for review. Approved submissions are paid directly in ADA.",
    price: "Submit your work and earn ADA",
    features: [
      "Admin-reviewed submissions.",
      "ADA rewards paid on-chain.",
      "No invoices or middlemen.",
      "Learn while contributing.",
    ],
  },
];

export const testimonials = [
  ["Code", "Smart contracts", "Build tools, fix bugs, write Plutus scripts, and contribute to Cardano infrastructure."],
  ["Design", "UI/UX", "Create interfaces, design assets, and improve product experiences across the ecosystem."],
  ["Docs", "Content", "Write guides, tutorials, explainers, and technical documentation for the community."],
  ["Research", "Analysis", "Investigate on-chain data, benchmark protocols, and surface useful ecosystem insights."],
  ["Community", "Onboarding", "Moderate forums, run events, translate content, and help newcomers find their footing."],
  ["Security", "Audits", "Review contracts and protocols for vulnerabilities through high-value expert bounties."],
];

export const faqs = [
  ["Do I need to pay to participate?", "No. Participation in Cardano Bounties is completely free. You just connect with your Cardano native wallet (e.g., Vespr or Eternl)."],
  ["Who can take part in bounties?", "Anyone can participate. Students, beginners, and professionals. If you can deliver value, you’re welcome."],
  ["Do I need prior experience in Cardano?", "Not necessarily. Most bounties are beginner-friendly, while others may require technical or ecosystem knowledge."],
  ["Can I work on multiple bounties at once?", "Yes, as long as you can meet the requirements and deadlines for each."],
  ["How do I apply for a bounty?", "Each bounty listing will specify its own application process. Follow the instructions provided on the listing."],
  ["What happens if multiple people submit for the same bounty?", "The best submission will be selected based on quality, relevance, and completeness. Some bounties may reward multiple contributors if stated."],
  ["How are submissions reviewed?", "Submissions are evaluated based on quality, clarity, originality, alignment with requirements, and completeness."],
  ["How long does it take to receive rewards?", "Reviews typically happen within 3 days. Once approved, rewards are processed shortly after."],
  ["What kind of rewards can I earn?", "You will be rewarded with $ADA, the ecosystem token. You will also gain recognition and visibility within the community."],
  ["What happens if my submission is not selected?", "You won’t receive a reward for that bounty, but you are encouraged to improve your submission, try other bounties, and learn from feedback."],
  ["Can I collaborate with others on a bounty?", "Yes, if collaboration is allowed for that specific bounty. Make sure roles and contributions are clearly defined."],
  ["Is plagiarism allowed?", "No. All submissions must be original. Plagiarized work will be disqualified."],
  ["Can bounties change over time?", "Yes. Since this is an evolving initiative, bounty structures, rewards, and processes may improve over time."],
  ["Why is Cardano Bounties described as an experiment?", "It's an ongoing experiment to explore how contribution-based incentives can grow the ecosystem. We iterate based on real participation."],
  ["How can I stay updated?", "Follow our official channels and join the community to get updates on new bounties and opportunities."],
];

export const liveBounties = [
  {
    title: "Build a Plutus V3 Smart Contract",
    reward: "5,000 ADA",
    tags: ["Development", "Plutus", "High Priority"],
    description: "We are looking for an experienced Plutus developer to build and audit a V3 smart contract for our new decentralized exchange protocol.",
    link: "#"
  },
  {
    title: "Redesign Landing Page UI",
    reward: "1,200 ADA",
    tags: ["Design", "UI/UX", "Figma"],
    description: "Help us revamp our project's landing page to improve conversion rates. We need a modern, clean, and responsive Figma prototype.",
    link: "#"
  },
  {
    title: "Write Technical Documentation",
    reward: "800 ADA",
    tags: ["Content", "Documentation"],
    description: "Create comprehensive developer documentation and API guides for our newly released Cardano SDK.",
    link: "#"
  }
];
