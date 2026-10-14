# Bhumisaara Frontend

The web application for Bhumisaara, a fertilizer distribution and subsidy management platform for Sri Lanka. It provides role-based dashboards, QR-assisted stock handovers, a fertilizer marketplace, and wallet interactions on Polygon Amoy.

This repository contains the Next.js application. It connects to the separately run Bhumisaara Spring Boot API for authentication and operational records, and to an ERC-1155 contract through thirdweb for token transactions.

## Technology

| Area | Tools |
| --- | --- |
| Application | Next.js 16.2.9, React 19, TypeScript, App Router |
| Styling and components | Tailwind CSS 4, Base UI/shadcn, Lucide, Sonner, next-themes |
| Forms | Formik and Yup |
| API and data | Axios, TanStack Query, TanStack Table |
| Blockchain | thirdweb SDK 5, ERC-1155, Polygon Amoy |
| QR scanning and labels | html5-qrcode, qrcode.react |
| Reporting | Recharts, jsPDF |

## Screens and roles

| Role | Main screens |
| --- | --- |
| `SYSTEM_ADMIN` | Platform health, users, areas and coverage, wallet status, audit logs |
| `GOVERNMENT_ADMIN` | Batch minting, import history, sack labels, officer assignments, distribution, credit issuance, redemption review |
| `AGRARIAN_SERVICE_OFFICER` | Area applications, review queue, fertilizer handover, handover history |
| `FARMER` | Applications, collection history, marketplace, orders, credit balance |
| `PRIVATE_AGRO_DEALER` | Listings, incoming orders, redemption |
| `ORGANIC_FERTILIZER_PRODUCER` | Listings, incoming orders, redemption with the organic credit conversion |

The dashboard selects its content from the signed-in user's role. Both seller roles share the components in `components/seller/`. All roles use a shared profile form.

## Local setup

### Requirements

- Node.js 20.9 or newer and npm.
- The Bhumisaara backend running, normally at `http://localhost:8080/api/v1`.
- A public thirdweb client ID.
- A compatible ERC-1155 contract deployed on Polygon Amoy. Minting accounts need the appropriate contract permissions.

Run the following commands from this repository's root:

```bash
npm ci
```

Create `.env.development`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
NEXT_PUBLIC_CONTRACT_ADDRESS=your_polygon_amoy_erc1155_contract_address
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL, including `/api/v1`. The Axios client defaults to the local URL above. |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Public client identifier used by the thirdweb SDK. |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | ERC-1155 contract address on Polygon Amoy. |

These values are exposed to the browser. Do not use a thirdweb secret key or wallet private key. The wallet configuration uses an in-app smart wallet with sponsored gas, so the thirdweb project must support that configuration for transactions to work.

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Restart the server after changing environment variables. The backend must allow `http://localhost:3000` through its `CORS_ALLOWED_ORIGINS` setting.

### Sign in

Farmers, private agro-dealers, and organic producers can register through `/auth`. The backend's non-production seeder also provides these demo accounts on a fresh database:

| Role | Email | Demo password |
| --- | --- | --- |
| System administrator | `sysadmin@bhumisaara.lk` | `Password123!` |
| Government administrator | `govadmin@bhumisaara.lk` | `Password123!` |
| Agrarian service officer | `officer@bhumisaara.lk` | `Password123!` |

These accounts depend on backend seeding and are intended for local demos. Existing accounts retain their current passwords. Connect a wallet for token workflows; farmers must select a service area before submitting applications.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3000. |
| `npm run lint` | Run ESLint. |
| `npx tsc --noEmit` | Run TypeScript checks independently. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |

There is no automated frontend test suite. The current Next.js configuration enables `typescript.ignoreBuildErrors`, so a successful build does not mean type checking passed. Run the TypeScript command separately; the project guidelines document existing errors in `components/DotGrid.tsx`.

For a production build, supply the corresponding environment values before running `npm run build`. Public environment variables are embedded in the browser bundle at build time.

## Project structure

```text
app/
  page.tsx                  # Public landing page
  layout.tsx                # Theme, thirdweb, auth, and notification providers
  auth/                     # Login and registration
  (ui)/                     # Authenticated pages and shared dashboard layout
components/
  farmer/                   # Farmer applications, marketplace, orders, credits
  goverment/                # Government stock and credit workflows
  agrarian-officer/         # Application review and handover
  seller/                   # Shared listings, orders, redemption, dashboard
  private-dealer/           # Dealer-specific wrappers and profile
  organic-producer/         # Producer-specific wrappers and profile
  system-admin/             # Platform administration
  ui/                       # Shared UI primitives
context/                    # AuthContext and session state
hooks/                      # API resource hooks and wallet synchronization
lib/                        # Domain types, navigation, thirdweb configuration
utils/                      # API paths, Axios, formatting, error messages
```

The existing government component directory is spelled `goverment`.

## API and session architecture

- [AuthContext.tsx](context/AuthContext.tsx) handles login, registration, logout, and the locally stored session.
- [axiosInstance.ts](utils/axiosInstance.ts) attaches the stored bearer token and clears stored token/user data on a 401 response.
- [apiPaths.ts](utils/apiPaths.ts) defines endpoint paths relative to the base URL. Do not repeat `/api/v1` in individual paths.
- [use-api-resource.ts](hooks/use-api-resource.ts) wraps API reads with loading, error, and refetch state. Domain hooks build on this shared wrapper.
- [navigation.ts](lib/navigation.ts) defines role-specific navigation. Backend authorization remains responsible for enforcing API access.
- [use-wallet-address-sync.ts](hooks/use-wallet-address-sync.ts) sends the connected wallet address to the signed-in user's backend record.

## Token workflows

Stock and subsidy credits use the same contract but represent different assets:

| Asset | Meaning | Frontend workflow |
| --- | --- | --- |
| Stock token | 1 kg of physical fertilizer | Government mints and transfers to an officer; the officer burns tokens at farmer collection. |
| Subsidy credit | Entitlement to 1 kg chemical or 1.5 kg organic fertilizer | Government mints seasonal credits; a farmer transfers credits to a seller at collection; the seller burns them after redemption approval. |

The browser sends a transaction, waits for its receipt, and then records the result through the API. A database save can fail after a transaction succeeds. Preserve the confirmed hash and reconcile the record before repeating a token action.

Order placement reserves stock without a blockchain transaction. Seller preparation also moves no tokens; the farmer signs the credit transfer when confirming collection. Cash-only orders skip that transfer. Order cost previews mirror the backend's integer arithmetic, while the backend calculates the stored amounts.

The backend reports ledger credit balances; the frontend reads actual wallet balances separately. Keep stock and credit types distinct using [distribution.ts](lib/distribution.ts) and [marketplace.ts](lib/marketplace.ts).

## Development conventions

- Use the existing resource hooks, Axios client, and endpoint registry for API integration.
- Reuse shared seller components, profile forms, status badges, table states, and formatting helpers.
- Use `ScanField` from `components/goverment/QrScanner.tsx` for QR input with camera and manual entry.
- Keep loading, empty, and error states visible when fetching data.
- Follow the Next.js 16 guidance and repository-specific rules in [AGENTS.md](AGENTS.md).

### Confirmed transaction recovery

If a transaction confirms but its registry request fails, the signed-in user sees a persistent retry banner. Retry submits the saved confirmed hash and payload to the backend; it never signs or sends another blockchain transaction. The backend verifies the receipt and movement against its configured Polygon Amoy RPC and contract. Wallet linking signs a short-lived challenge for the connected thirdweb account, including smart accounts.
