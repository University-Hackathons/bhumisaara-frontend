export type Role =
  | "SYSTEM_ADMIN"
  | "GOVERNMENT_ADMIN"
  | "AGRARIAN_SERVICE_OFFICER"
  | "FARMER"
  | "PRIVATE_AGRO_DEALER"
  | "ORGANIC_FERTILIZER_PRODUCER";

/**
 * The sidebar section an item belongs to.
 *
 * Items are grouped by *what the user is trying to do*, not by which backend
 * serves them — a farmer's subsidy paperwork and their marketplace spending are
 * two different errands even though both are "the farmer's screens".
 *
 * A group id is shared across roles wherever the intent is the same (an
 * officer's handovers and an admin's transfers are both `distribution`); role
 * filtering means the two never render together, so one label serves both.
 */
export type NavGroupId =
  | "overview"
  | "subsidy"
  | "market"
  | "requests"
  | "imports"
  | "distribution"
  | "credits"
  | "storefront"
  | "settlement"
  | "administration";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  group: NavGroupId;
  roles: Role[];
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  items: NavItem[];
}

/**
 * Display order and heading for every sidebar section. The order is the
 * lifecycle order each role actually works in — e.g. an admin imports stock
 * before distributing it, so `imports` sits above `distribution`.
 */
const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "subsidy", label: "Fertilizer Subsidy" },
  { id: "market", label: "Green Market" },
  { id: "requests", label: "Farmer Requests" },
  { id: "imports", label: "Imports & Stock" },
  { id: "distribution", label: "Distribution" },
  { id: "credits", label: "Subsidy Credits" },
  { id: "storefront", label: "Storefront" },
  { id: "settlement", label: "Settlement" },
  { id: "administration", label: "Administration" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    group: "overview",
    roles: [
      "SYSTEM_ADMIN",
      "GOVERNMENT_ADMIN",
      "AGRARIAN_SERVICE_OFFICER",
      "FARMER",
      "PRIVATE_AGRO_DEALER",
      "ORGANIC_FERTILIZER_PRODUCER",
    ],
  },

  // ─── Farmer: the subsidy paperwork ──────────────────────────────────────
  {
    id: "applicationForm",
    label: "New Application",
    href: "/application-form",
    group: "subsidy",
    roles: ["FARMER"],
  },
  {
    // Same route as the officer's "Area Applications" below — the page
    // switchboards on role (app/(ui)/applications-history/page.tsx). Two
    // entries so each role gets the wording and section matching what they
    // actually see there: their own applications vs. their whole area's.
    id: "myApplications",
    label: "My Applications",
    href: "/applications-history",
    group: "subsidy",
    roles: ["FARMER"],
  },

  // ─── Farmer: spending subsidy credits ───────────────────────────────────
  {
    id: "marketplace",
    label: "Browse Market",
    href: "/marketplace",
    group: "market",
    roles: ["FARMER"],
  },
  {
    id: "myOrders",
    label: "My Orders",
    href: "/my-orders",
    group: "market",
    roles: ["FARMER"],
  },
  {
    id: "creditBalance",
    label: "My Credits",
    href: "/credit-balance",
    group: "market",
    roles: ["FARMER"],
  },

  // ─── Officer: reviewing what farmers ask for ────────────────────────────
  {
    id: "requestApprovals",
    label: "Review Queue",
    href: "/request-approvals",
    group: "requests",
    roles: ["AGRARIAN_SERVICE_OFFICER"],
  },
  {
    id: "areaApplications",
    label: "Area Applications",
    href: "/applications-history",
    group: "requests",
    roles: ["AGRARIAN_SERVICE_OFFICER"],
  },

  // ─── Government: stock entering the country ─────────────────────────────
  {
    id: "importHistory",
    label: "Import History",
    href: "/import-history",
    group: "imports",
    roles: ["GOVERNMENT_ADMIN"],
  },
  {
    id: "sackLabels",
    label: "Sack Labels",
    href: "/sack-labels",
    group: "imports",
    roles: ["GOVERNMENT_ADMIN"],
  },

  // ─── Moving stock outward: admin → officer → farmer ─────────────────────
  {
    id: "officerDistribution",
    label: "Distribute to Officers",
    href: "/officer-distribution",
    group: "distribution",
    roles: ["GOVERNMENT_ADMIN"],
  },
  {
    id: "officerDistributionHistory",
    label: "Distribution History",
    href: "/officer-distribution-history",
    group: "distribution",
    roles: ["GOVERNMENT_ADMIN"],
  },
  {
    id: "distributionLevel",
    label: "National Distribution",
    href: "/distribution-level",
    group: "distribution",
    roles: ["GOVERNMENT_ADMIN"],
  },
  {
    id: "handover",
    label: "Handover",
    href: "/handover",
    group: "distribution",
    roles: ["AGRARIAN_SERVICE_OFFICER"],
  },
  {
    // Same route as the government's "Officer Handovers" below — the page
    // switchboards on role (app/(ui)/handover-history/page.tsx). An officer
    // sees the handovers they performed; an admin picks any officer and audits
    // theirs, which is where farmer disputes surface for someone to act on.
    id: "ownDistribution",
    label: "Handover History",
    href: "/handover-history",
    group: "distribution",
    roles: ["AGRARIAN_SERVICE_OFFICER"],
  },
  {
    id: "officerHandovers",
    label: "Officer Handovers",
    href: "/handover-history",
    group: "distribution",
    roles: ["GOVERNMENT_ADMIN", "SYSTEM_ADMIN"],
  },

  // ─── Government: the treasury side ──────────────────────────────────────
  {
    id: "creditIssuance",
    label: "Issue Credits",
    href: "/credit-issuance",
    group: "credits",
    roles: ["GOVERNMENT_ADMIN"],
  },
  {
    id: "redemptionClaims",
    label: "Redemption Claims",
    href: "/redemption-claims",
    group: "credits",
    roles: ["GOVERNMENT_ADMIN", "SYSTEM_ADMIN"],
  },
  {
    id: "creditOversight",
    label: "Credit Oversight",
    href: "/credit-oversight",
    group: "credits",
    roles: ["GOVERNMENT_ADMIN", "SYSTEM_ADMIN"],
  },

  // ─── Sellers (both roles share these screens) ───────────────────────────
  {
    id: "inventory",
    label: "My Listings",
    href: "/inventory",
    group: "storefront",
    roles: ["PRIVATE_AGRO_DEALER", "ORGANIC_FERTILIZER_PRODUCER"],
  },
  {
    id: "incomingOrders",
    label: "Incoming Orders",
    href: "/incoming-orders",
    group: "storefront",
    roles: ["PRIVATE_AGRO_DEALER", "ORGANIC_FERTILIZER_PRODUCER"],
  },
  {
    // Settling credits with the treasury is a different errand from selling to
    // farmers, so it gets its own heading rather than sitting under Storefront.
    id: "redemption",
    label: "Redemption",
    href: "/redemption",
    group: "settlement",
    roles: ["PRIVATE_AGRO_DEALER", "ORGANIC_FERTILIZER_PRODUCER"],
  },

  // ─── Administration ─────────────────────────────────────────────────────
  {
    id: "officerAssign",
    label: "Assign Officers",
    href: "/officer-assign",
    group: "administration",
    roles: ["GOVERNMENT_ADMIN", "SYSTEM_ADMIN"],
  },

  // NOTE: /profile is deliberately absent. It is reached from the sidebar
  // footer's account menu, and listing it twice made it read as two places.
];

