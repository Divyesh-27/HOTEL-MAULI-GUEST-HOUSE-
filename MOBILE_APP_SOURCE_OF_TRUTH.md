# HOTEL MAULI GUEST HOUSE - MOBILE APP SOURCE OF TRUTH

This document describes the ACTUAL currently implemented behavior of the desktop application to serve as a functional specification for the upcoming Android mobile app design.
All developer mode features, test utilities, and dummy data generators have been excluded as requested.

============================================================
1. APPLICATION ARCHITECTURE
============================================================
- **Application Name & Version:** HOTEL MAULI GUEST HOUSE v1.1.0 (Desktop)
- **Architecture:** Electron + React (SPA), local-first with background cloud synchronization.
- **Main Libraries:** React, Zustand (State Management), Tailwind CSS (Styling), Supabase JS Client, React Signature Canvas (Digital Signatures).
- **State Management:** Zustand with custom Electron storage adapter (`mauli-guest-house-storage`).
- **Local Persistence:** Local JSON storage via Electron IPC (`mauli-guest-house-storage`).
- **Cloud Database:** Supabase (PostgreSQL).
- **Authentication:** Unauthenticated/local for core ops, but sync requires Supabase availability.
- **Realtime Synchronization:** Background queue-based sync engine (`syncEngine.ts`). Local writes happen first, then pushed to a queue. Desktop always wins on conflict.
- **File/Storage Handling:** Local Base64 for images/signatures, synced to Supabase Storage buckets (`identity-proofs`, `digital-signatures`).
- **PDF/Invoice Generation:** HTML-based generation with `window.print()`.
- **Printing System:** A4 layout generated on-the-fly and passed to browser print dialog.

### Data Segregation
- **LOCAL PERMANENT DATA:** Rooms, Invoice Settings, Admin controls, Staff details.
- **CLOUD DATA:** Real-time mirrors of local data for mobile consumption.
- **TEMPORARY CLOUD DATA:** Bookings and history older than 30 days are automatically deleted from Supabase (Retention cleanup runs daily). **NOTE:** They are NEVER automatically removed locally from the desktop database.
- **SETTINGS DATA:** Invoice Settings, Custom Categories, Custom Bed Types.
- **SUPABASE STORAGE FILES:** Identity proofs (.jpg) and digital signatures (.png) linked to bookings.

============================================================
2. COMPLETE NAVIGATION MAP
============================================================
- **Dashboard:** Room statuses and quick actions. (Default screen).
- **New Registration:** Form for guest check-in and future reservations.
- **Billing:** Active and future guest lists with check-in and checkout billing actions.
- **Calendar:** Month view of reservations and occupied status.
- **History:** Past completed bookings and final bills.
- **Revenue:** Financial metrics (Daily/Monthly/Yearly).
- **Admin Controls:** Room management and Invoice/GST configuration.
- **Staff & Salary:** Staff attendance, advances, and salary logs.

============================================================
3. DASHBOARD
============================================================
**Room Statuses & Card Behaviors:**
- **Available (Green):** Room is empty.
- **Occupied (Blue):** Clicking takes user to the Billing screen. Edit button (Pencil icon) opens Guest Details Modal for editing.
- **Reserved (Purple):** Clicking prompts: "Convert reservation to Check-In now?".
- **Cleaning (Yellow):** Clicking prompts: "Mark Room as Cleaned and Available?".
- **Maintenance (Red):** Display only.

**Filtering:**
- Users can filter the dashboard to show only specific statuses via top stat cards.

**Room Grouping:**
- Rooms are grouped vertically by Category (AC, Air Cooled, Hall).

