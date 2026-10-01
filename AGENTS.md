<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know (Next.js 16 cheat-sheet)

This project runs Next.js 16, which has breaking changes vs. what's in your training data. The full upgrade guide lives at `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (~3.8MB across the whole `docs/` tree) — **don't read it wholesale**; the facts below are already extracted from it and confirmed against this repo's actual code. Only fall back to the real docs for something not covered here.

**Already true in this repo (no action needed):**
- Turbopack is the default bundler for `dev`/`build` — no `--turbopack` flag needed.
- `eslint.config.mjs` (flat config) is already in place; `package.json`'s `lint` script calls `eslint` directly, not the removed `next lint`.
- `next.config.ts` uses `images.remotePatterns` (not the deprecated `images.domains`).
- No `middleware.ts`/`proxy.ts` exists — nothing to rename.
- No dynamic route segments (`[param]`) exist yet, so the async `params`/`searchParams` breaking change doesn't currently apply.

**Breaking changes to apply *if* you touch these areas:**
- If you add a dynamic route or use `params`/`searchParams`/`cookies()`/`headers()`/`draftMode()`: they are now **fully async** (`await params`, etc.) — no synchronous fallback exists anymore.
- If you add `middleware.ts`: rename the file (and its exported function) to `proxy.ts` / `proxy`. `edge` runtime is not supported there.
- If you call `revalidateTag('key')`: it now requires a second `cacheLife` profile argument, e.g. `revalidateTag('key', 'max')`.
- If you import `unstable_cacheLife`/`unstable_cacheTag`: use the now-stable `cacheLife`/`cacheTag` (no prefix).
- Parallel route slots (`@slot`) now require an explicit `default.js`/`default.tsx`, or the build fails.

**Important local quirk:** `next.config.ts` still sets `typescript: { ignoreBuildErrors: true }`, but now only for two known files (see §8). `npm run build` therefore still succeeds with type errors in those — run `npx tsc --noEmit` for real signal.
<!-- END:nextjs-agent-rules -->

# Bhumisaara Frontend — Developer & AI Agent Guidelines

Welcome to the **Bhumisaara** Web2.5 Agrarian Management Platform codebase. This repository provides a multi-role national fertilizer distribution, inventory tracking, and tokenized batch management system for Sri Lanka's agricultural ecosystem.

---

## 1. Tech Stack Overview

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4, Base UI (`@base-ui/react`), `class-variance-authority` (cva), Lucide Icons (`lucide-react`)
- **Blockchain / Web3**: thirdweb SDK v5 (`thirdweb`), Polygon Amoy Testnet (`polygonAmoy`), ERC-1155 Token standard
- **QR**: `html5-qrcode` for camera scanning (sack serials, officer wallets), `qrcode.react` (`QRCodeSVG`) for printed sack labels
- **State & Context**: React Context (`AuthContext.tsx`) for session & role management
- **Forms & Validation**: Formik + Yup
- **API & HTTP Client**: Axios (`axiosInstance.ts`) connected to a Spring Boot REST API (`http://localhost:8080/api/v1`)
- **UI Components & Feedback**: shadcn/ui components (`components/ui/`), Sonner Toast notifications (`sonner`)

---

## 2. Directory & Architecture Layout

