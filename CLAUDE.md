# CLAUDE.md — KrishiSetu

This file provides Claude with full project context, conventions, and rules for the KrishiSetu codebase.
Read this before making any changes.

---

## Project Overview

**KrishiSetu** is a web platform that connects Indian farmers with agricultural labour managed by supervisors.
The name means "Agriculture Bridge" in Hindi/Marathi.

- **Purpose**: Digitise labour booking, attendance tracking, and farm-to-supervisor coordination for rural India.
- **Target users**: Farmers (rural, often low digital literacy), Supervisors, Admins
- **Deployment**: Vercel
- **Primary region**: Maharashtra, India

---

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Frontend       | React (Vite)                        |
| Styling        | Tailwind CSS + inline CSS-in-JS     |
| Database       | Firebase Firestore                  |
| Authentication | Firebase Auth                       |
| Maps           | Google Maps JavaScript API          |
| Animations     | Framer Motion                       |
| Toasts         | react-hot-toast                     |
| Icons          | lucide-react                        |
| Email          | EmailJS (`@emailjs/browser`)        |
| Hosting        | Vercel                              |

---

## Project Structure

```
src/
├── components/
│   ├── Homepage.jsx          # Public landing page
│   ├── Login.jsx             # Shared login page
│   ├── Register.jsx          # Farmer registration
│   └── dashboards/
│       ├── FarmerDashboard.jsx
│       ├── SupervisorDashboard.jsx
│       └── AdminDashboard.jsx
├── firebase.js               # Firebase config + exports
├── App.jsx                   # Router root
└── main.jsx                  # Vite entry
```

---

## User Roles

### 1. Farmer
- Self-registers via `/register`
- Can request labour with date, time slot, labour count, farm address, map pin
- Sees available labour count in real time before booking
- Views assigned supervisor name and phone number
- Marks individual labourers as present/absent
- Confirms work completion (triggers mismatch check on admin side)

### 2. Supervisor
- Admin-created account; logs in via `/login`
- Sees all incoming farm booking requests on dashboard
- Views farm pin locations on Google Map
- Assigns specific labourers from their team to each booking
- Marks attendance for their own labourers
- Updates labour availability count every night
- Shares live GPS location (visible to admin)
- Confirms work completion from their side

### 3. Admin
- Logs in via `/login` (role detected from Firestore `users` doc)
- Sees all supervisors and their assigned labour teams
- Drills into any supervisor panel to see labour-to-farm assignments
- Receives mismatch alert when farmer and supervisor attendance records differ
- Tracks live GPS location of every supervisor on a map

---

## Firebase Collections

### `users/{uid}`
```js
{
  uid: string,
  name: string,
  phone: string,
  village: string,
  role: "farmer" | "supervisor" | "admin",
  createdAt: Timestamp,
}
```

### `bookings/{bookingId}`
```js
{
  farmerId: string,
  farmerName: string,
  farmerPhone: string,
  village: string,
  farmAddress: string,
  landmark: string,
  labourCount: number,
  timeSlot: "8-12" | "2-6" | "fullday",
  workType: string,
  date: string,             // "YYYY-MM-DD"
  description: string,
  totalCost: number,
  ratePerLabour: number,
  status: "pending" | "assigned" | "completed",
  supervisorId: string | null,
  supervisorName: string | null,
  supervisorPhone: string | null,
  assignedLabour: number,
  assignedLabourIds: string[],
  assignedLabourNames: string[],
  farmerConfirmed: boolean,
  supervisorConfirmed: boolean,
  labourAttendance: { [labourId]: boolean },
  createdAt: Timestamp,
}
```

### `labours/{labourId}`
```js
{
  name: string,
  phone: string,
  supervisorId: string,
  available: boolean,       // updated nightly by supervisor
  createdAt: Timestamp,
}
```

### `supervisorLocations/{supervisorId}`
```js
{
  supervisorId: string,
  lat: number,
  lng: number,
  updatedAt: Timestamp,
}
```

---

## Booking System Rules

