# University Portal — School Management System (Frontend)

React 19 + Vite + Tailwind CSS v4 frontend for the Django REST backend in
`../backend`. It implements the full user surface of
`school-management-system-blueprint.md`:

- **Auth** — JWT login, one-time account activation (`/activate?token=…`),
  automatic access-token refresh, role-aware navigation & route guards.
- **Student** — dashboard with fee/registration eligibility checklist,
  course registration (available-course reasons, credit counter, drop),
  fees & payments (sandbox simulate + hosted checkout + server-verified
  status), receipts (PDF), published results + GPA, draft/official
  transcript downloads and requests, timetable, announcements, events/RSVP,
  notifications.
- **Lecturer** — my classes, marks entry grid (CA/exam against the active
  grading policy, save draft / submit), attendance per timetable session,
  roster.
- **HOD** — department overview (own department only), offering review,
  results approval.
- **Admin / Finance / Registrar** — students & matricules (issue/re-issue,
  revoke, CSV import with one-time codes), lecturers & user linking,
  academic structure (units → programs → levels, years, semesters with
  open/close registration, courses, program-course mappings, exemptions),
  course offerings & timetable sessions (conflicts, rosters), finance
  (fee schedules, invoice generation/waive, offline payment approvals,
  payment reconciliation), results workflow (approve → publish → lock →
  audited corrections), grading policies & grade bands, transcript
  issuance, reports (+CSV export) and the append-only audit log.

The only backend endpoints not called from the browser are the two payment
**webhooks** (`/api/webhooks/notchpay`, `/api/webhooks/stripe`) — those are
server-to-server provider callbacks by design.

## Run it

Backend first (from `../backend`, see its README):

```powershell
py -3.14 manage.py migrate
py -3.14 manage.py seed_demo
py -3.14 manage.py runserver 127.0.0.1:8000
```

Then the frontend:

```powershell
npm install
npm run dev        # http://localhost:5173
```

Vite proxies `/api` to `http://127.0.0.1:8000` (see `vite.config.js`), so no
CORS setup is needed in development. Demo accounts (password `DemoPass123!`):
`admin@`, `finance@`, `registrar@`, `hod@`, `lecturer@`, `student@` on
`demo.edu` — the login page has one-click fill buttons.

## Configuration (env)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` (dev proxy) | Set to e.g. `https://api.example.edu/api` for a separately hosted API |
| `VITE_UNIVERSITY_NAME` | `University Portal` | Branding shown in the shell/auth pages |

Amounts, deadlines, thresholds and grading rules all come from the API —
nothing about a specific university is hard-coded.

## Scripts

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the production build (port 4173, same API proxy)
- `npm run lint` — ESLint

## Notes

- Design: deep-evergreen + gold academic theme (Fraunces display + Inter),
  responsive sidebar shell, toast notifications, accessible modal dialogs.
- PDFs/CSVs (receipts, transcripts, report exports) are fetched with the
  JWT attached and saved/opened as blobs.
