# Chrono — Claude Implementation Prompt

## How to use this prompt

Paste this whole document into Claude in your Codespace and build one milestone at a time, stopping for review after each. The app is called Chrono, with the tagline: Know before you commit.

Ground rules for Claude:

1. Build only what is listed as in scope. Do not add features from the out-of-scope list, even if they seem helpful.
2. Never claim or fake integrations. There is no real FNB, bank, payment, or WhatsApp API connection in this app.
3. Every money calculation is a deterministic TypeScript function with unit tests. No LLM ever calculates or invents a number.
4. Store money as integer cents (ZAR). Display as R5 000 using the en-ZA locale.
5. Treat dates as date-only values in the Africa/Johannesburg time zone.
6. After each milestone, run all tests and report what works, what does not, and what is untested. Never call something done if its tests fail.
7. Prefer small, incremental changes. Do not rewrite modules that already work and pass tests.
8. If a rule here is ambiguous, ask instead of inventing behaviour.

## Product summary

Chrono tells a small, order-based business owner, before they accept an order, whether they will have enough cash at every point until it is paid. It learns how their customers actually pay and adjusts the forecast accordingly.

The core problem: young business owners say yes to orders blind. They cannot see how late customers, rising costs, upfront payments and other accepted orders will collide until the money runs out, so an order can be profitable on paper and still cause a cash shortage. The app separates profitability (will I make money?) from cash timing (will I have money when I need it?).

Challenge: Youth entrepreneurship and small-business growth. How the app answers the problem statement:

| Problem statement phrase | What the app does |
| --- | --- |
| Manage cash flow | Dated cash forecast, shortfall warnings, recommended deposit, what-if comparison |
| Get paid | Shareable quote link that states the deposit requested and payment dates |
| Funding readiness | Saved order history and customer payment-reliability record (foundation for future lending conversations; no lending built) |
| Township and rural businesses | Mobile-first, low-data, plain-language design |

Chrono also matters most when a young business lands its first large order from a corporate or government client on 30 to 90 day terms, so it helps owners safely say yes to growth and reach formal markets. It does not create customers, but it helps owners accept more orders safely, look professional with shareable quotes, and protect their margins. The app informs; it never accepts or rejects an order on the user's behalf.

## Target user and demo persona

The user is a young founder running an order-based business: catering, baking, dressmaking, event decor, printing, or hair and beauty bookings. They take deposits, buy materials upfront, and get the balance later. They use a phone, often on limited data, and have no accountant.

Demo persona: Lerato, 24, runs Lerato's Kitchen, a home catering business in Soshanguve. A customer asks her to cater a wedding for R5 000 with a R1 000 deposit. She needs R3 200 of ingredients two days before the event. This customer has paid late before.

Design every screen so Lerato can complete an order check in under two minutes on a 360px-wide phone.

## Scope

Build the essentials first, stretch items only after every essential passes its tests, and never anything out of scope.

| Feature | Priority |
| --- | --- |
| Email/password login plus a one-tap Try demo account button | Essential |
| Business profile, opening cash, safety buffer | Essential |
| Customers (name, optional phone) | Essential |
| Order check: value, deposit, balance or instalments, costs, each with dates | Essential |
| Existing commitments: one-off and recurring (weekly, monthly), money in or out | Essential |
| Dated cash forecast including all accepted orders | Essential |
| Verdict, shortfall explanation, recommended minimum deposit | Essential |
| What-if comparison of up to 3 scenarios | Essential |
| Intelligence layer: customer reliability, payday pattern, cost estimate bias | Essential |
| Order status (draft, accepted, declined, completed) and recording actual payment dates and amounts | Essential |
| Shareable read-only quote link | Essential |
| Seeded demo data, Reset demo data button, 60-second judge tour, impact counter, and Copy a previous order | Essential |
| Side-by-side comparison of two pending orders | Stretch |
| Downloadable PDF decision summary | Stretch |
| AI chat assistant, LLM features | Out |
| WhatsApp API, payments, bank or FNB integrations | Out |
| Lender dashboard, credit scoring, marketplace, tenders | Out |
| Multilingual UI, offline mode, native app | Out |

## Screens and user journey

The main journey is: open the app, start an order check, see the verdict, try a what-if, then accept, decline, or share a quote.

