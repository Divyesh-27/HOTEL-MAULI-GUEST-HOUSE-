# HOTEL MAULI GUEST HOUSE — Desktop & Mobile Manager

> **Version:** 1.2.0  
> **Author:** Divyesh Jaiswal  
> **Stack:** React 18 · Vite 5 · Electron 39 · Tailwind CSS 3 · Zustand 5 · SQLite (sql.js) · Supabase (optional cloud sync) · Capacitor 8 (Android)

A unified Electron desktop and Capacitor mobile application for managing daily operations, bookings, billing, GST invoicing, staff tracking, and revenue analytics for Hotel Mauli Guest House.

---

## Features (Current Source)

### 1. Dashboard (`src/components/sections/Dashboard.tsx`)
- Real-time room status overview: **Occupied**, **Reserved**, **Available**, **Cleaning**, **Maintenance** counts.
- Interactive room grid grouped by category (AC, Air Cooled, Hall, custom categories).
- Click-to-bill occupied rooms, click-to-check-in reserved rooms, click-to-clear cleaning rooms.
- Filter by room status type.
- Guest details modal with inline editing from occupied room tiles.

### 2. Registration / Check-In (`src/components/sections/Registration.tsx`)
- Full guest registration form: name, mobile, address, persons, age, occupation, ID proof type, car details.
- Room selection with availability-aware multi-select (checks overlap with existing bookings/reservations for the selected date range).
- Check-in date/time picker with configurable number of days.
- **Reservation mode** toggle (future bookings).
- **Identity proof capture** via webcam or file upload (base64 stored, optionally uploaded to Supabase Storage).
- **Digital signature capture** via signature pad (`react-signature-canvas`).
- **Advance payment** entry with receipt ID, amount, payment mode (Cash/UPI/Card/Other), and note.
- **Advance receipt printing** via Electron's native print preview (`src/utils/printAdvanceReceipt.ts`).
- Extra charges and discount fields with reason selection and invoice visibility toggle.
- Auto-generated day-wise bill numbers.
- Developer mode toggle to unlock additional admin features.

### 3. Billing (`src/components/sections/Billing.tsx`)
- Guest list table with search by name, mobile, or room number.
- **Active / Future toggle** to switch between checked-in guests and future reservations.
- **GST Bill** button opens the full BillingModal for checkout & invoicing.
- **Silent PDF** button generates a PDF invoice directly without opening a modal.
- **Guest Details modal** with edit capability from the billing list.
- **Check-In** action for future reservations.

### 4. Billing Modal / Checkout (`src/components/sections/BillingModal.tsx`)
- Full checkout flow: editable check-in/check-out times, room rent calculations, days, extras, discounts.
- **GST invoice toggle**: per-booking enable/disable for GST.
- **3-slab GST calculation** based on per-room-per-night rate (configurable from Admin):
  - Slab 1: ≤ ₹1000/night → 0% GST
  - Slab 2: ₹1001–₹7500/night → 12% GST (6% CGST + 6% SGST)
  - Slab 3: > ₹7500/night → 18% GST (9% CGST + 9% SGST)
- **Customer GSTIN** field (conditionally shown on invoice).
- **Multiple advance payments** with add-more capability at checkout.
- **Invoice preview** with hotel logo, GSTIN, room-wise breakdown, GST line items, discount rendering.
- **Print** via Electron native print preview.
- **PDF generation** via Electron's `webContents.printToPDF()` saved to `AppData/Billing/`.
- Room auto-set to "cleaning" status after checkout.
- Stores invoice HTML in history for later reprinting.

### 5. History (`src/components/sections/History.tsx`)
- Searchable table of all past checkouts.
- **View Details** modal with all booking information.
- **Edit** historical records inline (updates synced to cloud).
- **Reprint** invoices from stored HTML.
- **View PDF** for previously generated invoices.
- **Download** invoice as PDF.
- **Delete** records with confirmation modal.

### 6. Calendar (`src/components/sections/Calendar.tsx`)
- Visual month-view room calendar matrix.
- Room rows × date columns showing occupancy/reservation status.
- Month navigation (previous/next).
- Color-coded cells: occupied (red), reserved (blue), available (green).
- Click-to-view booking details.

### 7. Revenue (`src/components/sections/Revenue.tsx`)
- Revenue analytics with **Daily / Monthly / Yearly** view modes.
- Cash vs. Online (UPI/Card) breakdown.
- Booking count per period.
- Calculates from both active bookings (advance payments) and completed history (final amounts).

### 8. Staff & Salary (`src/components/sections/Staff.tsx`)
- Add/remove staff members with name, role, and salary.
- **Attendance logging** (mark present).
- **Advance / Salary payment** tracking with dated logs.
- Staff activity log timeline.

