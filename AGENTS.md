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
- `bayblaze-api` for driver allowlist, email/password account flows, session
  token issuance, profile/onboarding, profile and delivery-attempt photo
  uploads, vehicle links, clock-in/out state, live location snapshots, queue
  state, delivery attempts, and notification-token registration.
- Firestore, Firebase Auth, Firebase Storage, Resend, commerce/order runtime,
  routing/scoring, and any privileged backend credentials sit behind
  `bayblaze-api`. The browser app must not import Firebase SDKs, Firestore
  collection names, Firebase Storage APIs, Firebase Functions callers, direct
  commerce APIs, or backend service tokens.

## Security And Auth Model

- Never store passwords in Firestore.
- Do not expose Resend API keys to browser code. Resend calls must happen only
  in `bayblaze-api` or another secure backend/serverless boundary.
- Driver emails must be manually allowlisted in
  `driver_allowlist/{emailKey}` before signup.
- Email keys should be normalized as lowercase trimmed emails with unsafe path
  characters replaced consistently in shared helpers.
- The allowlist gates signup/onboarding. If an email is not active in
  `driver_allowlist`, the app should deny access with clear driver-facing copy.
- Existing Auth users sign in by calling `bayblaze-api`, which validates
  email/password server-side, ensures an `accounts/{uid}` record with the
  `driver` role, and returns a BayBlaze account session token that is accepted
  by driver workflow routes.
- The driver PWA sign-in screen uses the universal BayBlaze account routes:
  `POST /v1/auth/login`, `POST /v1/auth/google/start`, and
  `POST /v1/auth/google/callback`. The app stores the returned universal
  account session as its driver bearer token only after verifying the account
  has the `driver` role on an enabled account.
- New allowlisted drivers verify an emailed code through the backend, create a
  password that satisfies BayBlaze requirements, and have their account created
  by `bayblaze-api`.
- Password requirements: at least 12 characters, includes letters and numbers,
  and includes at least one symbol. Show validation feedback before submit.

## Backend Data Model Behind BayBlaze API

Suggested collections:

- `driver_allowlist/{emailKey}`: `email`, `active`, `createdAt`, `createdBy?`,
  `notes?`.
- `driver_profiles/{uid}`: identity, contact/profile fields, profile photo
  path/URL, onboarding state, active vehicle, clock state, timestamps.
- `vehicles/{vehicleId}`: label, plate/make/model/color, active state,
  linked driver, link timestamp, updated timestamp.
- `driver_location_snapshots/{uid}`: latest driver location snapshot when live
  driver location is enabled.
- `driver_delivery_queues/{uid}`: driver-safe route queue materialized by
  `bayblaze-api` from Medusa orders and internal routing scoring. Driver clients
  consume this through API routes; they do not read/write queue docs directly.
- `driver_notification_tokens/{uid}/tokens/{tokenId}`: backend-owned web push
  token/subscription state for closed-app delivery assignment push. Driver
  clients must register/unregister through `bayblaze-api`.
- `driver_signup_codes/{emailKey}`: backend-owned short-lived verification
  challenge state. Store hashed codes only, never raw codes.
- `delivery_attempt_logs/{logId}`: timestamped driver delivery attempt events
  such as warehouse/customer arrival, `out_for_delivery`, ID photo, merchant
  invoice photo, cancellations, and completions. Driver clients create logs
  through `bayblaze-api`.

Vehicle linking and release are API-mediated. The driver browser should call
`bayblaze-api` instead of relying on Firestore rules to protect partial document
updates.

## Driver Workflow Rules

- Profile setup requires first name, last name, phone number, bio, and a
  profile photo before onboarding can complete.
- A driver must link to an available vehicle before clocking in.
- A driver must be clocked in to appear active.
- While clocked in with an active vehicle, the driver PWA sends throttled
  browser geolocation updates to `bayblaze-api`; the API writes
  `driver_location_snapshots/{uid}` server-side and routing/ETA processing
  consumes those snapshots internally.
- Clocking out must mark the driver clocked out, unlink the driver from the
  vehicle, and free that vehicle for another driver.
- Vehicle selection is required again on the next clock-in so one driver can use
  different vehicles on different days.
- Delivery route queues are ordered as a stack. The top delivery is always the
  current stop, and the first two deliveries (current and next) must remain
  locked. Queued deliveries after the second stop may be reordered by backend
  scoring, which recalculates when the current order is marked complete.
- Delivery execution steps are discrete and consistent for every order:
  warehouse pickup when any item is not already in the vehicle, add items to box
  with item/variant/quantity confirmation and invoice slip, drive to customer,
  ID checklist, ID photo, merchant invoice signature, merchant invoice photo,
  handoff, completion celebration, then return to the delivery route.
- The current-stop route card can request label/invoice reprints through
  `POST /v1/driver/me/deliveries/:orderId/reprint-labels`. The driver app must
  not call Medusa or the label printer agent directly.
- Delivery attempt photos are stored under
  `delivery-attempt-photos/{uid}/{orderId}/...` and referenced from
  `delivery_attempt_logs`.
- Driver delivery attempt logs `out_for_delivery`, `completed`, and `cancelled`
  are sent by `bayblaze-api` to Medusa `/admin/bayblaze/delivery-attempts`.
  Completing the Add items to box step must create an `out_for_delivery` log so
  customer storefront order progress can mark Out for delivery. Medusa persists
  `bayblaze_delivery_status` plus driver/timestamp fields on order metadata.
  Only terminal statuses (`completed` and `cancelled`) should trigger driver
  queue rescoring/removal behavior.
- Driver assignment alerts use API-synced queue polling for foreground updates.
  The VitePWA service worker is `src/driver-service-worker-v2.ts` and handles
  app precache plus browser push notification click deep links. The browser
  registers standard Web Push subscriptions with
  `POST /v1/driver/me/notification-tokens` using the public
  `VITE_BAYBLAZE_WEB_PUSH_PUBLIC_KEY`; unregistration calls
  `DELETE /v1/driver/me/notification-tokens/:tokenId`. Email alerts for new
  driver assignments must be sent by `bayblaze-api` or another secure backend
  boundary, never by the browser app.

## Cross-Repo Boundaries

- `bayblaze-storefront` remains the customer-facing commerce app.
- `bayblaze-admin` is the operator dashboard for account roles/settings,
  live drivers, driver routes, isochrone plots, and live order details. It lives
  at `admin.bayblaze.net` and must call `bayblaze-api` only.
- The commerce/order implementation is internal to `bayblaze-api`. Driver UI
  must treat products, variants, orders, fulfillment, payment state, inventory,
  labels, invoices, and delivery status as BayBlaze API concepts; the old
  standalone `bayblaze-medusa` repo is retired and must not be used by the
  driver dashboard.
- IsoChronos-derived geocoding, routing, delivery ETA, address autocomplete,
  geographic partitioning, and Google Maps usage guardrails are internal
  `bayblaze-api` modules for app-facing workflows.
- `bayblaze-inventory` is the staff-facing inventory PWA for routine product,
  variant, stock count, metadata, and vehicle assignment workflows. It must act
  through a trusted backend/Medusa boundary and must not store separate commerce
  inventory state.
- The driver app must not call paid Google Maps APIs directly from browser code
  and must never expose server-side Google Maps API keys.
- Driver delivery UI should consume BayBlaze delivery IDs, customer-safe order
  summaries, and routing/ETA snapshots through `bayblaze-api` boundaries.
- Keep delivery intelligence, coordinates, route cache behavior, and Google
  Maps cost controls out of React page components.
- Driver React code must treat `bayblaze-api` as the only delivery workflow
  backend. Do not expose or consume Medusa/internal commerce identifiers such as
  `medusaOrderId` or `orderReference` in driver PWA types, components,
  workflow logging, or route-card actions; the API should translate `orderId`
  into any internal implementation identifiers server-side.
- BayBlaze account roles and account settings, including
  `settings.ageVerificationDisabled`, are owned by `bayblaze-api` account
  records in `accounts/{uid}`. Driver browser code should treat these as
  session/account metadata from the API, not as Firestore state.
- Temporary solo-driver dispatch fallback: `syncDriverDeliveryQueue` in
  `bayblaze-api` checks for active, onboarded, clocked-in drivers with linked
  vehicles. If exactly one exists and it is the requesting UID, the API may
  include currently unassigned open orders for that driver. With multiple active
  drivers, only explicitly assigned BayBlaze delivery stops are returned until a
  dedicated dispatch/partitioning service assigns unassigned orders.

## Deployment Assumptions

- The PWA can be deployed as a static Vite app to Firebase Hosting or another
  static host.
- If Firebase Hosting is used, it should serve only the static `dist` app. The
  driver repo no longer owns Firebase Functions, Firestore rules, Storage rules,
  or Firebase client SDK configuration.
- Browser-exposed environment variables must use the `VITE_` prefix and must be
  safe for public clients.
- Required local frontend variable:
  `VITE_BAYBLAZE_API_URL=http://localhost:3040`.
- Closed-app driver assignment push notifications require the browser-safe
  public Web Push key in `VITE_BAYBLAZE_WEB_PUSH_PUBLIC_KEY`. Private VAPID keys
  and assignment email sender credentials belong only in `bayblaze-api`.
- Google OAuth redirect URI for the driver PWA:
  `https://driver.bayblaze.net/auth/google/callback` in production and
  `http://localhost:5173/auth/google/callback` for local Vite development when
  testing Google login.
  The production URI must also be present in the Google Cloud OAuth web
  client's Authorized redirect URIs; otherwise Google returns
  `redirect_uri_mismatch` even when `bayblaze-api` allows the callback.
- Server-only driver auth, Resend, Firebase Admin, commerce/order runtime, and
  routing integration variables belong in `bayblaze-api`. Never expose these
  through `VITE_` frontend variables.
- OVHcloud VPS SSH from this workstation:
  `ssh -i ~/.ssh/codex_vps_ed25519 ubuntu@40.160.239.20`.
- The production runtime is the consolidated `bayblaze-api` deployment under
  `/opt/bayblaze/bayblaze-api`; the driver app should not target or document a
  separate commerce service.

## Local Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## UI Primitive Layer

Reusable BayBlaze React + Tailwind primitives live in `src/components/ui`.
Shared brand tokens live in `src/index.css` as `--bb-*` variables with Tailwind
v4 `@theme` entries. Prefer these primitives and tokens for new driver UI
instead of repeating raw color, shadow, radius, input, button, card, badge,
empty/loading/error, metric, order-card, or bottom-nav class stacks.

## June 2026 PWA Refresh and Delivery Lifecycle Contract

- The installed driver PWA must not rely on stale cached route/order state. A
  clocked-in driver should sync the delivery queue on app open, focus, online,
  visibility change, and periodically while active.
- When API-synced driver queue data updates, reconcile any open
  `selectedDelivery` object against the fresh queue entry by order ID/reference
  rather than keeping an old React object.
- Production service-worker updates activate immediately with `skipWaiting`,
  claim open clients, and reload an already-controlled app on
  `controllerchange`. The browser checks for deployments on startup, focus,
  reconnect, page restore, visibility changes, and every minute while open.
- Online navigations are network-first so a Vercel deployment is preferred over
  the cached app shell. The most recent successful navigation remains available
  as an offline fallback. Vercel must not cache the generated driver service
  worker, manifest, root document, or `index.html`.
- The Add items to box step is the business transition to `out_for_delivery`.
  The button should not merely advance local UI state; it must log the
  `out_for_delivery` delivery attempt before moving to the drive step.
- `bayblaze-api` should forward `out_for_delivery`, `completed`, and
  `cancelled` to Medusa. Only `completed` and `cancelled` are terminal and
  should rescore/remove completed queue stops.

## Legacy PWA Cache Migration

- The active production service worker is
  `/driver-service-worker-v2.js`.
- `/sw.js` is intentionally retained as a retirement worker for the oldest
  VitePWA-generated installations that used the default service-worker URL. It
  clears legacy Cache Storage entries, unregisters itself, and navigates clients
  back to the network.
- `/driver-service-worker.js` is intentionally retained as a retirement
  worker for installations that are still controlled by the original
  service worker. It clears legacy Cache Storage entries, unregisters the
  original registration, and navigates clients back to the network.
- Do not reuse `/driver-service-worker.js` for the active PWA until all
  legacy installations can reasonably be considered retired.
- Active worker registration uses `updateViaCache: "none"` and checks for
  updates on startup, focus, reconnect, page restore, visibility changes,
  and once per minute while open.

## October 2026 Frontend Configuration Refresh

- Production and preview Vercel backend configuration was refreshed after the
  OVHcloud migration. `VITE_BAYBLAZE_API_URL=https://api.bayblaze.net`. The browser authenticates
  with BayBlaze account sessions; do not add the shared backend service token
  to this Vite app.
- Redeploy after Vercel environment changes. Service-token synchronization and
  browser session recovery are separate concerns; old account sessions may
  require a fresh sign-in after the backend signing secret changes.

## Shared Vehicle Registry

- Vehicles are administered in BayBlaze Admin through `bayblaze-api` and stored
  in the API's unified `bayblaze-isochronos` Firestore registry. The retired
  `bayblaze-driver` Firestore project is not read by the PWA or inventory proxy.
- Driver vehicle selection still uses `/v1/driver/me/vehicles/available` and
  `/v1/driver/me/vehicles/link`. Only active unlinked vehicles are offered.
  Linking and clock-in enforce ownership and profile state transactionally.
- Existing vehicle IDs, including V01, remain unchanged. Clock-out releases the
  vehicle for another driver and clears vehicle selection; stock stays assigned
  to the physical vehicle until Inventory moves it through the API.

## October 2026 Role-Only Account Authorization

- Every enabled universal account can use customer features. Staff privileges
  are explicit `roles: ["admin", "driver", "inventory"]` subsets; ordinary
  customers have `roles: []`. `disabled` remains the account-wide access gate.
- Authorization badges (`customer` / `employee`) are retired. Do not read,
  write, display, or require them. Removing staff roles leaves customer access.
- API middleware re-reads account permissions on requests, so revoking a role
  does not depend on an old session expiring. Existing signed sessions remain
  compatible; new sessions and account responses omit badges.
