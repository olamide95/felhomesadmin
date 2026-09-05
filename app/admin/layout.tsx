"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  Wallet,
  FileText,
  TrendingUp,
  HardHat,
  Handshake,
  Map,
  Store,
  Package,
  Users,
  LogOut,
  Loader2,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReceiptText } from 'lucide-react';
import { MessageCircle } from 'lucide-react';
import {  Landmark } from 'lucide-react';

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/properties", label: "Properties", icon: Home },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/admin/iou", label: "IOU Applications", icon: FileText },
  { href: "/admin/investments", label: "Investments", icon: TrendingUp },
  { href: "/admin/build", label: "Build Projects", icon: HardHat },
  { href: "/admin/jv", label: "Joint Ventures", icon: Handshake },
  { href: "/admin/land", label: "Land Plots", icon: Map },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/users", label: "Users", icon: Users },
  {
  label: 'Payment Verifications',
  href: '/admin/payment-verifications',
  icon: ReceiptText,
 
},
{
  label: 'Support',
  href: '/admin/support',
  icon: MessageCircle,
  // Optional badge for pending unread threads:
  // badge: unreadThreads > 0 ? String(unreadThreads) : undefined,
},
{
  label: 'Rent-to-Own',
  href: '/admin/rent-to-own',
  icon: Handshake,
  // Optional badge for pending applications count:
  // badge: pendingRto > 0 ? String(pendingRto) : undefined,
},
{
  label: 'Mortgages',
  href: '/admin/mortgages',
  icon: Landmark,
  // Optional badge for in-progress applications count:
  // badge: activeMortgages > 0 ? String(activeMortgages) : undefined,
},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (loading || isLoginPage) return;
    if (!user || !isAdmin) router.replace("/admin/login");
  }, [user, isAdmin, loading, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-60 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">Felhomes Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 truncate px-3 text-xs text-muted-foreground">
            {user.email}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await signOut();
              router.push("/admin/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <div className="border-b bg-card lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="font-semibold">Felhomes Admin</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t px-4 py-2">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
function usePendingVerificationsCount(): any {
  throw new Error("Function not implemented.");
}

