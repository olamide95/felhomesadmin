// Mirror the paths defined in the Flutter app so we stay in sync.
export const Paths = {
  admins: "admins",
  users: "users",
  wallets: "wallets",
  transactions: "transactions",
  bankAccounts: "bank_accounts",
  withdrawals: "withdrawal_requests",
  properties: "properties",
  inspectionRequests: "inspection_requests",
  leaseRequests: "lease_requests",
  rentalRequests: "rental_requests",
  managementRequests: "management_requests",
  propertyPurchases: "property_purchases",
  iouApplications: "iou_applications",
  investments: "investments",
  investmentParticipations: "investment_participations",
  buildProjects: "build_projects",
  buildParticipations: "build_participations",
  buildForMeRequests: "build_for_me_requests",
  jvProjects: "jv_projects",
  lands: "lands",
  landAcquisitions: "land_acquisitions",
  legacyPlans: "legacy_plans",
  vendors: "vendors",
  products: "products",
  orders: "orders",
  referrals: "referrals",
  sponsorships: "sponsorships",
} as const;

export const PLATFORM_WALLET_UID = "_platform";

export const Business = {
  registrationFee: 10000,
  sponsorCommission: 3000,
  propertyCommissionPercent: 0.15,
  felhomesShareOfProperty: 0.1,
  referrerShareOfProperty: 0.05,
  iouMonthlyRepaymentPercent: 5,
  iouAnnualRepaymentPercent: 60,
  iouLoanMultiplierYears: 3,
} as const;

export function formatNaira(n: number | undefined | null): string {
  const v = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatCompactNaira(n: number | undefined | null): string {
  const v = typeof n === "number" ? n : 0;
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `₦${(v / 1_000).toFixed(1)}k`;
  return `₦${v.toFixed(0)}`;
}
