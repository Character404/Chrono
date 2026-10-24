# Chrono

**Know before you commit.** Chrono tells small, order-based business owners, before they accept an order, whether they will have enough cash at every point until it is paid, and the deposit that keeps them safe. It learns how their customers actually pay and adjusts the forecast.

Built by BinaryBros for the FNB App of the Year Hackathon 2026 (Youth entrepreneurship and small-business growth). The full product specification is in [SPEC.md](./SPEC.md).

## Status

Milestone 1 is complete: project scaffold, database schema, forecasting engine, intelligence layer and automated tests. The home page currently shows a live engine check; the real screens arrive in Milestone 2.

## Getting started (GitHub Codespaces)

The Codespace needs two repository secrets, `DATABASE_URL` (Neon pooled) and `DIRECT_URL` (Neon direct). See `.env.example`.

```bash
npm install                            # installs packages and generates the Prisma client
npx prisma migrate dev --name init     # creates the tables in Neon (first time only)
npm test                               # runs the engine test suite
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
| `npm run db:studio` | Browse the database |

## Architecture

```
app/                  Next.js App Router pages (UI)
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

Secrets live only in Codespaces and Vercel environment variables, never in the repository. See the Security section of SPEC.md.