### 9. Admin Controls (`src/components/sections/Admin.tsx`)
- **Room management**: Add, edit, delete rooms with room number, category, bed type, rent, floor, description.
- **Room status**: Set rooms to cleaning/maintenance.
- **Custom categories**: Add/remove custom room categories (beyond AC/Air Cooled/Hall).
- **Custom bed types**: Add/remove custom bed types.
- **GST Settings**: Enable/disable GST globally, set GSTIN number, configure all 3 GST slabs (rates, CGST/SGST splits).
- **Invoice display toggles**: Show/hide GSTIN on advance/final invoices, show/hide GST breakup on advance/final invoices.
- **User management**: Create local app users with username, password (SHA-256 hashed), assigned role.
- **Role-based access control**: Admin, Manager, Staff roles with per-section permission grants.
- **Developer mode** toggle.

### 10. Authentication (`src/pages/Login.tsx`)
- Supabase cloud auth (when online and configured).
- Local user auth against app users (hashed password comparison).
- Hardcoded offline fallback credentials for emergency access.
- Role-based section access after login.

### 11. Offline-First Architecture
- **SQLite database** (sql.js WASM) as permanent local storage (`electron/main.cjs`).
- Zustand state persistence via custom `electronStorage` adapter → SQLite key-value table.
- Falls back to `localStorage` when not running in Electron.
- **Auto-save** every 10 seconds.
- **Automatic backup engine** on startup with 7-daily/4-weekly/12-monthly rotation.
- **Legacy data migration** from electron-store JSON files to SQLite.

### 12. Cloud Sync (Supabase — Optional)
- **Queue-based sync engine** (`src/lib/syncEngine.ts`): all mutations go to SQLite first, then background-enqueued to Supabase.
- **Desktop-always-wins** conflict resolution with version numbers and timestamps.
- **Exponential backoff** on failures (5s → 80s max).
- **Checksum-based** deduplication to skip redundant uploads.
- **Realtime subscription** (`src/lib/realtimeSync.ts`) for bookings, rooms, room statuses, staff, staff logs, invoice settings, categories, bed types.
- **Media upload** to Supabase Storage for identity proofs and digital signatures.
- **30-day cloud retention** cleanup for old booking records.
- **Sync diagnostics** in header: Connected/Offline/Synchronizing/Retrying status with last-synced timestamp.

### 13. PDF & Print
- **Native PDF generation** via Electron `webContents.printToPDF()` — no OS print dialog.
- **Print preview** in a separate Electron window.
- **Silent PDF save** from billing list without modal.
- **History PDF viewing/downloading** from stored files.
- PDFs saved to `%AppData%/hotel-mauli-guest-house/Billing/`.

### 14. Dual Architecture (Desktop + Mobile)
- **Desktop**: Electron 39 with full SQLite database, IPC-based state persistence, native PDF/print.
- **Mobile**: Capacitor 8 for Android with touch-optimized views (`src/mobile/`).
- Auto-detection of platform: `Capacitor.isNativePlatform()` in `main.tsx`, window width check in `App.tsx`.
- Shared React codebase, shared Zustand store, shared sync engine.

### 15. UI/UX
- **Dark theme** sidebar with gradient accent.
- **Light/Dark mode** toggle via `next-themes`.
- **Responsive layout** with sidebar navigation.
- **Animations** via `framer-motion`.
- **Shadcn/ui** component library (Radix UI primitives + Tailwind).
- **Sonner** toast notifications.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5.8, Vite 5 |
| Styling | Tailwind CSS 3, shadcn/ui (Radix UI), Framer Motion |
| State | Zustand 5 with persist middleware |
| Desktop | Electron 39, electron-builder |
| Mobile | Capacitor 8, Android |
| Database | sql.js (SQLite WASM) — local, permanent |
| Cloud Sync | Supabase (PostgreSQL + Realtime + Storage) — optional |
| PDF | jsPDF, html2canvas, Electron printToPDF |
| Charts | Recharts |
| Forms | React Hook Form, Zod validation |
| Auth | Supabase Auth + local hashed passwords |

---

## Setup & Installation

### Prerequisites
- **Node.js** v18+ (v24 recommended)
- **npm** (included with Node.js)
- **Git**

### Installation
```bash
# 1. Clone the repository
git clone <repo-url>
cd lodge-manager-main-dekstop

# 2. Install dependencies
npm install
```

### Environment Variables
Create a `.env` file in the project root (one already exists with placeholders):

```env
# Supabase credentials (OPTIONAL — app works fully offline without these)
VITE_SUPABASE_URL="https://your-project-url.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

> **Note:** If Supabase credentials are not set or are placeholders, the app operates in **offline-only mode**. All features work except cloud sync.

### Run Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server only (http://localhost:8080) — for web/browser testing |
| `npm run electron:dev` | Start Vite + Electron concurrently — full desktop app |
| `npm run build` | Production build (Vite → `dist/`) |
| `npm run electron:build` | Full Windows installer build (Vite build + electron-builder → `release/`) |
| `npm run clean` | Remove `dist/`, `release/`, and Vite cache |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

### Electron Dev Mode
```bash
npm run electron:dev
```
This uses `concurrently` to start Vite on port 8080 and then launches Electron pointing to `http://localhost:8080`. The Electron main process is at `electron/main.cjs` with preload at `electron/preload.cjs`.