1. **First come, first serve** — no reservation holds; bookings are committed immediately.
2. **No cancellation** — once submitted, a booking cannot be cancelled by the farmer.
3. **Labour managed by supervisor only** — farmers cannot directly contact or select labourers.
4. **Slot overlap prevention** — a labourer assigned to `fullday` cannot be assigned to `8-12` or `2-6` on the same date, and vice versa.
5. **Availability calculation** — `getAvailableCount(date, slot)` subtracts busy labour IDs from the total available pool before showing the count to the farmer.
6. **Attendance verification** — both farmer AND supervisor must confirm for a booking to move to `completed` status.
7. **Mismatch detection** — if `farmerConfirmed !== supervisorConfirmed` after both sides submit, admin sees a mismatch flag.

---

## Pricing

| Slot       | Time              | Rate per Labour |
|------------|-------------------|-----------------|
| Morning    | 8:00 AM – 12:00 PM | ₹300            |
| Afternoon  | 2:00 PM – 6:00 PM  | ₹300            |
| Full Day   | 8:00 AM – 6:00 PM  | ₹600            |

`totalCost = labourCount × ratePerLabour`

---

## Design System — Evergreen + Earth Palette

All UI must follow this colour system. Never use neon greens, dark backgrounds, or unrelated palettes.

### Primary Evergreen (Farmer / Admin)
| Token        | Hex       | Usage                                      |
|--------------|-----------|--------------------------------------------|
| Deep Forest  | `#1b4332` | Main headings, footer background, Admin    |
| Emerald      | `#2d6a4f` | Primary buttons, links, Farmer theme       |
| Sage         | `#40916c` | Gradient mid-stops                         |
| Leaf         | `#52b788` | Gradient ends, hero accents                |
| Mint         | `#d8f3dc` | Badges, Farmer highlights, card tints      |
| Mint Light   | `#f4fdf6` | Section backgrounds, card tints            |
| Mint Border  | `#b7e4c7` | Borders, dividers                          |

### Secondary Earth (Supervisor)
| Token        | Hex       | Usage                                      |
|--------------|-----------|--------------------------------------------|
| Saddle Brown | `#774936` | Supervisor headings, buttons               |
| Clay         | `#fde8d8` | Supervisor card backgrounds                |
| Clay Border  | `#f4c0a0` | Supervisor card borders                    |

### Neutrals
| Token        | Hex       | Usage                                      |
|--------------|-----------|--------------------------------------------|
| White        | `#ffffff` | Card surfaces                              |
| Ghost White  | `#f9fafb` | Body/page background                       |
| Charcoal     | `#1a1a1a` | Body text (max contrast for sunlight)      |
| Muted        | `#5c7a6b` | Subtitles, labels, secondary text          |
| Border       | `#e8f5e9` | Subtle structural borders                  |

### Status
| State     | Colour    |
|-----------|-----------|
| Pending   | `#f59e0b` (Amber)  |
| Assigned  | `#2d6a4f` (Emerald)|
| Completed | `#6366f1` (Indigo) |
| Error/Red | `#dc2626`          |

---

## Component Conventions

### Buttons
```jsx
// Primary action (Farmer)
background: linear-gradient(135deg, #2d6a4f, #1b4332)
color: #ffffff
border-radius: 50px (pill) or 12px (card-level)
box-shadow: 0 4px 18px rgba(45,106,79,0.35)

// Supervisor primary
background: #774936

// Outline
border: 2px solid #2d6a4f, color: #2d6a4f, background: transparent
```

### Cards
- Background: `#ffffff`
- Border: `1px solid #e8f5e9`
- Border-radius: `16px`
- Box-shadow: `0 2px 10px rgba(27,67,50,0.05)`
- Hover: lift `-2px` + deeper shadow

### Inputs / Textareas
- Background: `#f9fafb`
- Border: `1.5px solid #e8f5e9`
- Focus border: `#2d6a4f` + `box-shadow: 0 0 0 3px #d8f3dc`

### Typography
- Font family: `'Poppins', 'Segoe UI', sans-serif`
- Page titles: `fontWeight: 800, color: #1b4332`
- Section subtitles: `fontWeight: 500, color: #5c7a6b`
- Body: `color: #1a1a1a`

---

## Animations & Motion

- Use **Framer Motion** for page transitions, card entrances, and button interactions.
- Page tab transitions: `initial={{ opacity:0, y:20 }}` → `animate={{ opacity:1, y:0 }}`
- Card hover: `whileHover={{ y: -2 }}`
- Button tap: `whileTap={{ scale: 0.97 }}`
- Sidebar entrance: `initial={{ x: -80, opacity:0 }}`
- Toasts via **react-hot-toast**, styled with Poppins font and mint border.

