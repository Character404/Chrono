# Chrono

**Know before you commit.** Chrono tells small, order-based business owners, before they accept an order, whether they will have enough cash at every point until it is paid, and the deposit that keeps them safe. It learns how their customers actually pay and adjusts the forecast.

Built by BinaryBros for the FNB App of the Year Hackathon 2026 (Youth entrepreneurship and small-business growth). The full product specification is in [SPEC.md](./SPEC.md).

## Status

- **Milestone 1:** forecasting engine, intelligence layer, database schema and tests.
- **Design refresh:** Manrope type, a restrained neutral base with vibrant graphics only (gradient cash lines that turn from emerald to rose as cash runs low), animated charts and count-up numbers, a step-by-step "what Chrono checked" reveal on every order, a live forecast bar with sparkline in the order wizard, and active navigation tabs. All motion respects reduced-motion settings.
- **Milestone 3:** what-if comparison with "use these terms", recording actual payments and costs (the learning loop), customer pages with payment history and reliability, shareable quote links with WhatsApp sharing, the 60-second judge tour, and the impact counter.
- **Milestone 2:** login and sign-up, one-tap demo account, business setup, home screen with a 30-day cash chart, the order check wizard with a live forecast, the order result screen, accept and decline, regular payments, and authorisation tests.

## Demo account

Press **Try the demo** on the login page, or log in with:

- Email: `demo@chrono.app`
- Password: `Chrono2026!`

On the demo home screen, tap **Take the 60-second tour**. The demo is Lerato's Kitchen, a catering business in Soshanguve, with four months of made-up history. It refreshes itself once a day so the dates always look current. Open **Wedding catering** to see an order that looks safe as entered but leaves Lerato short of cash once Chrono adjusts for how Thabo really pays.

## Getting started (GitHub Codespaces)

The Codespace needs two repository secrets, `DATABASE_URL` (Neon pooled) and `DIRECT_URL` (Neon direct). See `.env.example`.

```bash
npm install                            # installs packages and generates the Prisma client
npx prisma migrate dev                 # applies database changes to Neon
npm run db:seed                        # creates the demo account (optional: the demo button does this too)
npm test                               # runs all test suites
npm run dev                            # starts the app on port 3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests on every change |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Production build |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Create or refresh the demo account |
| `npm run db:studio` | Browse the database |
| `npm run vercel-build` | Build used by Vercel (generate, migrate, build) |

## Architecture

```
app/                  Next.js App Router pages
  (app)/              Signed-in screens: home, orders, regular payments
  actions/            Server actions (login, orders, payments); every one checks the session
  login, signup, setup
components/           Chart, verdict and analysis display
lib/auth/             Password hashing, hashed-token sessions, rate limit, page guards
lib/data/             Business-scoped data access (repo.ts) and order drafts
lib/demo/             Demo business data and seeding
lib/engine/           Pure, deterministic forecasting engine (no database, no clock)
  dates.ts            Date-only helpers (YYYY-MM-DD, South African formatting)
  money.ts            Integer-cent money helpers and R formatting
  types.ts            Engine input types
  forecast.ts         Daily cash forecast, verdict, shortfall, duplicate detection
  deposit.ts          Recommended minimum deposit (binary search on the engine)
  intelligence.ts     Customer lateness, payday pattern, cost bias, cost drift
  analyze.ts          Full order check plus plain-language explanations
  __tests__/          Vitest suites for the required SPEC scenarios
lib/db.ts             Prisma client
prisma/schema.prisma  Database schema
```

Key rules the engine follows:

- Money is integer cents; dates are date-only.
- Money going out on a day is counted before money coming in.
- Costs without a date are counted as due today; payments without a date are not counted.
- Verdict: **Safe** at or above the safety buffer, **Tight** at or above R0, **Cash shortfall** below R0.
- Predictions only move money later or costs higher (conservative), and every prediction states its reason, data points and confidence.
- No AI model ever calculates a number.

## Security

- Passwords are hashed with bcrypt. Sessions use a random token in an httpOnly cookie; only its SHA-256 hash is stored.
- Every database query goes through `lib/data/repo.ts`, which always filters by the signed-in user's business. Tests in `lib/data/__tests__/repo.test.ts` prove one business can't read, change or delete another's data.
- All form input is validated on the server. Money calculations run only in the tested engine.
- Secrets live only in Codespaces and Vercel environment variables, never in the repository.
- Security headers on every response (Content-Security-Policy, no framing, no MIME sniffing, strict referrer, HSTS in production), set in `middleware.ts`.
- Every "Try the demo" creates a private copy of the demo business, deleted after 24 hours, so visitors never share or break each other's data.
- Failed logins are rate-limited in the database (5 per 15 minutes per email), storing only a hash of the email.
- Users can permanently delete their account and all business data from Settings.
- Dependencies are monitored by Dependabot, code is scanned by CodeQL, and secret scanning blocks leaked credentials.
