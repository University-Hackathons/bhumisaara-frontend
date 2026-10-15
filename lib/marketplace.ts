/**
 * Shared shapes for the subsidy credit + marketplace side of the system.
 *
 * The companion to `@/lib/distribution.ts`, which covers the government →
 * officer → farmer stock chain. The split matters: these two files describe
 * **two different kinds of token on the same ERC-1155 contract**, and nothing
 * should ever add them together.
 *
 *   STOCK tokens (`distribution.ts`) — backed by fertilizer in a warehouse.
 *   SUBSIDY CREDITS (here)           — backed by the treasury, backed by no goods.
 */

/** Mirrors the backend `TokenType` enum. */
export type TokenType = "STOCK" | "SUBSIDY_CREDIT";

export type ListingStatus = "ACTIVE" | "PAUSED" | "SOLD_OUT";

export type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED";

export type ClaimStatus = "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED";

export type SellerRole = "PRIVATE_AGRO_DEALER" | "ORGANIC_FERTILIZER_PRODUCER";

/** `CreditIssuanceResponseDTO` — one farmer's credits for one season. */
export interface CreditIssuance {
  issuanceId: number;
  farmerId: number;
  farmerName: string | null;
  farmerWallet: string | null;
  season: string;
  creditsKg: number;
  tokenId: string;
  tokenType: TokenType;
  transactionHash: string;
  issuedByUserId: number;
  issuedByName: string | null;
  createdAt: string;
}

/** `EligibleFarmerResponseDTO` — a row on the admin's issuance screen. */
export interface EligibleFarmer {
  farmerId: number;
  farmerName: string;
  fullName: string | null;
  /** Null until the farmer connects a wallet — nothing can be minted to them. */
  walletAddress: string | null;
  areaId: number | null;
  areaName: string | null;
  district: string | null;
  alreadyIssued: boolean;
  issuedCreditsKg: number | null;
  issuanceTransactionHash: string | null;
  canIssue: boolean;
}

/** One season and the ERC-1155 id its credits live under. */
export interface SeasonToken {
  season: string;
  tokenId: string;
  issuedCredits: number;
  spentCredits: number;
  ledgerBalanceCredits: number;
  committedCredits: number;
  availableCredits: number;
}

/**
 * `CreditBalanceResponseDTO`.
 *
 * The figures here are the Postgres ledger. The backend holds no web3 client,
 * so the authoritative on-chain balance is read in the browser with
 * `balanceOf(wallet, tokenId)` for each `seasonTokenIds` entry — see
 * `useOnChainCreditBalance` in `@/hooks/use-credits.ts`.
 */
export interface CreditBalance {
  farmerId: number;
  farmerName: string;
  walletAddress: string | null;
  totalIssuedCredits: number;
  spentCredits: number;
  /** `issued − spent`. What the chain should show if nothing left the platform. */
  ledgerBalanceCredits: number;
  seasonTokenIds: SeasonToken[];
  issuances: CreditIssuance[];
}

/** `ProductListingResponseDTO`. */
export interface ProductListing {
  listingId: number;
  sellerId: number;
  sellerName: string | null;
  sellerRole: SellerRole | null;
  /** Null until the seller connects a wallet — they cannot receive credits yet. */
  sellerWallet: string | null;
  productName: string;
  fertilizerType: string;
  isOrganic: boolean;
  description: string | null;
  priceLkrPerKg: number;
  availableKg: number;
  isSubsidyEligible: boolean;
  status: ListingStatus;
  /** 1 for chemical, 1.5 for organic. Sent by the server so no screen hardcodes it. */
  kgPerCredit: number;
  createdAt: string;
  updatedAt: string;
}

/** `MarketOrderResponseDTO`. */
export interface MarketOrder {
  orderId: number;
  listingId: number;
  productName: string | null;
  fertilizerType: string | null;
  isOrganic: boolean | null;
  farmerId: number;
  farmerName: string | null;
  farmerWallet: string | null;
  sellerId: number;
  sellerName: string | null;
  /** Null blocks confirmation — there is nowhere to send the credits. */
  sellerWallet: string | null;
  quantityKg: number;
  creditsUsed: number;
  cashAmountLkr: number;
  priceLkrPerKg: number | null;
  /** The credit token the farmer's wallet transfers from. Null on a cash-only order. */
  creditTokenId: string | null;
  season: string | null;
  tokenType: TokenType;
  status: OrderStatus;
  creditTransferHash: string | null;
  createdAt: string;
  /** When the *seller* marked the goods ready — not the farmer's confirmation. */
  confirmedAt: string | null;
  completedAt: string | null;
  disputedAt: string | null;
}