### Building for Production (Windows Installer)
```bash
npm run electron:build
```
Produces a Windows NSIS installer in the `release/` directory.

### Android (Capacitor)
```bash
npm run build
npx cap sync android
npx cap run android       # Run on connected device/emulator
npx cap open android      # Open in Android Studio
```
See `PROJECT_DOCUMENTATION.md` for detailed Android build instructions.

---

## Project Structure

```
lodge-manager-main-dekstop/
├── electron/
│   ├── main.cjs           # Electron main process (SQLite, IPC, backup engine)
│   └── preload.cjs        # Context bridge (electronAPI)
├── src/
│   ├── main.tsx            # React entry point (platform detection)
│   ├── App.tsx             # Desktop app root (ThemeProvider, Router, Auth)
│   ├── App.css             # App-level CSS
│   ├── index.css           # Global CSS (Tailwind base)
│   ├── components/
│   │   ├── layout/         # Layout, Header, Sidebar
│   │   ├── sections/       # Dashboard, Registration, Billing, BillingModal,
│   │   │                   # Calendar, History, Revenue, Admin, Staff
│   │   ├── modals/         # GuestDetailsModal, InvoicePreviewModal, ConfirmModal
│   │   ├── ui/             # shadcn/ui components (50+ components)
│   │   ├── theme-provider.tsx
│   │   ├── theme-toggle.tsx
│   │   └── NavLink.tsx
│   ├── hooks/              # use-mobile, use-toast, useSync
│   ├── lib/                # supabaseBridge, syncEngine, syncActions,
│   │                       # realtimeSync, utils, uuid
│   ├── mobile/             # Mobile-specific app, components, pages, store
│   ├── pages/              # Index, Login, NotFound
│   ├── store/              # useStore.ts (Zustand store)
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # availabilityUtils, crypto, gstUtils,
│   │                       # pdfUtils, printAdvanceReceipt
│   └── assets/             # mauli-logo.png
├── build/                  # icon.ico for electron-builder
├── dist/                   # Vite build output (generated)
├── public/                 # Static assets (favicon, robots.txt)
├── index.html              # Vite entry HTML
├── vite.config.ts          # Vite config (port 8080, path aliases)
├── tailwind.config.ts      # Tailwind theme config
├── capacitor.config.ts     # Capacitor Android config
├── package.json            # Dependencies & scripts
├── tsconfig.json           # TypeScript config
└── .env                    # Environment variables
```

---

## Data Storage

| Storage | Location | Purpose |
|---------|----------|---------|
| SQLite DB | `%AppData%/hotel-mauli-guest-house/hotel_mauli.db` | All app state (bookings, history, rooms, staff, settings) |
| Backups | `%AppData%/hotel-mauli-guest-house/backups/` | Auto-rotated DB backups |
| Invoice PDFs | `%AppData%/hotel-mauli-guest-house/Billing/` | Generated PDF invoices |
| localStorage | Browser fallback | Used when not running in Electron |

---

## Legacy / Duplicate Files (Cleanup Candidates)

The following files in the project root are temporary build logs, debug scripts, or legacy documentation from past development sessions. They are **not required** for the app to function and can be removed after review:

| File | Notes |
|------|-------|
| `build-error.log` | Old build error output |
| `build-output.txt` | Old build log |
| `build-output2.txt` | Old build log (duplicate) |
| `build-output3.txt` | Old build log (duplicate) |
| `build.txt` | Old build log |
| `build_output.log` | Old build log |
| `build_output_tail.txt` | Old build log (duplicate) |
| `build_output_utf8.log` | Old build log |
| `debug_browser.cjs` | Temporary headless browser debugging script |
| `bun.lockb` | Bun package manager lockfile (project uses npm) |
| `PROJECT_DOCUMENTATION.md` | Legacy Android-only documentation; overlaps with this README |
| `MOBILE_APP_SOURCE_OF_TRUTH.md` | Mobile architecture reference doc (may be outdated) |
| `dist/` contents | Stale Vite build output; regenerated by `npm run build` |

> ⚠️ **Do NOT delete these files yet.** Review them first, then remove when confident they are not needed.

---

## Known Notes

- The Vite dev server runs on **port 8080** (configured in `vite.config.ts`).
- `base: "./"` is set in Vite config for correct asset loading in Electron's `file://` protocol.
- All Zustand selectors that return object literals **must** use `useShallow` from `zustand/react/shallow` to prevent infinite re-render loops. This pattern is used across all section components.
- The Supabase client is initialized only when valid (non-placeholder) credentials are provided in `.env`.
- `Browserslist` data may be outdated; run `npx update-browserslist-db@latest` if warnings appear.
