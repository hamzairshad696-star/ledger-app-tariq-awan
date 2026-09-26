# Ledger — Private Monthly Ledger Management

A private web app for managing monthly payments, advances and month closings.

- **Admin:** Tariq Awan — full control.
- **Viewers:** read-only accounts that can only see the people assigned to them.

It is built with Next.js 14 (React), Node.js and PostgreSQL. Logins use secure, signed, http-only cookies.

---

## Contents

1. [What you need](#1-what-you-need)
2. [Install and run locally](#2-install-and-run-locally)
3. [Environment variables](#3-environment-variables)
4. [Database setup](#4-database-setup)
5. [Logins (Admin and demo Viewer)](#5-logins)
6. [Reset or reload demo data](#6-reset-or-reload-demo-data)
7. [How the monthly ledger works](#7-how-the-monthly-ledger-works)
8. [How advance allocation works](#8-how-advance-allocation-works)
9. [How monthly closing and reopening work](#9-how-monthly-closing-and-reopening-work)
10. [How Viewer permissions work](#10-how-viewer-permissions-work)
11. [Deploy to Vercel + Neon (free link, no domain)](#11-deploy-to-vercel--neon)
12. [Useful commands](#12-useful-commands)
13. [Project structure](#13-project-structure)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What you need

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20.12 or newer** (the LTS version is recommended) | https://nodejs.org |
| PostgreSQL database | 14 or newer | The easiest option is a free **Neon** database (https://neon.tech). No installation is needed. A local PostgreSQL also works. |

The app works on Windows, macOS and Linux.

## 2. Install and run locally

Open a terminal in the project folder (the folder that contains `package.json`) and run:

```bash
# 1. Install dependencies (only needed the first time)
npm install

# 2. Create your settings file from the template
#    Windows (Command Prompt):  copy .env.example .env.local
#    macOS/Linux:               cp .env.example .env.local
#    Then open .env.local and fill in DATABASE_URL, AUTH_SECRET and ADMIN_PASSWORD.

# 3. Generate a secret for AUTH_SECRET and paste it into .env.local
npm run secret

# 4. Create the tables and the Admin account, and load the demo data
npm run setup:demo
#    (or, with no demo data:  npm run db:setup)

# 5. Start the app
npm run dev
```

Open **http://localhost:3000** in your browser.

To run the optimised production version locally instead, use:

```bash
npm run build
npm start
```

## 3. Environment variables

All settings live in `.env.local` locally, or in **Project → Settings → Environment Variables** on Vercel.

| Variable | Required | Example | What it does |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` | PostgreSQL connection string. SSL is used automatically for non-local databases. |
| `AUTH_SECRET` | yes | output of `npm run secret` | Signs login sessions. Must be at least 32 characters. If you change it, everyone is signed out. |
| `ADMIN_USERNAME` | yes | `tariq` | Username of the Admin account created on first setup. |
| `ADMIN_PASSWORD` | yes (first setup) | a strong password, 8+ characters | Password for the Admin account. It is used **only when the Admin account does not exist yet**. After that, change the password inside the app (Settings). |
| `ADMIN_NAME` | no | `"Tariq Awan"` | Display name of the Admin. |
| `DEFAULT_YEAR` | no | `2026` | The year the app opens on. |
| `APP_TIMEZONE` | no | `Asia/Karachi` | Timezone used to decide which month is the "current month". |
| `SEED_DEMO` | no | `false` | If `true`, demo data is loaded during setup or the Vercel build, but only when the database has no people. |
| `APP_TODAY` | no | *(empty)* | **Testing only.** Pretends today is this date (`YYYY-MM-DD`). Leave it empty in real use. |

`.env.local` is never included in the project zip. Keep it private.

## 4. Database setup

`npm run db:migrate` applies `db/schema.sql`. It is safe to run any number of times, because it only creates what is missing. It also makes sure the default year exists.

`npm run db:seed` creates the Admin account from `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_NAME`, if no Admin exists yet.

`npm run db:setup` runs both of the above. `npm run setup:demo` does the same and also loads demo data into an empty database.

These are the main tables:

| Table | Purpose |
|---|---|
| `people` | Sr#, name, father name, status, marital status, split cash, account, monthly amount, joining date, notes |
| `ledger_years` | Years that have been opened (2026, 2027, …) |
| `monthly_ledger` | One row per person per month: the amount due for that month, plus a note |
| `payments` | Regular payments, each linked to a specific person, year and month |
| `advances` | An advance payment: person, date received, total, status (active or cancelled) |
| `advance_allocations` | **Exactly which future month(s) each advance pays, and how much each month gets** |
| `monthly_closings` | Closed or open state per month, plus the permanent closing snapshot |
| `closing_events` | History of every close and reopen, including the reason |
| `users` | The Admin and Viewer accounts (passwords are hashed with bcrypt) |
| `viewer_assignments` | Which people each Viewer may see |
| `audit_log` | Every change made in the app |

## 5. Logins

| Role | Username | Password |
|---|---|---|
| **Admin** | the `ADMIN_USERNAME` you set (default `tariq`) | the `ADMIN_PASSWORD` you set in `.env.local` |
| **Demo Viewer** (created with the demo data) | `viewer.demo` | `Viewer@2026` |

The demo Viewer is assigned to three demo people (Sr# 1, 4 and 5).

Before using the app for real data:

- Change the Admin password in **Settings → Admin password**.
- Delete the demo data (see below), which also removes the demo Viewer.

After five wrong passwords in a row, an account is locked for 15 minutes.

## 6. Reset or reload demo data

**From inside the app (Admin → Settings → Demo data):**

- **Delete all ledger data** removes every person, payment, advance, closing and Viewer account. You must type `DELETE` to confirm. The Admin account and the activity log are kept. Download a backup first if you need one.
- **Load demo data** adds 40 people (25 married, 15 unmarried) with realistic scenarios. These include paid months, partial payments, pending months, inactive people, several advances (including Hamza's March → April + May example) and closed January and February. It also adds the demo Viewer. This only works when the ledger is empty, so delete first to reload it.

**From the command line:** run `npm run db:seed:demo`. This loads demo data if there are no people yet.

**Backups:** use Settings → *Full backup (Excel)* or *Full backup (JSON)*, or download any single table as CSV.

## 7. How the monthly ledger works

Every person has **12 monthly records for each year** (January to December). Adding a year in Settings creates its 12 months for everyone. Each month's amount due starts at the person's monthly amount. You can change it for a single month from the month's detail window.

All calculations live in one place, `src/lib/ledger-calc.js`. The dashboard, the Viewer screens, reports, exports and closings all use it, so every screen shows the same numbers.

**Per person, per month:**

| Value | Meaning |
|---|---|
| Required | The amount due for that month |
| Paid | The total of regular payments recorded **for** that month |
| Covered by advance | The total of *active* advance allocations **into** that month |
| Covered | Paid + covered by advance |
| Pending | Required − covered, but **only for months that have started** (this month or earlier) |
| Not started | Future months with nothing paid. These are *not* counted as pending. |

**Status and colour:**

| Status | Rule | Colour |
|---|---|---|
| Paid | Fully covered, with at least some of it paid directly | Green (blue for the current month) |
| Advance Paid | Fully covered by an advance received in an earlier month | Green, with a ↳ arrow |
| Partially Paid | Some amount received, but less than the amount due | Amber |
| Pending | A month that has started with nothing received | Red |
| Not Started | A future month with nothing received yet | Grey |
| Advance given this month | The person handed over an advance during this month | Purple dot or "+ Advance" |
| N/A | Before the joining date, or the person is inactive with nothing recorded | Blank |

**Totals (per person or for everyone, for the selected year):**

- **Annual total** = sum of amounts due
- **Advance total** = sum of active advance allocations *into* that year's months
- **Pending total** = sum of pending amounts (months that have started only)
- **Net total** = paid + advance total − pending total

**Other rules:**

- **Inactive people** are not charged new dues, but their history stays visible.
- **Payments cannot exceed** what is left to pay for that month. Any extra amount must be recorded as an advance for future months. A fully paid month rejects further payments, which prevents duplicates.
- **Monthly amount changes** can optionally be applied to open months from the current month onward. Past and closed months keep their amounts.

## 8. How advance allocation works

An advance is always linked to the **exact future month(s)** it pays for. It is never a loose balance.

Here is the example from the brief. Hamza's monthly amount is Rs. 10,000. On **15 March 2026** he pays **Rs. 30,000**. The Admin records this in one step (*Add payment → also record an advance*):

- **March:** Rs. 10,000 payment, marked Paid. It also shows "+ Advance Rs. 20,000 for Apr + May".
- **Advance of Rs. 20,000:** split as April 2026 → Rs. 10,000 and May 2026 → Rs. 10,000.
- **April and May:** Advance Paid, each showing "Rs. 10,000 from the advance paid on 15 March 2026".
- **June:** Pending once June starts. It is Not Started before then.

Clicking the advance anywhere opens its detail window. This shows the person, payment date, total, each month it was applied to with the amount, and its status.

**How allocation is chosen.** In the advance form, the Admin either ticks specific months or enters a number of months. The app then fills those months in order, each up to its remaining amount due. The split can be adjusted by hand.

**Checks the server enforces:**

- The allocations must add up **exactly** to the advance total. If they add up to more, it is an over-allocation error. If they add up to less, the unassigned amount is shown.
- Target months must come **after** the month the advance was received.
- Each month can receive at most what it still has left to pay. A fully paid month cannot receive more.
- Closed months cannot receive allocations.

**Cancelling.** An advance is **cancelled**, not deleted, so the history is kept. Its months then go back to Pending or Not Started. An advance cannot be cancelled if the month it was received in, or any month it covers, is closed. Reopen that month first.

## 9. How monthly closing and reopening work

Go to **Admin → Closings**. The screen shows 12 month cards: Closed, Open, Current month, or Not started.

1. **Preview.** Select a month to see its live figures: total people, paid, pending, advance given, total collected and pending amount. Every person's row for that month is listed.
2. **Close.** Click *Close [Month]*, review the summary and confirm. The app saves a **permanent snapshot** of all the figures. From then on, payments, advances, cancellations and amount changes that touch that month are **locked**.
3. **Opening view.** After closing, the *[Next month] opening* tab shows the next month and the two after it. It lists who is **already paid by an earlier advance**, who is already paid directly, and who still needs to pay. For example, after closing March, April opens with Hamza's April and May already marked Advance Paid.
4. **Reopen.** A closed month can be reopened by clicking *Reopen month*. You must give a **reason**. The earlier snapshot and every close or reopen (with who did it, when, and why) stay in the **History** tab.

Future months cannot be closed.

## 10. How Viewer permissions work

The Admin creates Viewers in **Admin → Viewers**. Each Viewer has a username, password, name, active or disabled status, and a list of assigned people.

A Viewer can:

- sign in and see a welcome page with the current month;
- see summary cards (monthly total, advance total, pending total, net total), month-by-month status, and read-only details for each month;
- see advances for **their assigned people only**.

A Viewer can never:

- add, edit or delete anything;
- open Admin pages (they are redirected to their own page);
- call any Admin API (the server returns *403 Forbidden*);
- see an unassigned person, even by changing the ID in the address bar (the server returns *404 Not found*);
- see internal fields such as Admin notes or the activity log.

**How this is enforced.** Every API request re-checks the signed session against the database: the user must exist, be active, have the right role, and hold a current session version. Viewer data queries are always filtered by that Viewer's assignments on the server. Disabling a Viewer, or changing their password, **signs them out immediately**.

**Other security measures:**

- Passwords are hashed with bcrypt.
- Sessions use http-only, SameSite cookies that expire after 10 hours.
- State-changing requests coming from other sites are blocked.
- CSV exports are protected against formula injection.
- Security headers are set, and search engines are told not to index the site.

## 11. Deploy to Vercel + Neon

This gives you a free private link such as `https://tariq-ledger.vercel.app`. **No custom domain is needed.**

### Step 1 — Create the database (Neon)

1. Sign up at https://neon.tech (the free plan is enough) and create a project, for example `tariq-ledger`.
2. On the dashboard, click **Connect** and copy the connection string. It looks like `postgresql://...neon.tech/neondb?sslmode=require`. This is your `DATABASE_URL`.

### Step 2 — Put the code on GitHub

1. Create a free account at https://github.com and a **private** repository, for example `tariq-ledger`.
2. Upload the project files. The simplest way is **Add file → Upload files** and drag in the extracted project folder's contents. Do **not** upload `node_modules`, `.next` or `.env.local`.

### Step 3 — Deploy on Vercel

1. Sign up at https://vercel.com using your GitHub account, then click **Add New → Project** and import the repository.
2. Framework preset: **Next.js** (this is detected automatically). Leave the build settings at their defaults. Vercel automatically runs the `vercel-build` script, which applies the database schema, creates the Admin account and then builds the app.
3. Under **Environment Variables**, add:
   - `DATABASE_URL` — the Neon connection string
   - `AUTH_SECRET` — a long random value (run `npm run secret` on your computer, or use any 48+ character random string)
   - `ADMIN_USERNAME` — `tariq`
   - `ADMIN_PASSWORD` — a strong password
   - `ADMIN_NAME` — `Tariq Awan`
   - `DEFAULT_YEAR` — `2026`
   - `APP_TIMEZONE` — `Asia/Karachi`
   - optionally `SEED_DEMO` — `true`, if you want demo data to try things out first
4. Click **Deploy**. When it finishes, Vercel shows your link, for example `https://tariq-ledger.vercel.app`. Open it and sign in.

**Afterwards:**

- Every change you push to GitHub redeploys automatically.
- To rename the link, go to Vercel → Project → Settings → Domains and edit the `*.vercel.app` name. This is still free.
- Only share the link with people who have a Viewer account. The site is login-only and not indexed by search engines.

## 12. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server at http://localhost:3000 |
| `npm run build` / `npm start` | Build and run the production version |
| `npm run secret` | Print a random `AUTH_SECRET` |
| `npm run db:setup` | Create or update the tables and the Admin account |
| `npm run setup:demo` | Same as `db:setup`, plus demo data if the database is empty |
| `npm run db:seed:demo` | Load demo data if the database is empty |
| `npm test` | Unit tests for the calculation rules |
| `npm run test:e2e` | Full end-to-end test (42 checks) against a running app. **It deletes all ledger data** and reloads the demo, so run it only on a test database. It needs `BASE_URL`, `ADMIN_PASSWORD` and `E2E_ALLOW_RESET=1`. |

## 13. Project structure

```
db/schema.sql                 database tables
scripts/                      migrate, seed, secret, e2e test
src/lib/ledger-calc.js        ALL ledger calculations (single source of truth)
src/lib/ledger-service.js     payments, advances, closings, people, the grid
src/lib/reports.js            reports (the screen and the export use the same data)
src/lib/export.js             CSV / Excel / backup
src/lib/auth.js, session.js   login sessions and role checks
src/app/api/...               server API routes (admin/*, viewer/*, auth/*)
src/app/admin/...             Admin pages
src/app/viewer/...            Viewer page
src/components/...            shared UI (modals, tables, forms)
tests/                        unit tests
```

## 14. Troubleshooting

- **"DATABASE_URL is not set"**: create `.env.local` from `.env.example` and fill it in. Make sure the file is in the same folder as `package.json`.
- **"AUTH_SECRET must be set to at least 32 characters"**: run `npm run secret` and paste the result into `.env.local`.
- **"Set ADMIN_PASSWORD (8+ characters)"**: fill in `ADMIN_PASSWORD` in `.env.local`, then run `npm run db:setup` again.
- **"Something went wrong on the server"** when signing in: the database cannot be reached. Check `DATABASE_URL`, and make sure the Neon project is not suspended (open it in the Neon dashboard to wake it).
- **Forgot the Admin password**: in the Neon SQL editor, run `DELETE FROM users WHERE role='admin';`. Then set a new `ADMIN_PASSWORD` and run `npm run db:setup` (or redeploy on Vercel). Ledger data is not affected.
- **The current month looks wrong**: check `APP_TIMEZONE`, and make sure `APP_TODAY` is empty.
- **`process.loadEnvFile is not a function`**: your Node.js is too old. Install the current LTS version from nodejs.org.
- **Warning `MODULE_TYPELESS_PACKAGE_JSON` during `npm run setup:demo` / `db:setup`**: this is harmless. It is only Node.js mentioning a small performance detail in the setup scripts. Setup still completes; look for the ✔ lines.