============================================================
4. NEW REGISTRATION
============================================================
| FIELD NAME | TYPE | REQUIRED | DEFAULT | OPTIONS/NOTES | STORED AS |
|---|---|---|---|---|---|
| Make Reservation | Checkbox | No | false | Toggles Future Date vs Check-In | `isReservation` |
| Guest Full Name | Text | Yes | '' | | `guestName` |
| Mobile Number | Tel | Yes | '' | | `mobile` |
| Occupation | Text/Dropdown | No | '' | Business, Job/Service, Agriculture, Freelancer, Self Employed, Student, Homemaker, Retired, Unemployed, Other | `occupation` |
| Full Address | Textarea | Yes | '' | | `address` |
| Count (Persons) | Number | Yes | '' | Min 1 | `persons` |
| Other Persons | Text | No | '' | Names of other guests | `otherPersons` |
| Age | Number | No | '' | Max 120 | `age` |
| Identity Proof Type | Text/Dropdown | No | '' | Aadhaar Card, Driving Licence, PAN Card, Voter ID, Passport, Other | `identityProofType` |
| Car No. | Text | No | '' | Uppercase | `carNo` |
| Car Model | Text | No | '' | | `carModel` |
| Coming From | Text | No | '' | | `coming` |
| Going To | Text | No | '' | | `going` |
| Check-In / Res. Date| DateTime | Yes | Current Time | | `checkIn` |
| Days | Number | No | 1 | Min 1 | `days` |
| Select Room(s) | Multi-Select | Yes | [] | Overlap protection prevents double booking | `roomNos` |
| Identity Proof | Image | No | '' | Captured via webcam | `identityProof` (Base64) |
| Advance Paid | Number | No | 0 | | `advance` |
| Advance Mode | Dropdown | No | 'Cash' | Cash, UPI, Card, Other | `advancePayMode` |
| Advance Note | Text | No | '' | Transaction ID etc. | `advanceNote` |
| Discount | Number | No | 0 | Can auto-set for AC to Non-AC | `discount` |
| Discount Reason | Dropdown | No | 'Normal'| Normal, AC to Non AC, Corporate, Long Stay, Staff, Custom | `discountReason` |

**Special Behaviors:**
- **AC → Non-AC Conversion:** Automatically applies a ₹300 discount (if AC room) or ₹200 discount (if Non-AC) if clicked.
- **Keyboard Navigation:** Enter key moves focus to the next logical input field.
- **Advance Receipt:** Automatically prompts print if Advance > 0.

============================================================
5. ROOM SELECTION & AVAILABILITY
============================================================
- Rooms are loaded dynamically based on the selected Check-In date and Days.
- `getAvailableRoomsForPeriod` checks exact date/time overlap against existing bookings and reservations.
- Selected rooms sum their rents to display a "Total Rent: ₹X/day".
- Categories and Bed Types are displayed on each room card.

============================================================
6. BOOKING / RESERVATION LIFECYCLE
============================================================
- **Reservation:** `isReservation: true`. Blocks dates.
- **Check-In:** Converts reservation to active booking (or direct check-in). Room becomes 'Occupied'.
- **Billing:** Active bookings are settled on the Billing screen.
- **Checkout:** Final bill generated. Booking moved to `history`. Room status set to 'cleaning'.
- **Cleaning:** Staff cleans room. Dashboard click resets to 'Available'.
- **Maintenance:** Admin override for broken rooms.

============================================================
7. BILLING
============================================================
- **Views:** Toggle between 'Active' and 'Future' (Reservations).
- **Table Data:** Room No, Guest Name, Mobile, Check-In Date, Advance Paid.
- **Actions:** 
  - **Details:** View/Edit guest information via `GuestDetailsModal`.
  - **Check In:** For future reservations.
  - **Bill:** Opens `BillingModal` for final settlement.

============================================================
8. GST SYSTEM
============================================================
- GST can be globally enabled/disabled in Admin settings.
- Can be toggled per-invoice during billing.
- Calculation logic:
  - If global GST enabled, accommodation GST applies to `Base Room Rent` (Rent - Discount).
  - Configurable slabs dictate percentage (e.g., <1000 = 0%, 1001-7500 = 12%, >7500 = 18%).
- Advance receipts and Final Bills display GSTIN dynamically based on settings.

============================================================
9. DISCOUNTS & CUSTOM CHARGES
============================================================
- **Discounts:** Subtracted from the base room rent. Can hide the discount row entirely on the printed invoice.
- **Extra Charges:** Appended to the final total. Can be 'Extra Bed' or 'Custom' descriptions.

============================================================
10. INVOICE / RECEIPT SYSTEM
============================================================
- **Advance Receipt:** Generated on Registration (if advance > 0) or added via Billing Modal.
- **Final Bill:** Generated on Checkout.
- **Format:** HTML/CSS based A4 layout. Includes Logo, Proprietor Name, Mobile, Address, GSTIN, Guest Info, Breakup of charges, Manager Signature space.
- Display configuration allows hiding GST breakup or GSTIN.

============================================================
11. CALENDAR
============================================================
- Displays month grid.
- Shows Active Bookings (Blue) and Reservations (Purple) spanning across days.
- Clicking an entry opens the Guest Details Modal.

============================================================
12. HISTORY
============================================================
- Displays past checkouts.
- **Filters:** Search, Date-range.
- **Fields:** Guest Name, Room, Checkout Date, Final Amount.
- **Actions:** View Details (Modal), Re-print Invoice (Stored HTML), Edit historical record, Delete.

