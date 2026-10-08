# Felhomes Admin Dashboard v2

Complete rebuild with role-based access, live charts, all features, and the Felhomes logo.

## What's in this drop

### App pages (24 total)
| Route | Page | Key features |
|-------|------|-------------|
| `/admin` | Dashboard | Platform balance, all stats, charts, pending alerts, recent activity |
| `/admin/login` | Login | Dark branded login with logo |
| `/admin/reports` | Reports | User growth, tx volume, property pipeline, RTO pipeline charts |
| `/admin/properties` | Properties | Approve/reject with reason, image preview, category filter |
| `/admin/withdrawals` | Withdrawals | Mark paid with bank ref, reject & auto-refund, copy account number |
| `/admin/payment-verifications` | Receipts | View receipt image, approve & credit wallet, reject with reason |
| `/admin/iou` | IOU | Approve & auto-disburse to wallet, reject, repayment schedule |
| `/admin/rent-to-own` | RTO listing | Filter by status, pending count badge |
| `/admin/rent-to-own/[id]` | RTO detail | Approve (pays referral), reject (refunds deposit), forfeit |
| `/admin/mortgages` | Mortgages | Stage filter, in-progress count |
| `/admin/mortgages/[id]` | Mortgage detail | Stage advance + note, auto-refund on bankDeclined |
| `/admin/users` | Users | Search, suspend/reinstate, registration fee status |
| `/admin/support` | Support chat | Two-pane inbox, real-time messages, keyboard send |
| `/admin/notifications` | Notifications | Compose + send push to all/filtered users, broadcast history |
| `/admin/investments` | Investments | Progress bars, return rates, participant counts |
| `/admin/build` | Build projects | Build With Me / Build For Me approval |
| `/admin/jv` | Joint ventures | Director escalation warning, approve flow |
| `/admin/land` | Land plots | Approve/reject, image preview |
| `/admin/vendors` | Vendors | Add/edit vendors, suspend/activate |
| `/admin/products` | Products | Manage marketplace products |
| `/admin/roles` | Roles & Admins | Add/remove staff, change roles (Super Admin only) |
| `/admin/settings` | Settings | All business rules (Super Admin only) |

### Shared components
- `StatusBadge` — colour-coded badge for every status value across the platform
- `PageHeader` — consistent title + description + optional action button
- `EmptyState` — illustrated empty states
- `ValidationWarningDialog` — confirmation dialog before irreversible actions

### Role-based permissions
Four roles with fine-grained permissions:
- **Super Admin** — everything including roles and settings
- **Admin** — all operations except roles and settings
- **Moderator** — approve/reject content and payments; no user management
- **Viewer** — read-only

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add shadcn/ui components (if not already installed)
```bash
npx shadcn@latest add alert-dialog dialog select label input textarea button card badge table
```

### 3. Add your Firebase config
Create or update `lib/firebase.ts`:
```ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // your config here
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 4. Copy the logo
Put `logo.png` in your `public/` folder.

### 5. Wrap your app with AuthProvider
In `app/layout.tsx`:
```tsx
import { AuthProvider } from '@/lib/auth';
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 6. Add Sonner toast provider
In `app/layout.tsx`:
```tsx
import { Toaster } from 'sonner';
// inside body:
<Toaster position="top-right" richColors />
```

### 7. Run
```bash
npm run dev
```

---

## Firestore: add first Super Admin

In Firebase Console, create a document at `admins/{your-firebase-uid}`:
```json
{
  "email": "you@felhomes.com",
  "displayName": "Your Name",
  "role": "super_admin",
  "createdAt": "<server timestamp>"
}
```

Then log in. The role management page lets you add all other staff from there.

---

## Files not included (copy from your existing project)
- `lib/firebase.ts` — your Firebase config
- `lib/utils.ts` — shadcn `cn()` helper
- `components/ui/*` — shadcn/ui components
- `tailwind.config.ts` / `globals.css` — your Tailwind setup
- `app/layout.tsx` (root) — needs AuthProvider + Toaster added

---

## Changes from v1
- Full logo integration (top of sidebar + login page + loading screen)
- Role-based permissions system with 4 tiers
- All-new main dashboard with 12 stat cards, 4 charts, pending alerts banner, platform balance
- Reports page with user growth, tx volume, property pipeline, RTO pipeline charts
- Notifications page — compose and send push notifications
- Settings page — all business rules editable by Super Admin
- Support chat fully rebuilt as two-pane inbox
- Roles & Admins management page
- All existing pages ported with consistent styling
- Mobile-responsive sidebar with hamburger menu
- Dark branded login page