/** `OrderQuoteResponseDTO` — the server's costing of a proposed order. */
export interface OrderQuote {
  listingId: number;
  quantityKg: number;
  isOrganic: boolean;
  creditsRequiredForFullQuantity: number;
  creditsUsed: number;
  kgCoveredByCredits: number;
  kgPaidInCash: number;
  cashAmountLkr: number;
  kgPerCredit: number;
}

/** `RedemptionClaimResponseDTO`. */
export interface RedemptionClaim {
  claimId: number;
  sellerId: number;
  sellerName: string | null;
  sellerRole: SellerRole | null;
  sellerWallet: string | null;
  creditsClaimed: number;
  season: string | null;
  creditTokenId: string | null;
  status: ClaimStatus;
  tokenType: TokenType;
  burnTransactionHash: string | null;
  creditsEarnedFromOrders: number;
  creditsAlreadyClaimed: number;
  submittedAt: string;
  processedAt: string | null;
  processedByUserId: number | null;
  processedByName: string | null;
}

export interface SellerRedemptionStats {
  sellerId: number;
  sellerName: string;
  sellerRole: SellerRole | null;
  completedOrderCount: number;
  creditsEarnedFromOrders: number;
  creditsClaimed: number;
  creditsRedeemed: number;
  redemptionRatePct: number;
  /** Redemption volume out of proportion to order count. Worth a human look. */
  flagged: boolean;
  flagReason: string | null;
}

export interface SeasonTotals {
  season: string;
  tokenId: string;
  issuedCredits: number;
  farmerCount: number;
}

/** `CreditReconciliationResponseDTO`. */
export interface CreditReconciliation {
  season: string | null;
  totalIssuedCredits: number;
  spentCredits: number;
  totalRedeemedCredits: number;
  creditsHeldBySellers: number;
  creditsHeldByFarmers: number;
  creditsOutstanding: number;
  /** `issued − (redeemed + held)`. Non-zero means credits moved off-platform. */
  discrepancyCredits: number;
  hasAnomaly: boolean;
  redemptionRatePct: number;
  sellerStats: SellerRedemptionStats[];
  seasonTotals: SeasonTotals[];
}

// ─── Client-side helpers ───────────────────────────────────────────────────
//
// These mirror the server's `CreditMath` exactly so the live breakdown a farmer
// sees while typing matches what the order will actually cost. The server
// re-derives all of it — this is a preview, never the source of truth.

/** Credits needed to cover a quantity. Organic: 1 credit buys 1.5kg. */
export const creditsRequired = (quantityKg: number, isOrganic: boolean) => {
  if (quantityKg <= 0) return 0;
  // ceil(kg / 1.5) === ceil(2kg / 3)
  return isOrganic ? Math.ceil((quantityKg * 2) / 3) : quantityKg;
};

/** Kilograms a number of credits actually pays for. Rounded down, like the server. */
export const kgCoveredByCredits = (credits: number, isOrganic: boolean) => {
  if (credits <= 0) return 0;
  return isOrganic ? Math.floor((credits * 3) / 2) : credits;
};

/** `Rs 12,500` — the app records cash, it never processes it. */
export const formatLkr = (amount: number | null | undefined) =>
  `Rs ${Math.round(Number(amount ?? 0)).toLocaleString()}`;

/** Credits are counted, not weighed — never render them with a kg suffix. */
export const formatCredits = (credits: number | null | undefined) => {
  const value = Math.round(Number(credits ?? 0));
  return `${value.toLocaleString()} ${value === 1 ? "credit" : "credits"}`;
};

/** The one place an order status becomes a human sentence. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Awaiting seller",
  CONFIRMED: "Ready for collection",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  SUBMITTED: "Under review",
  APPROVED: "Approved — burn to settle",
  PAID: "Paid",
  REJECTED: "Rejected",
};
