# Cardano Bounties

An open, on-chain bounty platform connecting Cardano projects with contributors: built in public, funded in ADA.

Cardano Bounties is a decentralized task marketplace for the Cardano ecosystem. Projects and teams post scoped work items (bounties) with ADA rewards; developers, designers, writers, and community contributors can explore, claim, and submit work, all verified through Cardano wallet authentication with no platform account required.

---

## ✨ Overview

The Cardano ecosystem is growing fast, and community members need a structured, accessible way to contribute and get paid for their work. Cardano Bounties bridges this gap by providing:

- **For Projects & Contributors:** A shared, lightweight dashboard (Project Workspace) to post bounties, track submissions, and manage user settings.
- **For Admins:** An operations panel to review pending bounty approvals, verify final submissions, and manage payouts and refunds.
- **For the Ecosystem:** Transparent accountability for contribution work, building a verifiable contributor reputation over time.

---

## 🚀 Features

### Public Landing Page
- Animated hero section with a live preview of open bounties.
- Metrics summary including total ADA rewarded, open bounties, and active contributors.
- A step-by-step contribution flow explanation.
- Waitlist form for early access sign-up.

### Explore Bounties
- Real-time bounty grid with search and category filters.
- Paginated results with skeleton loading states.
- Per-bounty summary cards showing project identity, reward, deadline, and type.
- Responsive layout across mobile, tablet, and desktop.

### Bounty Details Page
- Detailed breakdown of requirements and instructions.
- Contribution submission form, gated behind wallet authentication.
- Live contributor table showing submissions and their review status.

### Wallet Authentication
- Native Cardano wallet connection (no username/password required).
- Challenge-response verification: secure cryptographic signing to establish identity.
- Stateless authentication on protected API calls.
- Supports major Cardano wallets like Eternl, Nami, Vespr, and Flint.

### Unified Dashboard System
Access to the dashboard is gated by your wallet role. There are two primary views:

#### 💼 Project Workspace (All Users / Contributors / Projects)
Every standard wallet gains access to this shared workspace:
- **Overview:** Track key metrics for your posted bounties and submitted work.
- **Post Bounty:** Create new bounty listings with detailed requirements and reward parameters.
- **Reviews:** Review contributor submissions for bounties you've created.
- **Profile Settings:** Customize your display name and bio details linked to your Cardano stake key.

#### 🛡️ Admin Operations Workspace (Admin Wallets)
Gated for configured admin wallets:
- **Approvals:** Review escrow-funded bounty posts before they go live.
- **Submissions:** Finalize admin review on poster-approved submissions.
- **Payouts & Refunds:** Process treasury payout transactions and candidate refunds.
- **System Metrics:** Monitor overall platform activity, dispute records, and treasury exposure.

### Notifications
- Real-time notification bell in the site header.
- Status update notifications for submissions (approved, rejected, or pending review).

---

## 🏗️ Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript
- **Styling:** Vanilla CSS with custom properties
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Cardano Integration:** MeshSDK, Blockfrost
- **Email Delivery:** Resend
- **State & Forms:** React Hook Form, Zod, TanStack Query

---

## ⚙️ Getting Started

### Prerequisites

- Node.js v18 or higher
- A Supabase project
- A Blockfrost API key
- A Resend API key

### 1. Clone the repository

```bash
git clone https://github.com/Ayomishuga/Cardano-Bounties.git
cd Cardano-Bounties
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

BLOCKFROST_PREPROD_PROJECT_ID=your-blockfrost-id
JWT_SECRET=your-jwt-secret

NEXT_PUBLIC_STORAGE_WALLET_KEY=cardano-bounties-wallet-id
NEXT_PUBLIC_STORAGE_TOKEN_KEY=cb_token

ADMIN_EMAIL=admin@email.com
NEXT_PUBLIC_ADMIN_EMAIL=admin@email.com
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 🌐 Community & Links

- **X (Twitter):** [@cardanobounties](https://x.com/cardanobounties)
- **Discord:** [Join our server](https://discord.gg/rbQ97RaNw)
- **YouTube:** [@cardanobounties](https://youtube.com/@cardanobounties)
- **GitHub:** [Ayomishuga/Cardano-Bounties](https://github.com/Ayomishuga/Cardano-Bounties)

---

## 📄 License

This project is open source. See the LICENSE file for details.

Built with ❤️ by [TechKR](https://x.com/TechKr_Team) and [Gimbalabs](https://gimbalabs.com).