============================================================
13. REVENUE
============================================================
- Calculates totals based on History records and Active Booking advances.
- **Metrics:** Total Revenue, Cash, Online (UPI/Card).
- Date-range selectable (Daily/Monthly/Custom).

============================================================
14. ADMIN CONTROLS
============================================================
- **Room Management:** Add/Edit/Delete rooms. Toggle Maintenance mode.
- **Room Properties:** Room Number, Category (AC/Non-AC/Hall), Bed Type, Rent Price.
- **Customization:** Add custom categories and bed types.
- **Invoice Settings:** GSTIN, GST Slabs, Display toggles.

============================================================
15. STAFF & SALARY
============================================================
- Manage Staff (Name, Role, Base Salary).
- Log Attendance, Advance Payments, and Salary disbursements.

============================================================
17. ALL POPUPS / MODALS / DIALOGS
============================================================
- **GuestDetailsModal:** Triggered from Dashboard/Billing/Calendar. Allows full editing of guest info, dates, and rooms.
- **BillingModal:** Triggered from Billing. Handles final checkout math, additional advances, GST toggles, and printing.
- **Browser Native:** Confirms for Check-In, Deletion, and Checkout.

============================================================
18. COMPLETE DATA MODEL
============================================================
**BOOKING / HISTORY RECORD**
- `id` (UUID, Primary)
- `billNo`, `billDate` (Sequential daily numbering)
- `guestName`, `mobile`, `address`, `persons`, `otherPersons`, `age` (Guest Demographics)
- `coming`, `going`, `occupation`, `identityProofType`, `carNo`, `carModel` (Travel/Identity Info)
- `checkIn`, `checkoutDate` (ISO Dates)
- `days` (Number)
- `roomNos` (Array of Strings)
- `advance`, `advancePayments` (Financials)
- `discount`, `discountReason`, `discountNote`, `extras` (Adjustments)
- `identityProof`, `digitalSignature` (Local Base64)
- `identityProofUrl`, `digitalSignatureUrl` (Supabase URLs)
- `updated_at`, `version`, `source` (Sync Metadata)

**ROOM**
- `roomNo`, `category`, `bedType`, `rent`

============================================================
19. SUPABASE & SYNC
============================================================
- **Sync Engine:** `src/lib/syncEngine.ts` runs asynchronously.
- **Data Flow:** DESKTOP → SUPABASE (Upserts/Deletes).
- **Conflict Handling:** Desktop is the absolute source of truth (`source === 'desktop'` overwrites cloud).
- **Mobile Read Flow:** Mobile will fetch from Supabase.
- **Retention:** 30-day cron-like script in desktop clears old Supabase data. Local data remains permanent.

============================================================
20. MOBILE REQUIREMENTS DERIVED FROM FUNCTIONALITY
============================================================
- **MUST HAVE ON MOBILE:** Dashboard (View Status), New Registration, Billing/Checkout, Calendar, History Viewer, Sync Status.
- **OPTIONAL ON MOBILE:** Revenue Charts, Staff Management.
- **DESKTOP ONLY:** Admin Invoice/GST Settings, Printing hardware integration, Deep Offline Database management.

============================================================
21. UI DESIGN INVENTORY
============================================================
- **Style:** Clean, Modern, Card-based, slightly rounded corners (rounded-xl).
- **Colors:** 
  - Primary: Deep Blue/Indigo
  - Available: Green
  - Occupied: Blue
  - Reserved: Purple
  - Cleaning: Yellow/Orange
  - Maintenance: Red
- **Inputs:** Standard outlines, floating labels in some modals, prominent buttons.

============================================================
22. SCREEN → ACTION → DATA MATRIX
============================================================
| SCREEN | ACTION | DATA WRITTEN | LOCAL EFFECT | SUPABASE EFFECT |
|---|---|---|---|---|
| Registration | Save | `bookings` | Creates Booking | UPSERT to `bookings` |
| Dashboard | Click Cleaning | `roomStatus` | Removes status | DELETE from `room_statuses` |
| Billing | Confirm Bill | `history`, `bookings`, `roomStatus` | Moves to history, clears booking, sets cleaning | UPSERT `history`, UPSERT `room_statuses` |
| Admin | Save Room | `rooms` | Updates array | UPSERT `rooms` |

============================================================
23. FINAL MOBILE HANDOFF
============================================================
This document serves as the absolute source of truth for the Lodge Manager Desktop v1.1.0 functionality, minus developer tools, specifically prepared for the Android application design phase.

[IMPLEMENTED] - All functionality described above is actively running in the provided desktop source code.
