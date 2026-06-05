# Felhomes Admin

Next.js admin console for the Felhomes platform. Connects to the same Firebase project as the mobile app.

---

## Setup (5 steps)

### 1. Install

```bash
cd felhomes-admin
npm install
```

### 2. Deploy Firestore rules

`firestore.rules` adds an `isAdmin()` helper. Copy it over your existing rules in the same Firebase project as the mobile app, then:

```bash
firebase deploy --only firestore:rules
```

### 3. Create your first admin

Firebase Console → **Authentication** → **Add user** (email + strong password). Copy the UID.

Firestore Console → start collection `admins` (no `__` in the ID, just `admins`) → add document with:
- Document ID: **paste the UID**
- Field: `addedAt` (timestamp, now)

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000 → login → dashboard.

### 5. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

---

## What's in the console

| Section | Purpose |
|---|---|
| **Dashboard** | Live metrics + recent transactions feed |
| **Properties** | Approve / reject user listings (4 status tabs) |
| **Withdrawals** | Process payout requests atomically (debit pendingWithdrawals + log audit txn) |
| **IOU Applications** | Approve & fund (credit user wallet) or reject |
| **Investments** | Create / edit / delete investment projects |
| **Build Projects** | Two tabs: review fundable projects + review build-for-me requests |
| **Joint Ventures** | Review JV land proposals (pending → under review → approved → in progress → completed) |
| **Land Plots** | Create / edit / delete plots for Site & Services |
| **Vendors** | Create / edit vendors, toggle featured, activate / deactivate |
| **Products** | Create / edit products linked to vendors |
| **Users** | List + search; per-user view shows wallet, transactions, suspend, manual credit/debit |

---

## Tech

- Next.js 14 (app router) + TypeScript
- Tailwind CSS + shadcn/ui (manual install, no CLI dependency)
- Firebase Web SDK (Auth + Firestore + Storage)
- Sonner toasts, Lucide icons
- Client-side everything; no server actions

---

## Money movement

All wallet mutations use Firestore `runTransaction()` for atomicity:

- **Withdrawal approval**: decreases `wallets.{uid}.pendingWithdrawals`, marks request `paid`, logs `transactions/{...}` audit row with the bank-transfer reference you provide.
- **Withdrawal rejection**: refunds the amount from `pendingWithdrawals` back to `balance`, marks request `rejected`, logs reversal txn.
- **IOU approval**: credits `wallets.{uid}.balance` by `iouAmount`, marks application `active`, logs disbursement txn.
- **Manual wallet adjust** (in user details): credits or debits with mandatory audit note, logged as `adminAdjustment`.

For production, move these to Cloud Functions and lock down client write rules. Current rules trust authenticated admins to do the right thing.

---

## Adding / removing admins

**Add:** repeat the auth user + Firestore doc steps above.

**Remove:** delete the doc from `admins/{uid}` in Firestore Console. Within seconds, that user's next request to `/admin` will be denied. If they're currently signed in, also Disable the user in Firebase Auth → Users → ⋮ → Disable.

No in-app UI for managing admins by design — admin-admin is the most dangerous operation in the system.

---

## Known things

- **Indexes**: some queries will fail the first time with "this query requires an index" — click the link Firebase logs in the browser console to create it. Common ones are already in your Flutter app's `firestore.indexes.json`.
- **`useFirestoreQuery` deps**: be careful when changing tabs / filters — the hook re-subscribes when the `deps` array changes. Each page passes the right deps.
- **Image uploads** go to `gs://<bucket>/admin_uploads/<folder>/<timestamp>_<name>`. Make sure Storage rules allow admin writes to this path. The mobile app's storage rules at `/{folder}/{uid}/...` won't match — you'll need to add a rule for `admin_uploads`:

```
match /admin_uploads/{folder}/{file=**} {
  allow read: if true;
  allow write: if request.auth != null
    && exists(/databases/(default)/documents/admins/$(request.auth.uid));
}
```

Storage rules are configured in Firebase Console → Storage → Rules.

---

## Routes

```
/                                  → redirects to /admin
/admin                             → dashboard
/admin/login                       → login form
/admin/properties                  → property moderation
/admin/withdrawals                 → withdrawal queue
/admin/iou                         → IOU applications
/admin/investments                 → investment projects CRUD
/admin/build                       → build projects + build-for-me review
/admin/jv                          → JV proposals review
/admin/land                        → land plots CRUD
/admin/vendors                     → vendors CRUD
/admin/products                    → products CRUD
/admin/users                       → users list
/admin/users/[uid]                 → user detail with wallet + transactions
```
# felhomesadmin