```
bhumisaara-frontend/
├── app/                        # Next.js App Router Pages & Layouts
│   ├── (ui)/                   # Authenticated UI Route Group
│   │   ├── application-form/   # Farmer: submit a fertilizer subsidy application
│   │   ├── applications-history/ # Role switchboard: farmer sees own applications, officer sees their whole area
│   │   ├── dashboard/          # Dynamic Role-based Dashboard Router
│   │   ├── distribution-level/ # Government Distribution Overview
│   │   ├── handover/           # Officer: dispense to a farmer (3-stage scan + burn)
│   │   ├── import-history/     # National Import History Ledger
│   │   ├── inventory/          # Agro-Dealer Stock Management
│   │   ├── officer-assign/     # Government: assign officers to areas
│   │   ├── officer-distribution/ # Government: transfer sacks to the area's officer (3-stage scan flow)
│   │   ├── own-distribution/   # Agrarian Officer Local Distribution
│   │   ├── request-approvals/  # Officer: review farmer fertilizer requests
│   │   ├── sack-labels/        # Government: printable QR label sheet for a batch's sacks
│   │   ├── marketplace/        # Farmer: browse listings, spend subsidy credits
│   │   ├── my-orders/          # Farmer: confirm collection (the only step that moves credits)
│   │   ├── credit-balance/     # Farmer: credit position + issuance history
│   │   ├── inventory/          # Seller: listings management (both seller roles)
│   │   ├── incoming-orders/    # Seller: mark goods ready
│   │   ├── redemption/         # Seller: claim + burn to settle
│   │   ├── credit-issuance/    # Government: mint a season's subsidy budget
│   │   ├── redemption-claims/  # Government: claims queue with on-chain verification
│   │   ├── credit-oversight/   # Government: reconciliation & seller anomaly flags
│   │   └── profile/            # User Profile Settings
│   ├── auth/                   # Authentication Pages (Login/Register)
│   ├── globals.css             # Tailwind v4 Global CSS & Design System
│   └── layout.tsx              # Root App Layout with Auth & Thirdweb Providers
├── components/                 # Role-Specific & UI Components
│   ├── agrarian-officer/       # Agrarian Officer Dashboard & Forms
│   ├── farmer/                 # Farmer Portal Views
│   ├── goverment/              # Government Administrator Dashboard & Minting Forms
│   ├── landing/                # Public Landing Page Components
│   ├── organic-producer/       # Organic Producer profile + dashboard wrapper
│   ├── private-dealer/         # Agro-Dealer profile + dashboard wrapper
│   ├── seller/                 # SHARED by both seller roles — don't fork per role
│   │   ├── SellerListings.tsx  # Listings CRUD (isOrganic is server-derived)
│   │   ├── SellerOrders.tsx    # Incoming orders; "mark ready" is the only action
│   │   ├── SellerRedemption.tsx # Claim, then burn from the seller's own wallet
│   │   └── SellerDashboard.tsx # Storefront figures, all from real endpoints
│   ├── ui/                     # Shared Reusable Primitives (Button, Badge, Table, table-states, etc.)
│   ├── ProfileDetailsForm.tsx  # The one profile form, shared by every role
│   ├── RequestStatusBadge.tsx  # The one fertilizer-request status pill
│   └── WalletAssets.tsx        # On-chain batch tokens held by the connected wallet
├── context/                    # React Contexts (AuthContext.tsx)
├── hooks/                      # Shared React Hooks — one per backend resource
│   ├── use-api-resource.ts     # The shared GET wrapper: {data,isLoading,error,refetch}
│   ├── use-area-demand.ts      # Government: outstanding demand per area
│   ├── use-batch-sacks.ts      # Sacks of one batch (label sheet, scan validation)
│   ├── use-batches.ts          # Registered fertilizer batches
│   ├── use-distribution-levels.ts # Batches + area demand + transfer ledger, aggregated
│   ├── use-distributions.ts    # Officer / farmer / national handover history
│   ├── use-fertilizer-requests.ts # Farmer's own, officer's pending, officer's area
│   ├── use-officer-profile.ts  # The officer's own profile + the sacks they hold
│   ├── use-pending-collections.ts # Farmers awaiting collection in the officer's area
│   ├── use-transfers.ts        # Admin → officer transfer ledger
│   ├── use-minted-batches.ts   # On-chain NFTs joined with backend batch metadata
│   ├── use-my-profile.ts       # The signed-in user's own account + profile details
│   ├── use-credits.ts          # Seasons, eligible farmers, issuances, balance, reconciliation
│   │                           #   + useOnChainCreditBalance (the real balanceOf read)
│   ├── use-listings.ts         # Marketplace browse (with filters) + the seller's own
│   ├── use-orders.ts           # Farmer / seller / national order lists
│   ├── use-redemption-claims.ts # Seller's own, the review queue, the full ledger
│   └── use-mobile.ts           # Mobile Breakpoint Detection
├── lib/                        # Core Utilities & Thirdweb Setup
│   ├── contract.ts             # Thirdweb Contract Instance (ERC-1155)
│   ├── distribution.ts         # Shared batch/sack/demand/transfer/handover DTO shapes
│   ├── navigation.ts           # Navigation Registry & Role Permission Mapping
│   ├── thirdwebClient.ts       # Thirdweb Client Instance
│   └── utils.ts                # Tailwind Class Merger Utility (`cn`)
├── utils/                      # Extended Utilities
│   ├── apiError.ts             # describeApiError — backend message first
│   ├── apiPaths.ts             # Centralized API Endpoint Map (version lives in the base URL)
│   ├── formatters.ts           # kg / tonnes / date / address / hash formatting
│   └── axiosInstance.ts        # Configured Axios Instance with Auth Interceptors
└── AGENTS.md                   # Repository Rules & Conventions for AI Agents
```

