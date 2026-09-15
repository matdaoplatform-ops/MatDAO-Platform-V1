# MatDAO Platform

A material science research platform with AI-powered analysis, project tracking, milestone verification, and Web3 integration for IP-NFT minting and milestone-based funding.

## Features

- **AI Studio**: Unified research intelligence analysis combining TRL evaluation, IP valuation, and due diligence
- **Our Ecosystem**: Pyramid-structured leaderboard showing projects by TRL stage
- **Role-Based Access**: Different interfaces for researchers, investors, and staff
- **Project Management**: Track projects, milestones, and funding progress
- **AI Verification**: Automated milestone proof verification with staff approval workflow
- **IP-NFT Minting**: Convert validated research into ERC-721 NFTs with AI scores on-chain
- **Milestone-Based Funding**: Escrow contracts with milestone-based fund releases
- **Web3 Integration**: Full blockchain integration using Wagmi, Ethers.js, and IPFS

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express (for AI engine)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Web3**: Wagmi, Ethers.js, Viem
- **IPFS**: Pinata SDK for metadata storage
- **Smart Contracts**: Solidity ^0.8.20, OpenZeppelin Contracts v5.0.0+
- **Deployment**: Render (backend), Vercel/V0 (frontend)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Pinata account (for IPFS)
- WalletConnect Project ID (optional)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd mat-dao-platform-frontend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Engine Backend
IP_ENGINE_URL=your-backend-url

# Web3 Configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
NEXT_PUBLIC_MATDAO_IPNFT_ADDRESS=your-deployed-ipnft-contract-address
NEXT_PUBLIC_MOCK_USDC_ADDRESS=your-deployed-mockusdc-contract-address
NEXT_PUBLIC_MATDAO_ESCROW_ADDRESS=your-deployed-escrow-contract-address