1. **Login.** Email and password, plus a prominent Try demo account button that signs into the seeded demo business.
2. **Home.** Cash on hand today, a 30-day cash line chart, the next 5 money-in and money-out events, pending orders with verdict badges, and an impact counter (for example: Chrono has flagged 3 shortfalls, protecting R4 200). On the demo account, a Take the 60-second tour banner guides a first-time visitor in three taps: open the wedding order, see the as-entered versus adjusted verdict, and apply the recommended deposit. One primary button: Check a new order.
3. **New order check.** A three-step wizard: (a) customer and order value; (b) deposit and balance or instalments, each with a date and a certainty setting (confirmed, estimated, not sure); (c) costs with amounts and dates. The forecast recalculates live as values change. A Copy a previous order button pre-fills the wizard so a repeat order takes seconds.
4. **Result.** A headline verdict (Safe, Tight, or Cash shortfall) and a separate profit line. Below it: the forecast chart with the zero line and buffer line, a shortfall card (how much, from which day, for how many days, and what causes it), the recommended minimum deposit, prediction notes, and the assumptions list. Actions: Try a what-if, Accept order, Decline, Share quote.
5. **What-if.** Change the deposit, cost date, or balance date and see up to 3 scenarios side by side, each with a verdict and minimum balance.
6. **Customers.** A list, plus a detail page showing payment history, on-time rate, typical lateness in days, and confidence level.
7. **Commitments.** Add or edit rent, stock, transport, data, or expected income, one-off or recurring.
8. **Order detail.** Record money received and costs paid with actual dates and amounts. These records feed the intelligence layer.
9. **Public quote page** (/q/\[token\]). Shows the business name, order title, total, deposit requested, and payment dates. Nothing else.

UX rules: one primary action per screen; plain words (cash on hand, money in, money out, never liquidity); tap targets at least 44px; works at 360px wide; every empty state explains what to do next.

## Tech stack and data model

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL (Neon or Supabase free tier), deployed on Vercel. Use Recharts for charts, Zod for validation, Vitest for tests, and bcrypt with httpOnly session cookies for auth. The forecasting engine and intelligence layer live in /lib/engine as pure functions with no database access, shared by server and client.

| Model | Key fields |
| --- | --- |
| User | id, email, passwordHash, isDemo, createdAt |
| Business | id, userId, name, type, openingCashCents, openingCashDate, safetyBufferCents (default 50000), paydayWindowStart (default 25) |
| Customer | id, businessId, name, phone (optional) |
| Order | id, businessId, customerId, title, valueCents, status (DRAFT, ACCEPTED, DECLINED, COMPLETED, CANCELLED), createdAt, decidedAt |
| OrderPayment | id, orderId, kind (DEPOSIT, BALANCE, INSTALMENT), amountCents, expectedDate (nullable), dateCertainty (CONFIRMED, ESTIMATED, UNKNOWN), receivedDate, receivedAmountCents |
| OrderCost | id, orderId, description, category (INGREDIENTS, MATERIALS, PACKAGING, TRANSPORT, LABOUR, OTHER), estimatedCents, dueDate (nullable), dateCertainty, paidDate, paidCents |
| Commitment | id, businessId, description, direction (IN, OUT), amountCents, startDate, recurrence (NONE, WEEKLY, MONTHLY), endDate, active |
| Scenario | id, orderId, name, overrides (JSON: deposit, dates, amounts) |
| QuoteShare | id, orderId, token, createdAt, revokedAt |

The sum of an order's payments must equal its value; validate this on save and show a clear error if it does not.

## Forecasting engine rules

