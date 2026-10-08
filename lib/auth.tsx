'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'viewer';

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
}

export interface Permissions {
  canApproveProperties: boolean;
  canApproveWithdrawals: boolean;
  canApproveIou: boolean;
  canApproveRto: boolean;
  canAdvanceMortgage: boolean;
  canApprovePayments: boolean;
  canReplySupport: boolean;
  canManageUsers: boolean;
  canSuspendUsers: boolean;
  canViewFinancials: boolean;
  canExportReports: boolean;
  canManageRoles: boolean;
  canManageSettings: boolean;
  canManageVendors: boolean;
  canManageInvestments: boolean;
  canViewAll: boolean;
}

function permissionsFor(role: AdminRole): Permissions {
  const none: Permissions = {
    canApproveProperties: false, canApproveWithdrawals: false,
    canApproveIou: false, canApproveRto: false, canAdvanceMortgage: false,
    canApprovePayments: false, canReplySupport: false, canManageUsers: false,
    canSuspendUsers: false, canViewFinancials: false, canExportReports: false,
    canManageRoles: false, canManageSettings: false, canManageVendors: false,
    canManageInvestments: false, canViewAll: false,
  };
  switch (role) {
    case 'viewer':
      return { ...none, canViewAll: true, canViewFinancials: true };
    case 'moderator':
      return { ...none, canViewAll: true, canViewFinancials: true,
        canApproveProperties: true, canApproveRto: true,
        canAdvanceMortgage: true, canApprovePayments: true, canReplySupport: true };
    case 'admin':
      return { ...none, canViewAll: true, canViewFinancials: true,
        canApproveProperties: true, canApproveWithdrawals: true, canApproveIou: true,
        canApproveRto: true, canAdvanceMortgage: true, canApprovePayments: true,
        canReplySupport: true, canManageUsers: true, canSuspendUsers: true,
        canExportReports: true, canManageVendors: true, canManageInvestments: true };
    case 'super_admin':
      return Object.fromEntries(Object.keys(none).map(k => [k, true])) as Permissions;
    default: return none;
  }
}

type AuthState = {
  user: User | null;
  adminUser: AdminUser | null;
  role: AdminRole | null;
  permissions: Permissions | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'admins', u.uid));
          if (snap.exists()) {
            const data = snap.data();
            const r = (data.role as AdminRole) ?? 'viewer';
            setAdminUser({ uid: u.uid, email: u.email ?? '', displayName: u.displayName ?? data.displayName, role: r });
            setRole(r);
            setPermissions(permissionsFor(r));
          } else {
            setAdminUser(null); setRole(null); setPermissions(null);
          }
        } catch {
          setAdminUser(null); setRole(null); setPermissions(null);
        }
      } else {
        setAdminUser(null); setRole(null); setPermissions(null);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user, adminUser, role, permissions,
      isAdmin: adminUser !== null, loading,
      signIn: (e, p) => signInWithEmailAndPassword(auth, e.trim(), p).then(),
      signOut: () => fbSignOut(auth),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