---

## 3. Role-Based Permission Architecture

The application supports **6 User Roles**:
1. `SYSTEM_ADMIN`
2. `GOVERNMENT_ADMIN`
3. `AGRARIAN_SERVICE_OFFICER`
4. `FARMER`
5. `PRIVATE_AGRO_DEALER`
6. `ORGANIC_FERTILIZER_PRODUCER`

### Navigation & Access Rules
- Navigation items are registered in `@/lib/navigation.ts`.
- Use `getNavItemsForRole(userRole)` to compute authorized navigation items for sidebar/header.
- Role checks are performed via `useAuth()` hook from `@/context/AuthContext`.

---

## 4. Web3 & Blockchain (thirdweb SDK v5)

- **Network**: Polygon Amoy Testnet (`polygonAmoy` from `thirdweb/chains`)
- **Contract Type**: ERC-1155 Multi-Token Standard (`thirdweb/extensions/erc1155`)
- **Contract Reference**: Exported from `@/lib/contract` using `process.env.NEXT_PUBLIC_CONTRACT_ADDRESS`.

### Token Minting & Metadata Sync Flow (Web2.5 Hybrid Model)
When minting fertilizer import batches (e.g. `MintBatchForm.tsx`):
1. **Initiate Minting**: Use `useSendTransaction` with `mintTo` extension from `thirdweb/extensions/erc1155`.
2. **Await Confirmation**: Use `waitForReceipt` from `thirdweb` to retrieve the confirmed transaction receipt.
3. **Parse Token ID**: Extract the numeric `tokenId` from the first 32 bytes of the `TransferSingle` log `data` payload:
   - Event signature: `0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62`
   - Must be parsed as a valid 32-bit integer (`0`, `1`, `2`...) so Spring Boot backend Jackson deserialization succeeds.
4. **Backend Sync**: Execute `axiosInstance.post(apiPaths.batches.save, payload)` with:
   ```json
   {
     "tokenId": 1,
     "transactionHash": "0x...",
     "importerName": "Lanka Agri PLC",
     "fertilizerType": "Urea",
     "volumeKg": 50000,
     "mintedByUserId": 1
   }
   ```
> Saving a batch also generates its 50kg sacks server-side — nothing extra to
> call after a mint. Their QR labels print from `/sack-labels`.

### Admin → Officer Transfer Flow (`OfficerDistribution.tsx`)
Same chain-then-backend shape as minting, with `safeTransferFrom`:
1. **Guard first**: read the admin's on-chain stock with `balanceOf` (`useReadContract`) and block a transfer larger than the wallet actually holds.
2. **Snapshot before signing**: copy `{ batchId, tokenId, toOfficerId, amountKg, sackSerials }` into a `useRef` *before* `sendTransaction`. The form stays editable while the wallet dialog is open, and the backend must be told what was really moved. `HandoverForm.tsx` does the same.
3. **Send & confirm**: `safeTransferFrom({ contract, from: account.address, to: officerWallet, tokenId, value: BigInt(totalKg), data: "0x" })` → `waitForReceipt`.
4. **Record**: `axiosInstance.post(apiPaths.transfers.record, …)` with the snapshot plus the confirmed hash.
5. **Never swallow a confirmed hash**: if step 4 fails the tokens have already moved, so the error toast carries the transaction hash with `duration: Infinity` and tells the admin to record it manually.

