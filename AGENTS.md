# BayBlaze Driver Dashboard Notes

## Durable Project Memory

Record durable project facts, recurring commands, deployment details, service
boundaries, and workflow preferences in this file so future Codex sessions can
pick them up after context compaction or a new chat.

When code changes are complete, automatically commit and push the changes unless
the user explicitly says not to. Use a concise commit message that reflects the
completed work.

When infrastructure, deployment, environment variables, service topology,
runner setup, or cross-repo integration details change, update the relevant
`AGENTS.md` files in the same work session so future Codex/LLM sessions inherit
the current operating model.

## Repo Purpose

`ie04/bayblaze-driver` is the BayBlaze Driver Dashboard: a mobile-first React
PWA for delivery drivers. It should feel visually related to the BayBlaze
storefront while prioritizing fast driver workflows on a phone in a vehicle.

Core stack:

- React, TypeScript, Vite, Tailwind CSS.
- PWA support through Vite.
- Firebase Authentication for accounts, login, and passwords.
- Firestore for driver allowlist, profiles, onboarding, vehicle links,
  clock-in/out state, live location snapshots, and dashboard/order references.
- Firebase Storage for required driver profile photos when configured.
- Firebase Functions for privileged backend work such as Resend verification
  emails and Auth account creation.

## Security And Auth Model

- Never store passwords in Firestore.
- Do not expose Resend API keys to browser code. Resend calls must happen only
  in Firebase Functions or another secure backend/serverless boundary.
- Driver emails must be manually allowlisted in
  `driver_allowlist/{emailKey}` before signup.
- Email keys should be normalized as lowercase trimmed emails with unsafe path
  characters replaced consistently in shared helpers.
- The allowlist gates signup/onboarding. If an email is not active in
  `driver_allowlist`, the app should deny access with clear driver-facing copy.
- Existing Auth users sign in through normal Firebase email/password auth.
- New allowlisted drivers verify an emailed code through the backend, create a
  password that satisfies BayBlaze requirements, and have their Firebase Auth
  account created by a privileged backend function.
- Password requirements: at least 12 characters, includes letters and numbers,
  and includes at least one symbol. Show validation feedback before submit.

## Firestore Data Model

Suggested collections:

- `driver_allowlist/{emailKey}`: `email`, `active`, `createdAt`, `createdBy?`,
  `notes?`.
- `driver_profiles/{uid}`: identity, contact/profile fields, profile photo
  path/URL, onboarding state, active vehicle, clock state, timestamps.
- `vehicles/{vehicleId}`: label, plate/make/model/color, active state,
  linked driver, link timestamp, updated timestamp.
- `driver_location_snapshots/{uid}`: latest driver location snapshot when live
  driver location is enabled.
- `driver_signup_codes/{emailKey}`: backend-owned short-lived verification
  challenge state. Store hashed codes only, never raw codes.

## Driver Workflow Rules

- Profile setup requires first name, last name, phone number, bio, and a
  profile photo before onboarding can complete.
- A driver must link to an available vehicle before clocking in.
- A driver must be clocked in to appear active.
- Clocking out must mark the driver clocked out, unlink the driver from the
  vehicle, and free that vehicle for another driver.
- Vehicle selection is required again on the next clock-in so one driver can use
  different vehicles on different days.

## Cross-Repo Boundaries

- `bayblaze-storefront` remains the customer-facing commerce app.
- `bayblaze-medusa` remains the source of truth for products, variants, orders,
  fulfillment, payment state, and inventory.
- `bayblaze-isochronos` remains BayBlaze's backend-only delivery intelligence
  service for geocoding, routing, delivery ETA, address autocomplete,
  geographic partitioning, and Google Maps usage guardrails.
- The driver app must not call paid Google Maps APIs directly from browser code
  and must never expose server-side Google Maps API keys.
- Driver delivery UI should consume Medusa/order references and IsoChronos ETA
  snapshots or interpolation-friendly data through backend/API boundaries.
- Keep delivery intelligence, coordinates, route cache behavior, and Google
  Maps cost controls out of React page components.

## Deployment Assumptions

- The PWA can be deployed as a static Vite app to Firebase Hosting or another
  static host.
- Firebase / Google Cloud project ID: `bayblaze-driver`.
- Firebase project number / messaging sender ID: `251302296493`.
- Firebase web app ID: `1:251302296493:web:4e60eec8a1562035e8ff24`.
- Default Firebase Hosting site: `bayblaze-driver`.
- Firebase Email/Password Authentication is enabled.
- Firestore `(default)` is enabled in location `nam5`; Firestore rules from
  `firestore.rules` have been deployed.
- Firebase Storage is enabled with default bucket
  `bayblaze-driver.firebasestorage.app` in `US-EAST1`; Storage rules from
  `storage.rules` have been deployed.
- Firebase Functions deploy alongside the app when email verification, Auth
  account creation, or other privileged server actions are needed.
- Browser-exposed environment variables must use the `VITE_` prefix and must be
  safe for public clients.
- Required local frontend variables are the Firebase web config values:
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`.
- Server-only function configuration includes `RESEND_API_KEY` and a verified
  sender address such as `DRIVER_EMAIL_FROM`.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```