/**
 * Returns the navigation items that the user with the given role should see.
 */
export function getNavItemsForRole(userRole: Role | string | null | undefined): NavItem[] {
  if (!userRole) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(userRole as Role));
}

/**
 * The same items as `getNavItemsForRole`, bucketed into their sidebar sections
 * in display order. Empty sections are dropped, so each role only ever sees
 * headings that have something under them.
 */
export function getNavGroupsForRole(userRole: Role | string | null | undefined): NavGroup[] {
  const items = getNavItemsForRole(userRole);

  return NAV_GROUPS.map(({ id, label }) => ({
    id,
    label,
    items: items.filter((item) => item.group === id),
  })).filter((group) => group.items.length > 0);
}

export default NAV_ITEMS;

import {
  House,
  Layers,
  FileText,
  FilePlus,
  History,
  Package,
  UserCheck,
  ClipboardCheck,
  QrCode,
  Truck,
  Flame,
  Store,
  ShoppingCart,
  Coins,
  ReceiptText,
  ShieldCheck,
  PackageCheck,
  Banknote,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export const ICONS_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  dashboard: House,
  // Farmer — subsidy
  applicationForm: FilePlus,
  myApplications: FileText,
  // Farmer — market
  marketplace: Store,
  myOrders: ShoppingCart,
  creditBalance: Coins,
  // Officer — requests
  requestApprovals: ClipboardCheck,
  areaApplications: FileText,
  // Government — imports
  importHistory: History,
  sackLabels: QrCode,
  // Distribution
  officerDistribution: Truck,
  officerDistributionHistory: History,
  distributionLevel: Layers,
  handover: Flame,
  ownDistribution: History,
  officerHandovers: History,
  // Government — credits
  creditIssuance: Coins,
  redemptionClaims: ReceiptText,
  creditOversight: ShieldCheck,
  // Sellers
  inventory: Package,
  incomingOrders: PackageCheck,
  redemption: Banknote,
  // Administration
  officerAssign: UserCheck,
};
