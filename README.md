# BayBlaze Driver

Mobile-first React PWA for BayBlaze delivery drivers.

## Stack

- React, TypeScript, Vite, Tailwind CSS.
- `bayblaze-api` for auth, driver workflow state, uploads, delivery queues,
  delivery-attempt logs, notification registration, and secure email/push
  delivery.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required frontend variables:

```env
VITE_BAYBLAZE_API_URL=http://localhost:3040
VITE_BAYBLAZE_WEB_PUSH_PUBLIC_KEY=
```

Closed-app driver assignment push notifications use standard Web Push. The
private VAPID key and Resend sender credentials live only in `bayblaze-api`;
the browser app stores a push subscription through
`POST /v1/driver/me/notification-tokens`.

## Driver Access Flow

1. Driver enters email.
2. App calls `bayblaze-api`, which checks `driver_allowlist/{emailKey}`.
3. Existing drivers sign in through the universal BayBlaze account routes.
4. New allowlisted drivers receive a Resend code from `bayblaze-api`.
5. The API validates the code, creates the account, and returns a driver
   session.
7. The app guides the driver through profile photo/profile setup, vehicle link,
   clock-in, and the active dashboard.

Passwords are handled only by the secure backend auth boundary and are never
stored in Firestore.

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