### Officer → Farmer Handover Flow (`components/agrarian-officer/HandoverForm.tsx`, route `/handover`)
**The farmer never receives a token.** The officer burns from their own balance
and the farmer is the recipient of record in Postgres — one transaction, no
transfer step. Do not add one.
1. Pick the farmer from `GET /api/v1/distributions/pending` (the officer's own area only).
2. Pick a batch from `getOwnedNFTs` — **not** `getNFTs`, which lists every token on the contract regardless of holder — intersected with `GET /api/batches` for the type and batch id.
3. Every scan goes to `POST /api/v1/distributions/validate-sack`; the backend's message is the toast body, because only the server knows if a sack was already spent. Scanning is serialised while a validation is in flight, or two scans would send the same `alreadyScannedKg`.
4. Confirm the farmer's wallet against `farmerWallet`, then `burn({ contract, account: account.address, id, value })` → `waitForReceipt` → `POST /api/v1/distributions`, with the payload snapshotted into a `useRef` before signing and the hash surfaced (`duration: Infinity`) if the backend write fails.

### Subsidy credits vs stock tokens — read before touching token code
The ERC-1155 contract carries **two kinds of token** and they must never be
confused. Shapes for each live in a separate file on purpose:

| | STOCK | SUBSIDY CREDIT |
|---|---|---|
| Types in | `@/lib/distribution.ts` | `@/lib/marketplace.ts` |
| Backed by | fertilizer in a warehouse | the treasury |
| 1 token buys | — (it *is* 1 kg of stock) | 1 kg chemical, **or 1.5 kg organic** |
| Minted by | `MintBatchForm` (government) | `CreditIssuance` (government) |
| Burned by | `HandoverForm` (officer, at collection) | `SellerRedemption` (seller, at settlement) |

Label them distinctly in every UI. A batch renders as `TK-{id}`; a credit always
carries the word "Credit" (`Credit · TK-{id}`).

**The organic 1.5× rate.** `creditsRequired` / `kgCoveredByCredits` in
`@/lib/marketplace.ts` mirror the backend's `CreditMath` exactly, using the same
integer arithmetic. They exist **only** to render a live preview while the
farmer types — the server re-derives every figure on `POST /orders`, and
`GET /orders/quote` returns the binding costing. Never treat the client total as
authoritative.

**Credit token ids are per-season.** A season's first issuance creates the token
with `mintTo` (season baked into the NFT metadata); every later issuance uses
`mintAdditionalSupplyTo` against that same id, which is what keeps a season's
credits fungible between farmers. `CreditIssuance.tsx` picks between the two by
looking the season up in `useCreditIssuances()`.

**On-chain balances are read client-side.** The backend has no web3 client, so
`GET /api/v1/credits/balance` returns the *Postgres ledger* position plus the
season token ids. `useOnChainCreditBalance` (in `@/hooks/use-credits.ts`) reads
the real `balanceOf`. Screens show **both** and say so when they diverge — a gap
means credits moved off-platform, which is information, not a bug to hide.

### Marketplace order flow (the anti-fraud path)
`Marketplace.tsx` → `MyOrders.tsx` (farmer) and `SellerOrders.tsx` (seller).
1. The farmer places an order. **No chain interaction** — it only reserves stock.
2. The seller marks goods ready (`PATCH /orders/{id}/ready`). This is the **only**
   action a seller has; there is no "complete" button because the API has no such
   endpoint for them. `SellerOrders.tsx` says so on screen rather than leaving a
   seller hunting for it.
3. At handover the **farmer** confirms from `MyOrders.tsx`: `safeTransferFrom`
   from their own wallet to the seller's → `waitForReceipt` →
   `POST /orders/{id}/confirm` with the hash. Payload snapshotted into a `useRef`
   before signing, and the hash surfaced with `duration: Infinity` if the backend
   write fails — same contract as every other chain flow here.
4. A cash-only order (`creditsUsed === 0`) skips the chain entirely and confirms
   with a null hash.

### Seller redemption is two steps, deliberately
The government **approves** a claim; the **seller** burns. An ERC-1155 balance is
destroyable only by its holder, and the credits sit in the seller's wallet — an
admin genuinely cannot burn them. `SellerRedemption.tsx` reads `balanceOf` across
the claim's `creditTokenIds` to find a token with enough balance before burning,
because a seller may hold credits from several seasons.

### QR scanning
`components/goverment/QrScanner.tsx` exports `QrScanner` (camera) and `ScanField` (camera + manual text fallback side by side). Reuse `ScanField` rather than wiring `html5-qrcode` again:
- the library is `import()`-ed inside the effect — importing it at module scope breaks the server render;
- a held-still QR decodes ~10x a second, so `ScanField` drops repeats of the same text within 2s; without that the same code floods the handler;
- every scanner needs its own unique `scannerId` (it's a DOM id the video mounts into).

---

## 5. Backend REST API Integration

- **Axios Client**: Always import `@/utils/axiosInstance` for API requests.
- **Endpoint Registry**: Use `@/utils/apiPaths` for API path constants. The version lives in the base URL — `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1`, matching the backend's `server.servlet.context-path` — so entries are plain (`/batches`, `/auth/login`) and never repeat `/api` or `/v1`.
- **Fetching**: don't hand-roll `useState` + `useEffect` + `try/catch`. Use the resource hooks in `hooks/` (`useBatches`, `useAreaDemand`, `usePendingCollections`, `useOfficerDistributions`, `useFarmerDistributions`, `useMyFertilizerRequests`, …). They wrap `useApiResource`, which is built on the `@tanstack/react-query` that `use-minted-batches.ts` already used, and return `{ data, isLoading, error, refetch }`. For a new endpoint, add a hook rather than fetching inline.
- **Errors**: `describeApiError(error, fallback)` from `@/utils/apiError` — it prefers the backend's `ErrorResponse.message`, which names the sack or quota that failed.
- **Formatting**: `@/utils/formatters` — `formatKg`, `formatTonnes`, `formatDate`, `formatDateTime`, `truncateAddress`, `truncateHash`. Don't re-declare these per component.
- **Table states**: `TableSkeletonRows`, `TableEmptyState`, `TableErrorState` from `@/components/ui/table-states` — the skeleton's `columns` must match the real header count.
- **Status pills**: `@/components/ui/badge`. `success` / `warning` / `info` carry explicit light/dark pairs because the palette has no token for them; everything else uses semantic tokens.
- **JWT Authorization**: `axiosInstance` automatically attaches `Authorization: Bearer <token>` from `localStorage`.
- **401 Interception**: Clears local storage session on authentication expiration.

---

## 6. UI & Design System Conventions

- **Theme & Colors**: Primary design tokens are defined in `@/app/globals.css`.
- **Button Styling**: Always prefer the project's native `<Button>` component (`components/ui/button.tsx`) or `buttonVariants({ variant: "default" })` over thirdweb's default styled components to maintain visual consistency.
- **Form Feedback**: Use `sonner` (`toast.success()`, `toast.error()`, `toast.loading()`) for user alerts.
- **Typography & Icons**: Use `lucide-react` icons and Tailwind typography variables.

---

## 7. Useful Terminal Commands

```bash
# Start local dev server (http://localhost:3000)
npm run dev

# Run ESLint validation
npm run lint

# Type-check without emitting (build succeeds even with type errors — see §8)
npx tsc --noEmit

# Build production distribution
npm run build
```

---

## 8. Known Constraints & Pointers (check here before searching)

Read this before grepping the repo for the same answers — it saves a round-trip.

- **Canonical sources, don't recreate deprecated ones:**
  - API calls → `@/utils/axiosInstance`. API paths → `@/utils/apiPaths`. (`lib/api.ts` and `lib/api-paths.ts` were removed — do not recreate them.)
  - `components/ui/` primitives use **lowercase** filenames (`button.tsx`, `sidebar.tsx`, `sonner.tsx` — shadcn convention). The old PascalCase versions (`Button.tsx`, `Sidebar.tsx`, `Sonner.tsx`) were deleted; don't reintroduce that casing.
  - On-chain NFT data + backend batch metadata are joined once in `@/hooks/use-minted-batches.ts` (its `records` return value). Reuse it instead of re-joining `getNFTs()` output with backend data inside a component.
  - Batch / sack / area-demand / transfer / handover DTO shapes live in `@/lib/distribution.ts` — import the types, don't redeclare them per component.
  - The signed-in user's own account is `@/hooks/use-my-profile.ts`, and the profile form itself is `@/components/ProfileDetailsForm.tsx` — every role's profile screen renders that one component with different labels. Don't fork it per role; the three fields (full name, address, contact number) are the same everywhere. The farmer's Service Area section stays separate because it writes to its own endpoint.
  - **No file uploads exist.** Nothing on the backend stores a photo or document, so the profile screens deliberately show no upload control — an input that silently discards a file is worse than none.
  - The fertilizer-request status pill is `@/components/RequestStatusBadge.tsx`. It was duplicated verbatim in the farmer and officer history screens; adding a `RequestStatus` meant editing both. Don't fork it again.
  - The national distribution figures (totals, per-type, per-district, per-area, recent transfers) are fetched and aggregated once in `@/hooks/use-distribution-levels.ts`. `DistributionLevel.tsx` is purely presentational on top of it. Every number it renders comes from `GET /api/batches`, `GET /api/v1/transfers/demand` or `GET /api/v1/transfers` — if a metric has no endpoint behind it (farmer collections, dealer stock, warehouse capacity), it is **not** on the screen rather than mocked.
  - `fertilizer_batches.volume_kg` is mint volume **less farmer collections** — transfers to officers deliberately don't consume it. Label it "stock on record", never "total imports".
- **No automated test suite exists** in this repo (no Jest/Vitest config, no `*.test.*`/`*.spec.*` files). Don't spend time hunting for one.
  - Subsidy credit / marketplace DTO shapes live in `@/lib/marketplace.ts`, the companion to `@/lib/distribution.ts`. Import the types; don't redeclare them per component. The two files are separate **because the two token types are separate** — see §4.
  - **Both seller roles share one set of components**, in `components/seller/`: `SellerListings`, `SellerOrders`, `SellerRedemption`, `SellerDashboard`. `components/private-dealer/DealerDashboard.tsx` and `components/organic-producer/OrganicProducerDashboard.tsx` are now thin wrappers so the `/dashboard` switchboard keeps resolving per role. Don't fork these per role: the only difference between a dealer and a producer is `isOrganic`, which the **server** sets from the caller's role, and two copies would be two chances to let a dealer sell "organic" at 1.5kg per credit.
- **Known pre-existing issues, unrelated to typical feature work — don't fix opportunistically, only if the user asks:**
  - `components/DotGrid.tsx` has 43 implicit-`any`/untyped-ref TS errors. It **is** used — it draws the auth page background — so don't delete it.
  - `components/DotGrid.tsx` is now the **only** reason `next.config.ts` still sets `typescript.ignoreBuildErrors`; `npx tsc --noEmit` is clean once it's excluded. Fix it and the flag can go.
  - `components/private-dealer/DealerInventory.tsx` (the other former offender) **was deleted**: it was a static mock-up of stock the backend never stored, and `/inventory` now renders the real `components/seller/SellerListings.tsx`. `components/chart-area.tsx` is unreferenced since the dealer dashboard was rewritten, but was left in place as a generic primitive.
- **Required env vars** (see `.env.development`): `NEXT_PUBLIC_API_URL` (Spring Boot backend base URL), `NEXT_PUBLIC_CONTRACT_ADDRESS` (ERC-1155 contract), `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`.
- **Dev/preview server**: `.claude/launch.json` runs `npm run dev` on port 3000 for browser-based preview tools.
- **Don't read/grep in full**: `node_modules/`, `.next/`, `package-lock.json`. If you need one specific package's behavior, target that package's file directly rather than searching the whole tree.
