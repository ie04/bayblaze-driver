# BayBlaze Driver

Mobile-first React PWA for BayBlaze delivery drivers.

## Stack

- React, TypeScript, Vite, Tailwind CSS.
- Firebase Authentication, Firestore, Storage, Hosting, and Functions.
- Resend email verification through Firebase Functions only.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Functions:

```bash
cd functions
npm install
cp .env.example .env
npm run build
```

Required frontend variables are listed in `.env.example`. Server-only Resend
settings are listed in `functions/.env.example`.

## Driver Access Flow

1. Driver enters email.
2. App checks `driver_allowlist/{emailKey}`.
3. A Firebase Function confirms allowlist state and Auth account existence.
4. Existing drivers sign in with Firebase email/password auth.
5. New allowlisted drivers receive a Resend code from the Function.
6. The Function validates the code and creates the Firebase Auth user.
7. The app guides the driver through profile photo/profile setup, vehicle link,
   clock-in, and the active dashboard.

Passwords are handled only by Firebase Authentication and are never stored in
Firestore.

## BayBlaze UI Primitives

Reusable React + Tailwind primitives live in `src/components/ui`. New driver UI
should import shared pieces such as `Button`, `Card`, `Badge`, `Input`,
`Textarea`, `AppShell`, `BottomNav`, `EmptyState`, `LoadingState`, `ErrorState`,
`MetricCard`, `OrderCard`, and `ActionBar` from that module instead of repeating
raw Tailwind class stacks.

Brand tokens are centralized in `src/index.css` as `--bb-*` CSS variables and
Tailwind v4 `@theme` entries. Future BayBlaze apps can lift this UI folder plus
the token block as the starting point for a shared package.

The driver app shell, auth/profile forms, vehicle selection, active shift,
live-location card, delivery route, and delivery workflow now use these
primitives. When adding a primitive, keep the default BayBlaze shape, focus
state, tap target, tone names, and token usage inside `src/components/ui`, then
allow screen-specific layout through `className` only where needed.