# Pinata Configuration
PINATA_JWT=your-pinata-jwt-token
PINATA_GATEWAY=your-gateway.mypinata.cloud

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Set up Supabase database — see [Apply DB migration + set env](#apply-db-migration--set-env)

5. Deploy smart contracts (optional for demo)
- Use Hardhat or Foundry to deploy the contracts in the `contracts/` directory
- Update contract addresses in environment variables

6. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The application uses the following tables:

- **profiles**: User profiles with role-based access
- **projects**: Material science projects with detailed descriptions
- **assessments**: AI analysis results (TRL, IP, due diligence)
- **verification_tasks**: Milestone verification submissions
- **submitted_milestones**: User-submitted project milestones

- **notifications**: In-app notifications (staff review queue, researcher decisions)
- **project_reviews**: Audit trail of staff decisions on submissions
- Storage bucket **project-documents** (private; keys are `<user id>/<project id>/<kind>-<file>`)
- View **approved_projects** (security-definer view, readable by anon): approved projects plus the researcher's display name — the only way public pages read project data

See `supabase-schema.sql` (base tables) and `supabase/migrations/0001_platform_fixes.sql` (functions, triggers, RLS policies, extra tables, storage bucket).

## Apply DB migration + set env

Both SQL files are idempotent — re-running them is safe.

1. **Fresh Supabase project**: open the SQL editor and run `supabase-schema.sql`, then `supabase/migrations/0001_platform_fixes.sql`.
2. **Existing project** (already created from the old schema): run only `supabase/migrations/0001_platform_fixes.sql`. It:
   - replaces the recursive RLS policies (`42P17 infinite recursion`) with a `public.is_staff()` helper,
   - installs the `handle_new_user` trigger so every new `auth.users` row gets a `profiles` row (and backfills users that never got one),
   - adds the FK `profiles.id → auth.users(id)` (skipped with a NOTICE if orphan profile rows exist — a cleanup statement is in the file's comments),
   - adds the review workflow columns to `projects` (`status`, `review_notes`, `reviewed_by`, `reviewed_at`, `submitter_email`, `institution`, `working_field`, `documents`, `is_raising`),
   - adds `verification_tasks.submitted_by_id`, the `notifications` and `project_reviews` tables, the `approved_projects` view and the private `project-documents` storage bucket with per-user folder policies,
   - installs BEFORE INSERT/UPDATE triggers so non-staff can never set `role = 'staff'`, self-approve a project (`status`/`phase`/`ip_status`/review columns/funding fields), or set the human-review outcome on verification tasks. AI audit fields on verification tasks are written by the researcher's browser and are shown to staff as *self-reported (unverified)*.
3. **Auth settings** (Authentication → URL configuration): set *Site URL* to your app origin and add `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback` to *Redirect URLs*. Google sign-in uses the PKCE flow and completes on `/auth/callback` client-side.
4. **Environment** — copy `.env.example` (or `.env.local.example` for local dev) and set:

   | Variable | Purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (anon key only — the app never uses the service key) |
   | `NEXT_PUBLIC_APP_URL` | Public origin used in auth redirects, email links and as the domain the Virtual Data Room signature is bound to (must match the origin users browse on; leave unset to bind to the request host) |
   | `RESEND_API_KEY` | Optional. Enables submission / review emails via [Resend](https://resend.com). Without it emails are skipped and logged; in-app notifications still work |
   | `MATDAO_NOTIFY_EMAIL` | Inbox that receives "new submission" emails (review team) |
   | `MATDAO_FROM_EMAIL` | Sender address (default `MatDAO <onboarding@resend.dev>`, fine for testing; verify your domain in Resend for production) |

### Staff role

Staff (reviewer) accounts cannot be self-selected at sign-up. Create the account normally (researcher or investor), then promote it from the SQL editor:

```sql
update public.profiles set role = 'staff' where email = 'reviewer@your-university.edu';
```

A database trigger blocks any other path to `role = 'staff'` (including the client updating its own profile). Staff land on `/tto-portal` (the review queue) after sign-in and see a notification badge in the navbar.

## Smart Contracts

The platform includes three smart contracts in the `contracts/` directory:

- **MockUSDC.sol**: Mock USDC token for testing with faucet function
- **MatDAO_IPNFT.sol**: ERC-721 NFT representing validated research IP
- **MatDAO_Escrow.sol**: Milestone-based escrow contract for funding

### Contract Deployment

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Deploy contracts
npx hardhat compile
npx hardhat deploy --network sepolia
```

## Web3 Features

### IP-NFT Minting
- AI analysis results are uploaded to IPFS as metadata
- ERC-721 NFTs are minted with IPFS metadata containing AI scores
- Available in AI Studio results page for researchers with connected wallets

### Milestone-Based Funding
- Investors can fund projects using MockUSDC
- Funds are held in escrow contracts
- Milestone approval by staff triggers fund release to researchers
- Integrated into project detail pages

## Deployment

### Frontend (Vercel/V0)

1. Push your code to GitHub
2. Import project in Vercel/V0
3. Add environment variables
4. Deploy

### Backend (Render)

1. Push your code to GitHub
2. Create new web service in Render
3. Configure build and start commands
4. Add environment variables
5. Deploy

See `render.yaml` for Render configuration.

### Smart Contracts

Deploy to Sepolia testnet using Hardhat or Foundry. Update contract addresses in environment variables.

## Role-Based Access

- **Researchers**: Can submit projects, run AI analysis, submit milestone verifications, mint IP-NFTs, claim milestone funds
- **Investors**: Can browse projects, fund projects, view ecosystem leaderboard
- **Staff**: Review the submission queue at `/tto-portal` (approve / reject / request changes), approve milestone verifications in `/ai-auditor`, mint IP-NFTs, view all data. Granted only via SQL — see [Staff role](#staff-role)

### Submission → review flow

1. Researcher submits at `/submit` (documents go to the private `project-documents` bucket) → project `status = pending_review`, a `notifications` row for staff is created and, if Resend is configured, `MATDAO_NOTIFY_EMAIL` receives a summary.
2. Staff review at `/tto-portal` with signed document links; each decision writes `projects.status/review_notes/reviewed_by/reviewed_at`, a `project_reviews` row, a notification for the researcher and (optionally) an email to `projects.submitter_email`.
3. Approved projects become publicly readable and show up on `/project` and `/project/<id>`.

## AI Analysis

The AI Studio uses the `matdao-ip-engine` backend to provide:
- TRL Evaluation (NASA/EU scale)
- IP Valuation & FTO Analysis
- Scientific Due Diligence

Configure the backend URL in `IP_ENGINE_URL` environment variable.

## Development

### Project Structure

```
├── app/                    # Next.js app directory
│   ├── ai-studio/          # AI Studio pages
│   ├── our-ecosystem/      # Ecosystem leaderboard
│   ├── project/            # Project marketplace
│   └── profile/            # User profile
├── components/              # React components
│   ├── providers/         # Context providers (Wagmi, Auth)
│   └── project/           # Project-specific components
├── contracts/             # Solidity smart contracts
├── context/                # React context providers
├── lib/                    # Utility libraries
│   ├── supabase/          # Supabase client
│   ├── ipfs/              # IPFS upload utilities
│   ├── web3/              # Web3 hooks and config
│   ├── ai-studio/         # AI studio utilities
│   └── trl-services/      # TRL services
└── public/                 # Static assets
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT
