# BayBlaze Driver

BayBlaze Driver is a mobile-first PWA for delivery drivers handling BayBlaze
local delivery routes. It focuses on quick phone workflows for driver sign-in,
profile setup, vehicle linking, clock state, route queues, delivery execution,
proof-of-delivery uploads, and assignment notifications.

## Highlights

- React, TypeScript, Vite, Tailwind CSS, and PWA support.
- Universal BayBlaze account sign-in for driver access.
- Driver onboarding and profile setup.
- Vehicle linking, clock-in/clock-out, and live location update workflows.
- Delivery queue and current-stop UI.
- Delivery attempt logging, photo capture, invoice/label reprint requests, and
  push notification registration through BayBlaze API.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Repository Notes

The driver browser app treats BayBlaze API as the secure workflow backend. It
does not include production service credentials, Firebase Admin keys, email
provider keys, routing secrets, or direct commerce tokens.
