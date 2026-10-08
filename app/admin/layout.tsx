'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Home, Wallet, FileText, TrendingUp, HardHat,
  Handshake, Map, Store, Package, Users, LogOut, Loader2, Key,
  MessageSquare, Bell, CreditCard, ShieldCheck, Settings, BarChart3,
  Menu, X, Landmark, ChevronRight,
} from 'lucide-react';
import { useAuth, type AdminRole } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { href: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/properties', label: 'Properties', icon: Home },
      { href: '/admin/withdrawals', label: 'Withdrawals', icon: Wallet },
      { href: '/admin/payment-verifications', label: 'Receipts', icon: CreditCard },
      { href: '/admin/iou', label: 'IOU Applications', icon: FileText },
      { href: '/admin/rent-to-own', label: 'Rent-to-Own', icon: Key },
      { href: '/admin/mortgages', label: 'Mortgages', icon: Landmark },
    ],
  },
  {
    label: 'Investments',
    items: [
      { href: '/admin/investments', label: 'Investments', icon: TrendingUp },
      { href: '/admin/build', label: 'Build Projects', icon: HardHat },
      { href: '/admin/jv', label: 'Joint Ventures', icon: Handshake },
      { href: '/admin/land', label: 'Land Plots', icon: Map },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { href: '/admin/vendors', label: 'Vendors', icon: Store },
      { href: '/admin/products', label: 'Products', icon: Package },
    ],
  },
  {
    label: 'Users & Support',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/support', label: 'Support Chat', icon: MessageSquare },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admin/roles', label: 'Roles & Admins', icon: ShieldCheck },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ROLE_STYLES: Record<AdminRole, string> = {
  super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
  admin: 'bg-amber-50 text-amber-700 border-amber-200',
  moderator: 'bg-blue-50 text-blue-700 border-blue-200',
  viewer: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  moderator: 'Moderator',
  viewer: 'Viewer',
};

function NavItem({ href, label, icon: Icon, exact, pathname }: {
  href: string; label: string; icon: any; exact?: boolean; pathname: string;
}) {
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  return (
    <Link href={href} className={cn(
      'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
      active
        ? 'bg-[#C89B3C]/10 text-[#8B6914] border border-[#C89B3C]/20'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
    )}>
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#C89B3C]' : 'text-slate-400 group-hover:text-slate-600')} />
      <span className="truncate flex-1">{label}</span>
      {active && <div className="h-1.5 w-1.5 rounded-full bg-[#C89B3C] shrink-0" />}
    </Link>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  const { user, adminUser, role, signOut } = useAuth();
  const router = useRouter();
  const initials = (adminUser?.displayName ?? adminUser?.email ?? 'A').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <Image src="/logo.png" alt="Felhomes" width={38} height={38} className="rounded-xl shrink-0 object-contain" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 leading-tight">Felhomes</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Admin Console</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} {...item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-slate-100 p-3 space-y-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C89B3C]/20 text-[#8B6914] text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-slate-800">{adminUser?.displayName ?? 'Admin'}</div>
            <div className="truncate text-[10px] text-slate-400">{adminUser?.email}</div>
          </div>
        </div>
        {role && (
          <div className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold', ROLE_STYLES[role])}>
            <ShieldCheck className="h-2.5 w-2.5" />
            {ROLE_LABELS[role]}
          </div>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs"
          onClick={async () => { await signOut(); router.push('/admin/login'); }}>
          <LogOut className="mr-2 h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading || isLoginPage) return;
    if (!user || !isAdmin) router.replace('/admin/login');
  }, [user, isAdmin, loading, isLoginPage, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isLoginPage) return <>{children}</>;

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#C89B3C]/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#C89B3C]" />
          </div>
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0">
        <div className="fixed top-0 left-0 h-screen w-60 shadow-sm">
          <SidebarContent pathname={pathname} />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 shadow-2xl">
            <SidebarContent pathname={pathname} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden shadow-sm">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Image src="/logo.png" alt="Felhomes" width={28} height={28} className="rounded-lg object-contain" />
          <span className="font-bold text-slate-800 text-sm">Felhomes Admin</span>
          {/* Breadcrumb on mobile */}
          {pathname !== '/admin' && (
            <>
              <ChevronRight className="h-3 w-3 text-slate-300" />
              <span className="text-xs text-slate-500 truncate capitalize">
                {pathname.split('/').filter(Boolean).slice(1).join(' / ').replace(/-/g, ' ')}
              </span>
            </>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