The engine takes a snapshot (business, commitments, accepted orders, the proposed order, today's date) and returns a daily balance series, the event list, profit, minimum balance, shortfall details, and a verdict. It must be fully deterministic: the same input always gives the same output.

1. **Starting balance** = opening cash plus all recorded money received, minus all recorded costs paid, from openingCashDate up to today.
2. **Horizon** runs from today to the later of today + 30 days or the proposed order's last event + 14 days, capped at 180 days.
3. **Included events:** unreceived payments and unpaid costs of ACCEPTED orders; active commitments expanded over the horizon (a monthly commitment on the 31st falls on the last day of shorter months); and the proposed order's events. DRAFT orders other than the proposed one, and DECLINED and CANCELLED orders, are excluded.
4. **Same-day order:** apply money out before money in. List this as an assumption.
5. **Unknown dates:** a cost with an unknown date is placed on today (worst case). A payment with an unknown date is not counted and is flagged as not counted. The verdict must never be Safe only because of a payment with an unknown date.
6. **Profit** = order value minus total order costs. Show it separately from the cash verdict.
7. **Verdict:** Safe if the minimum balance is at or above the safety buffer; Tight if it is at or above zero but below the buffer; Cash shortfall if it falls below zero. Also flag Not profitable when profit is zero or negative.
8. **Shortfall details:** the deepest negative balance (amount), the first date below zero, the number of days below zero, and the largest outflows on or before the first shortfall date that cause it.
9. **Recommended minimum deposit:** the smallest deposit, rounded up to the nearest R50, that keeps the minimum balance at or above the buffer, with the order total unchanged (a larger deposit reduces the balance by the same amount). Find it by binary search using the engine itself. If even a 100% deposit cannot fix the gap (because the shortfall comes from other commitments or happens before the deposit date), say so plainly.
10. **Duplicate warning:** when saving a cost that matches another cost on the same order with the same amount within 1 day, show a confirm dialog. Editing or deleting a cost recalculates everything immediately.
11. **Scenarios** are overrides applied to the proposed order before running the engine. Never mutate the saved order.

## Intelligence layer

The app learns from the business's own recorded history and produces a prediction-adjusted forecast next to the as-entered forecast. The headline verdict uses the adjusted forecast by default, both are always visible, and the user can switch predictions off. Every prediction is a pure function that returns the adjustment, a one-sentence reason, the number of data points used, and a confidence level.

Confidence levels: Low for 2 to 3 records, Medium for 4 to 7, High for 8 or more. With fewer than 2 records, no prediction is made.

1. **Customer payment reliability.** For each settled payment, lateness = received date minus expected date, in days. Per customer, compute median lateness, on-time rate (1 day late or less), and partial-payment rate. If median lateness is above 0, shift that customer's expected payment dates by the median, rounded up. If the customer has fewer than 2 records, use the business-wide median across all customers and label it as based on all customers. Example: Thabo paid late on 3 of his last 4 payments, by 6 days on average. This forecast expects his balance on 18 Nov instead of 12 Nov.
2. **Payday pattern.** Compute the share of all received payments that landed between the 25th and the 1st of the next month. If it is 60% or more and a payment's expected date falls outside that window, predict it arrives at the start of the next window and flag it. Apply this only when there is no Medium or High customer-specific prediction, which always wins.
3. **Cost estimate bias.** Compare paid costs to their estimates. If actual costs average more than 5% above estimates (needs at least 4 paid costs), increase this order's unpaid costs by that percentage in the adjusted forecast. Example: Your actual costs have run 8% above your estimates on your last 10 orders, so this forecast adds R256.
4. **Cost drift warning.** Per category, compare this order's cost to the median of the last 5 costs in that category. If it is more than 15% higher, warn the user but do not adjust the forecast.

When actual payments and costs are recorded on the order detail screen, the predictions update automatically. This is the learning loop, and the demo must show it.

## Explanations and language

All explanations are templated sentences generated from engine output, never from an LLM. Write at a simple reading level, in short sentences, with real numbers and dates.

Example outputs:

- Shortfall: You'll be R200 short from Thu 7 Nov for 6 days. Your ingredients (R3 200) are due before the customer's balance (R4 000) arrives.
- Fix: Ask for a deposit of at least R1 700 and you stay above your R500 safety buffer.
- Profit: This order makes R1 800 profit (36%). Cash timing is the risk, not profit.
- Cannot fix: A bigger deposit won't fix this. Your rent (R2 500) on 1 Dec causes the gap. Try moving the ingredient purchase or a cheaper supplier.
- Unknown date: The balance has no date yet, so it isn't counted in this forecast.

Rules: never say approved, rejected, or guaranteed, because the user decides. Format money as R5 000 and dates as Tue 12 Nov. Show a small line under every forecast: Estimate based on what you entered and your past orders.

## Required test scenarios

Each scenario is a Vitest test against the pure engine and must pass before any UI is built on it. Day 0 is today.

Base order for all tests: value R5 000; deposit R1 000 on day 0; balance R4 000 on day 7; ingredients R3 200 on day 1. Profit is R1 800. Safety buffer is R0 unless stated.

| # | Setup | Expected result |
| --- | --- | --- |
| 1 | Opening cash R5 000 | Minimum balance R2 800; verdict Safe |
| 2 | Opening cash R2 000 | Minimum balance −R200; shortfall from day 1 for 6 days; verdict Cash shortfall; profit R1 800 still shown |
| 3 | Same as 2, find recommended deposit | Deposit R1 200 gives verdict Safe; with a R500 buffer, recommended deposit is R1 700 |
| 4 | Opening cash R5 000; rent R3 000 out on day 10; customer history lateness 5, 7, 6, 8 days | As entered: Safe (minimum R2 800). Adjusted: balance shifts 7 days to day 14; minimum −R200 from day 10 for 4 days; verdict Cash shortfall |
| 5 | Opening cash R5 000; accepted order A with cost R2 500 on day 2 and payment R3 000 on day 12; buffer R500 | Minimum balance R300 on day 2; verdict Tight. Without order A: Safe |
| 6 | Ingredients cost entered twice | Duplicate warning fires; after deleting one, forecast equals the single-entry forecast |
| 7 | Ingredients date unknown; balance date unknown | Cost placed on day 0; balance not counted and flagged; verdict is not Safe |

Also test: money out before money in on the same day; monthly commitment on the 31st in a 30-day month; payments that do not sum to the order value are rejected; a 100% deposit that still cannot fix the gap returns the cannot-fix result; fewer than 2 history records gives no customer prediction; and one user can never read or change another user's orders, customers or commitments (authorisation test, required in Milestone 2).

## Demo account seed data

The demo account must show every intelligent feature within a judge's first minute, so it needs about 4 months of realistic history. Write an idempotent seed script (npm run seed) and a Reset demo data button visible only on the demo account.

- **Login:** demo email and password to be chosen by the team, shown on the login screen and in the slides.
- **Business:** Lerato's Kitchen, catering, Soshanguve. Opening cash set so the current balance is about R4 500. Safety buffer R500.
- **Customers (6):** one who always pays on time; one who is typically 6 to 7 days late (4+ records, so Medium confidence); one who pays in part then settles later; three mixed.
- **History:** about 20 completed orders across the 4 months, with recorded payment and cost dates. Most payments land between the 25th and the 1st, so the payday pattern triggers.
- **Cost patterns:** actual costs about 8% above estimates; recent ingredient costs about 15% above the earlier median, so the drift warning fires.
- **Commitments:** rent R2 500 monthly on the 1st; transport R300 weekly; data and airtime R150 monthly.
- **Accepted orders (2)** with future payments and costs, so the forecast includes them.
- **Pending demo order:** a wedding for R5 000 from the late-paying customer. As entered it looks Safe or Tight; adjusted for his lateness it shows a Cash shortfall, with a recommended deposit that fixes it. This is the headline demo moment.

## Security, deployment and milestones

The live app must be on Vercel by Sunday night; Monday is for polish, real users, and submission paperwork only.

**Security** (also use this for the SSDLC form):

- Passwords hashed with bcrypt; sessions in httpOnly, secure, SameSite cookies.
- Every database query is scoped to the signed-in user's business; check ownership on every server action and API route.
- Validate all input server-side with Zod; Prisma parameterised queries only.
- Basic rate limiting on login.
- Quote links use random 128-bit tokens, can be revoked, and expose only business name, order title, total, deposit, and dates. Never customer phone numbers or other orders.
- Collect minimal personal data: no ID numbers, no bank details. Secrets only in environment variables, never in the repo. Run npm audit before submission.

**Deployment:** Vercel plus Neon Postgres. Use two environment variables: DATABASE_URL (Neon pooled connection, for the app) and DIRECT_URL (Neon direct connection, for Prisma migrations), set as `url` and `directUrl` in the Prisma datasource; run migrations on deploy; seed the demo account on the live database; HTTPS by default.

**Milestones:**

1. **Saturday:** scaffold, Prisma schema, forecasting engine, tests 1, 2, 3, 5, and 7 passing.
2. **Saturday night to Sunday morning:** auth and demo login with authorisation tests, order wizard, result screen with chart, commitments. First deploy to Vercel.
3. **Sunday:** intelligence layer with test 4 and the duplicate test 6; seed data; what-if screen.
4. **Sunday night:** customers screens, recording actual payments, quote links, Reset demo data, judge tour, impact counter, Copy a previous order. Redeploy.
5. **Monday:** mobile polish, fixes from real-user testing, README with architecture diagram. Code freeze at 18:00, submit well before 23:59.

**Definition of done:**

- [ ] All tests pass
- [ ] Live URL opens the demo account on a phone at 360px with no console errors
- [ ] Demo flow from login to verdict to what-if takes under 2 minutes
- [ ] Adjusted forecast visibly differs from as-entered on the demo order, and the judge tour walks a first-time visitor through it
- [ ] README explains setup, architecture, and the engine rules
