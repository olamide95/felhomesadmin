export const Paths = {
  users: 'users',
  admins: 'admins',
  wallets: 'wallets',
  transactions: 'transactions',
  properties: 'properties',
  withdrawals: 'withdrawal_requests',
  iouApplications: 'iou_applications',
  investments: 'investments',
  investmentParticipations: 'investment_participations',
  buildProjects: 'build_projects',
  jvProjects: 'jv_projects',
  lands: 'lands',
  vendors: 'vendors',
  products: 'products',
  orders: 'orders',
  paymentVerifications: 'payment_verifications',
  supportThreads: 'support_threads',
  notifications: 'notifications',
  rentToOwnApplications: 'rent_to_own_applications',
  mortgageApplications: 'mortgage_applications',
  referrals: 'referrals',
  config: 'config',
} as const;

export function formatNaira(amount: number | undefined | null): string {
  const v = typeof amount === 'number' ? amount : 0;
  return `₦${v.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatCompactNaira(amount: number | undefined | null): string {
  const v = typeof amount === 'number' ? amount : 0;
  if (v >= 1_000_000_000) return `₦${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(0)}K`;
  return formatNaira(v);
}

export function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