---

## Map Integration

- Use **Google Maps JavaScript API** with `@react-google-maps/api` or vanilla JS loader.
- Farmers drop a pin (`AdvancedMarkerElement`) to set `farmLat` / `farmLng` on their booking.
- Supervisors see all pending farm pins on a single map view.
- Admins see supervisor GPS dots (from `supervisorLocations` collection) in real time using `onSnapshot`.
- Map style: light, minimal — use a custom style that mutes roads and emphasises green land areas.

---

## EmailJS (Contact Form)

Template variables expected:
```
{{from_name}}   — sender name
{{from_email}}  — sender email
{{user_role}}   — Farmer | Supervisor | Admin | Other
{{message}}     — message body
```

Credentials live in `.env`:
```
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

---

## Environment Variables

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_MAPS_API_KEY=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

Never hardcode any of these values. Always read from `import.meta.env.VITE_*`.

---

## Routing (React Router v6)

```jsx
<BrowserRouter>
  <Routes>
    <Route path="/"         element={<Homepage />} />
    <Route path="/login"    element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/farmer"   element={<FarmerDashboard />} />
    <Route path="/supervisor" element={<SupervisorDashboard />} />
    <Route path="/admin"    element={<AdminDashboard />} />
  </Routes>
</BrowserRouter>
```

- After login, redirect based on `userData.role` from Firestore.
- All dashboard routes guard with `auth.currentUser`; redirect to `/login` if null.
- Use `useNavigate()` declared at **component top level** — never inside event handlers.

---

## Key Business Logic

### `getAvailableCount(date, slot)`
1. Collect all bookings where `status === "assigned" || "completed"` AND `date === checkDate`.
2. For each, check slot overlap: same slot OR either side is `fullday`.
3. Collect all `assignedLabourIds` from overlapping bookings into a `Set`.
4. Return `allLabours.filter(l => l.available && !busySet.has(l.id)).length`.

### Completed Booking Detection
A booking is **fully completed** when:
```js
booking.farmerConfirmed === true && booking.supervisorConfirmed === true
```

### Attendance Mismatch
Flag for admin when:
```js
booking.farmerConfirmed !== booking.supervisorConfirmed
// after a reasonable time window (e.g. 24h after work date)
```

---

## Do's and Don'ts

### Do
- Always use Poppins font across all components.
- Always read Firebase state with `onSnapshot` (real-time) not `getDocs` (one-shot) for live dashboards.
- Always validate form fields before calling Firebase — show `toast.error()` for missing fields.
- Keep the Evergreen + Earth palette consistent everywhere.
- Use `motion.button` with `whileHover` and `whileTap` on every interactive button.
- Show loading spinners on all async actions.

### Don't
- Don't use dark backgrounds (`#060d08`, `#0a1410`, etc.) — the theme is light Evergreen.
- Don't use neon greens (`#4ade80`) — use Emerald (`#2d6a4f`) instead.
- Don't call `useNavigate()` inside `onClick` handlers — declare at component top.
- Don't allow farmers to cancel bookings — the system has no cancellation.
- Don't let farmers select more labourers than `availableNow`.
- Don't store API keys or Firebase config directly in source files.
- Don't use `getDocs` for data that needs to update live on the dashboard.
- Don't use `localStorage` or `sessionStorage` — not supported in the deployment environment.

---

## Accessibility Notes

- All buttons must have readable colour contrast (WCAG AA minimum).
- Use `aria-label` on icon-only buttons.
- Input fields must have associated `<label>` elements.
- Target touch areas minimum 44×44px for mobile (farmers may use phones in fields).
- Keep font sizes ≥ 13px for body text; ≥ 11px for badges/labels.

---

## Deployment (Vercel)

- Build command: `vite build`
- Output directory: `dist`
- All `VITE_*` env vars must be set in Vercel project settings.
- Firebase rules must allow authenticated reads/writes for the correct roles.
- Google Maps API key must have HTTP referrer restrictions set to the Vercel domain.

---

## Hackathon Context

KrishiSetu was built for **Innovation Hackathon 2025**, focused on AgriTech solutions for rural Maharashtra.
The platform solves the unorganised, phone-call-based labour hiring system by bringing transparency, GPS accountability, and dual-confirmation attendance to the agricultural sector.