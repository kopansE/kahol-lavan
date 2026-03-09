# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kahol-Lavan is a peer-to-peer parking spot sharing platform for Israel. It is a monorepo with three parts:
- `/frontend` — React 18 + Vite web app
- `/mobile` — React Native + Expo mobile app (iOS & Android)
- `/supabase` — Supabase Edge Functions (Deno/TypeScript) + PostgreSQL migrations

The UI language is Hebrew (RTL). String literals in UI components will often be in Hebrew.

## Commands

### Frontend (`/frontend`)
```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Vitest (uses React Testing Library + MSW)
```

### Mobile (`/mobile`)
```bash
npm start          # Start Expo dev server
npm run android    # Start on Android
npm run ios        # Start on iOS
```

### Supabase Edge Functions (`/supabase`)
```bash
supabase link --project-ref <ref>   # Link to project
supabase functions deploy            # Deploy all functions
supabase functions deploy <name>     # Deploy single function
```

## Architecture

### Data Flow
Both frontend and mobile call Supabase Edge Functions via HTTP fetch with a `Bearer` JWT token obtained from `supabase.auth.getSession()`. The frontend accesses the Supabase URL via `import.meta.env.VITE_SUPABASE_URL`; the mobile accesses it via `@env` (react-native-dotenv) or `expo-constants` (`app.config.js` extra fields).

### Pin State Machine
The core domain object is a `pin` (parking spot marker). States:
- `waiting` — user placed a pin (about to leave)
- `active` — user confirmed they are leaving (visible to others)
- `reserved` — another user reserved this spot
- `published` — future/scheduled departure (visible for pre-booking)

### Frontend (`/frontend/src`)
- `App.jsx` — root component; manages all global state (own pin, others' pins, reserved pins, published pins). Calls edge functions directly via fetch.
- `supabaseClient.js` — single Supabase client instance
- `contexts/StreamChatContext.jsx` — wraps Stream Chat client init
- `contexts/ToastContext.jsx` — global toast notifications
- `utils/parkingZoneUtils.js` — reads `parking_zones.json` to determine Israeli parking zone from GPS coordinates
- Components are in `src/components/`, named to match their feature (e.g., `ParkingDetailModal`, `OwnParkingDetailModal`, `ReservedParkingDetailModal`, `PublishedParkingDetailModal`)

### Mobile (`/mobile/src`)
- `App.js` — root; handles auth state, deep link OAuth callbacks, React Navigation stack
- `src/config/supabase.js` — Supabase client instance
- `src/utils/edgeFunctions.js` — centralized wrapper for all edge function HTTP calls (includes token validation/refresh logic via `ensureValidToken`)
- `src/utils/geocoding.js` — geocoding utilities
- `src/utils/parkingZoneUtils.js` — same parking zone logic as frontend
- `src/contexts/StreamChatContext.jsx` — Stream Chat provider
- `src/contexts/ToastContext.jsx` — toast notifications
- Screens in `src/screens/`, components in `src/components/`, mirroring frontend structure

### Supabase Edge Functions (`/supabase/functions`)
- All functions are Deno TypeScript using `serve` from `deno.land/std`
- `_shared/auth-utils.ts` — shared helpers used by every function: `authenticateUser`, `createSupabaseAdmin`, `createSupabaseClient`, `handleCorsPreFlight`, `errorResponse`, `successResponse`
- `_shared/rapyd-utils.ts` — Rapyd payment API helpers
- Each function has its own `deno.json` (import map) and `index.ts` entry point
- Functions with `verify_jwt = false` in `config.toml` are called by QStash (webhooks), not directly by users

### Database Schema
The authoritative database schema is in `.cursor/context/db-schema.sql`. Key tables: `pins`, `user_profiles`, `users`, `scheduled_leaves`, `future_reservations`, `chat_sessions`, `pending_timers`.

### External Services
- **Supabase** — auth, database, realtime, edge functions
- **Stream Chat** — real-time messaging between parking owner and seeker
- **Rapyd** — wallet and payment processing
- **Google Maps API** — geocoding and maps (mobile); Nominatim (OpenStreetMap) used for reverse geocoding in frontend
- **QStash (Upstash)** — scheduled job delivery for timers and scheduled departures
- **EAS (Expo Application Services)** — mobile builds

### Deployment
- Frontend: Firebase Hosting, deployed via GitHub Actions (`.github/workflows/`)
- Mobile: EAS Build (`eas.json` profiles: `development`, `preview`, `production`)
- Backend: `supabase functions deploy`

### Edge Functions Inventory (`/supabase/functions/`)
User-facing (JWT required):
- `save-pin`, `activate-pin`, `deactivate-pin` — pin lifecycle
- `reserve-parking`, `cancel-in-chat`, `approve-in-chat`, `extend-in-chat` — reservation flow
- `schedule-leave`, `cancel-scheduled-leave`, `handle-scheduled-leave` — scheduled departures
- `cancel-future-reservation` — future reservation management
- `create-chat-channel`, `get-user-channels`, `get-stream-token` — Stream Chat
- `get-active-pins`, `get-user-profile`, `get-wallet-balance` — data fetching
- `get-pending-notifications` — notification polling
- `setup-payment-method`, `complete-payment-setup` — Rapyd payment onboarding
- `update-user-car-data`, `update-car-data` — profile/car info
- `geocode-address`, `get-street-geometry`, `places-autocomplete` — geo utilities
- `get-user-profile`, `handle-redirect` — misc

QStash webhooks (`verify_jwt = false`):
- `schedule-approval-timer`, `handle-timer-expiration` — timer callbacks

### Mobile Screens & Components
Screens (`mobile/src/screens/`): `MainScreen`, `LoginScreen`, `ChatChannelListScreen`, `ChatThreadScreen`, `SettingsScreen`, `WalletScreen`, `ReportScreen`, `ReportsScreen`

Components mirror frontend (`mobile/src/components/` ↔ `frontend/src/components/`):
`MapContainer`, `ParkingDetailModal`, `OwnParkingDetailModal`, `ReservedParkingDetailModal`, `PublishedParkingDetailModal`, `PinConfirmationModal`, `SideMenu`, `SearchBar`, `ChatButton`, `ChatActionButtons`, `ChatTimer`, `ReservationNotification`, `CarDataBanner`, `CarDataFormModal`, `PaymentSideMenu`, `LeavingParkingButton`, `NotLeavingParkingButton`, `ReservedParkingButton`, `LoadingSpinner`

Frontend-only components: `CancelReservationModal`, `ScheduleLeavePage`, `WalletPage`, `SettingsPage`, `ReportPage`, `ReportsPage`, `UserProfileBar`, `LoginScreen`, `ChatChannelList`, `ChatThread`

## Key Patterns & Gotchas

### Adding a new edge function call (mobile)
All edge function calls go through `mobile/src/utils/edgeFunctions.js`. Add new calls there using the `ensureValidToken` wrapper — never call edge functions directly from screens/components in mobile.

### Adding a new edge function call (frontend)
Frontend calls edge functions directly via `fetch` from `App.jsx` or the relevant component. Use `supabase.auth.getSession()` to get the token.

### Parallel changes (mobile ↔ frontend)
Most features exist in both apps. When changing business logic, check if the same change is needed in the counterpart. Components are named identically across both apps.

### Database changes
Schema is authoritative at `.cursor/context/db-schema.sql`. Update it when adding migrations.

### Hebrew / RTL
All user-facing strings are Hebrew. Use `writingDirection: 'rtl'` in mobile styles and `direction: rtl` in CSS. Do not translate existing Hebrew strings unless asked.
