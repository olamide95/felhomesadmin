import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  pending:              'bg-amber-100 text-amber-800 border-amber-200',
  approved:             'bg-green-100 text-green-800 border-green-200',
  active:               'bg-green-100 text-green-800 border-green-200',
  completed:            'bg-green-100 text-green-800 border-green-200',
  paid:                 'bg-green-100 text-green-800 border-green-200',
  available:            'bg-green-100 text-green-800 border-green-200',
  rejected:             'bg-red-100 text-red-800 border-red-200',
  failed:               'bg-red-100 text-red-800 border-red-200',
  cancelled:            'bg-red-100 text-red-800 border-red-200',
  bankDeclined:         'bg-red-100 text-red-800 border-red-200',
  suspended:            'bg-red-100 text-red-800 border-red-200',
  sold:                 'bg-blue-100 text-blue-800 border-blue-200',
  sold_rto:             'bg-blue-100 text-blue-800 border-blue-200',
  processing:           'bg-blue-100 text-blue-800 border-blue-200',
  bankApproved:         'bg-blue-100 text-blue-800 border-blue-200',
  disbursed:            'bg-blue-100 text-blue-800 border-blue-200',
  submitted:            'bg-slate-100 text-slate-700 border-slate-200',
  reviewing:            'bg-purple-100 text-purple-800 border-purple-200',
  bankContacted:        'bg-purple-100 text-purple-800 border-purple-200',
  awaitingBankResponse: 'bg-purple-100 text-purple-800 border-purple-200',
  documentsReceived:    'bg-indigo-100 text-indigo-800 border-indigo-200',
  reserved:             'bg-amber-100 text-amber-800 border-amber-200',
  archived:             'bg-slate-100 text-slate-600 border-slate-200',
  draft:                'bg-slate-100 text-slate-600 border-slate-200',
  fundraising:          'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const LABELS: Record<string, string> = {
  sold_rto:             'Sold RTO',
  bankApproved:         'Bank Approved',
  bankDeclined:         'Bank Declined',
  bankContacted:        'Bank Contacted',
  awaitingBankResponse: 'Awaiting Bank',
  documentsReceived:    'Docs Received',
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status ?? '—';
  const style = STATUS_STYLES[s] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  const label = LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', style)}>
      {label}
    </span>
  );
}
