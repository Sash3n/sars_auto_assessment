# SARS Auto-Assessment Calculator

A personal decision-support tool that independently estimates what a South African
individual's SARS annual assessment (ITA34) should look like, built from payslips and
other income and deduction inputs, so discrepancies in SARS's own auto-assessment can
be caught inside the 40-business-day correction window.

Not tax advice. Not affiliated with or endorsed by SARS.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) with React and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) v4 with [DaisyUI](https://daisyui.com/) v5,
  themed against the project's design reference (emerald primary, slate secondary,
  Inter for UI text, JetBrains Mono for currency values)
- [Vitest](https://vitest.dev/) and React Testing Library, with coverage thresholds
  enforced in CI
- GitHub Actions CI: lint, typecheck, test, build, `npm audit --audit-level=high`,
  CodeQL static analysis, and weekly Dependabot updates

## Running locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

## Scripts

| Command             | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the dev server                              |
| `npm run build`     | Production build                                  |
| `npm run start`     | Serve the production build                        |
| `npm run lint`      | ESLint over the whole repo                        |
| `npm run typecheck` | TypeScript, no emit                               |
| `npm test`          | Vitest, single run, with coverage thresholds      |
| `npm run test:watch`| Vitest in watch mode                              |

## Current state

The structured JSON payslip import fixes two real-world gaps found against
an actual vision-extracted payslip batch:

- The PAYE classify rule only matched the literal string "paye". A payslip
  spelling it out in full, "Pay as you Earn", fell through to an
  unrecognised line and PAYE stayed at zero. The rule now matches both.
- Employer-side amounts (employer medical aid, employer retirement, group
  risk benefits, statutory levies) are commonly reported in their own
  `company_contributions` array rather than mixed into `deductions`, which
  the importer previously ignored entirely, silently dropping employer
  medical fringe benefits (SARS code 3805) and other taxable fringe
  benefits with no warning at all. `company_contributions` is now a
  supported section with its own classification: "medical" always means the
  employer medical fringe, "pension"/"provident"/"retirement" always mean
  the employer retirement fringe (unlike `deductions`, where the same words
  are ambiguous between employee and employer). The Skills Development Levy
  and the employer's own UIF contribution are statutory employer costs, not
  paid for the employee's benefit, so they are recognised and intentionally
  ignored rather than misfiled as a fringe benefit. Everything else the
  employer pays (group life, funeral cover, wellness or rewards programs) is
  a taxable fringe benefit by default under the Seventh Schedule.
- A top-level `employer` field on the import batch is now used as a default
  for entries that do not name their own, since some extraction batches
  name the employer once for the whole file rather than per payslip.
- An employee's own medical scheme deduction (for example "Medical Aid_EE")
  has no per-payslip field, since this app tracks that at the taxpayer level
  under Deductions for the section 6A/6B credit, not per payslip. It is
  still kept visible as a non-tax deduction rather than dropped, but now
  gets a specific warning naming the amount and pointing at where to add it,
  instead of the generic "unrecognised line" message that implied it did
  not matter for tax.

How it is tested: `src/lib/extraction/__tests__/json-import.test.ts` adds
cases for the spelled-out PAYE phrase, `company_contributions` classifying
medical and retirement lines correctly while ignoring SDL and employer UIF,
an unrecognised `company_contributions` line falling back to a taxable
fringe benefit, the top-level employer default, and the specific medical
deduction warning. Verified end to end against a real 12-month JSON export
from an actual employer: every figure now matches the source data's own
year-to-date totals exactly (previously employer medical aid and all other
fringe benefits were silently zero).

The Compare page now offers an objection summary once a real SARS
assessment is pasted and mismatches are found:

- `buildObjectionSummary` (`src/lib/tax-engine/objection.ts`) is a plain
  formatting layer over `compareAssessments`'s output, no new tax
  calculation: it filters to mismatched rows and writes a plain-language
  reasoning line for each (comparing the app's figure, SARS's figure, and
  the delta, or stating clearly that the app did not calculate a code SARS
  assessed, never fabricating a reason).
- It is deliberately framed as "for your own reference when completing a
  Notice of Objection on SARS eFiling", not a submission-ready objection
  letter, since the app has no eFiling or SARS API integration (no server
  routes exist by design) and cannot guarantee that SARS's figure is wrong.
- Export is a plain-text `.txt` download (client-side `Blob`, no new
  dependency) plus print-friendly styling, keeping with the app's
  no-backend, nothing-leaves-the-browser stance. `formatObjectionSummaryText`
  produces the exported text, stable in format since a taxpayer may paste it
  directly into eFiling's free-text field.

How it is tested: `src/lib/tax-engine/__tests__/objection.test.ts` covers a
coded line mismatch with both amounts and the delta named, a summary row
(keyed rather than coded) mismatch not getting dropped, a SARS-only code the
app never calculated stating that plainly, matched and not-available rows
being excluded entirely, and the exported text format including the tax
year, code, and figures, plus a no-mismatches message when there is nothing
to object to.

A provisional tax (IRP6) calculator is available at `/provisional`, linked
from the Results page's provisional-taxpayer alert:

- `calculateIrp6` (`src/lib/tax-engine/irp6.ts`) computes the first (31
  August) and second (end of February) payments under both statutory
  methods: the basic amount method (the taxpayer's most recently
  SARS-assessed taxable income, uplifted 8 percent if that assessment is
  more than 18 months old) and the estimated income method (this year's own
  taxable income estimate from `composeAssessment`). Both payments assume
  PAYE already withheld splits evenly across the year, since this app does
  not track PAYE by half-year, disclosed as a simplification rather than
  hidden.
- The basic amount method needs the prior year's SARS-assessed taxable
  income. If a prior tax year is captured in this app, its own calculated
  taxable income is offered as a starting point, clearly labelled as an
  estimate to override with the real assessed figure. Without that, the
  field starts blank and the method reports "not available" rather than a
  silent zero.
- A warning appears when the basic amount sits materially below the current
  year's own estimate, since a shortfall against the final assessed figure
  can trigger underestimation penalty interest under section 89quat.
- Out of scope for now: the voluntary third "top-up" payment (due about
  seven months after year end, to stop interest accruing) is not
  calculated, only the two statutory payments. No penalty rand figure is
  computed either, since it depends on SARS's prescribed interest rate at
  assessment date, which is not known in advance.

How it is tested: `src/lib/tax-engine/__tests__/irp6.test.ts` covers the
estimated income method's own numbers, the basic amount method with and
without the 18-month uplift, the underestimation warning triggering when the
basic amount is well below the current estimate, a null basic amount method
when no prior year data is known, and both payments flooring at zero rather
than going negative when PAYE already covers the estimated tax.

The monthly PAYE estimator now uses SARS's cumulative "average" method for
irregular pay periods:

- `estimateMonthlyPayeCumulative` (`src/lib/tax-engine/monthly-paye.ts`)
  annualises using earnings to date divided by periods elapsed, rather than
  multiplying the current period alone by the periods remaining. A bonus or
  once-off amount now only raises the estimate by its share of the year to
  date, instead of being treated as if earned every period, which is what
  the previous flat method did. The Income page's per-payslip estimate
  (`estimatePayslipPaye` in `IncomePage.tsx`) now builds this history per
  employer, in period order, up to and including the payslip being shown.
- `estimateMonthlyPaye`, the simpler flat-period method, stays available for
  callers without a full period history.
- Deliberately out of scope: SARS also publishes fixed monthly PAYE
  deduction tables that round to published brackets. The continuous formula
  used here is a SARS-sanctioned alternative (Guide for Employers in respect
  of Employees' Tax, PAYE-GEN-01-G04) that differs from the table method by
  at most a few rand; transcribing and maintaining the actual table data was
  judged not worth it for that small a gain.

How it is tested: `src/lib/tax-engine/__tests__/monthly-paye.test.ts` adds a
hand-computed six-months-flat-then-bonus scenario proving the cumulative
estimate lands well below the flat method's overstatement for the bonus
month, a flat-salary-all-year scenario proving the two methods converge when
there is nothing irregular to smooth, a first-period scenario proving they
match exactly when there is no prior history yet, and a rejection test for
an empty period history.

Calculation transparency is complete:

- The Results page's tax calculation lines (normal tax before rebates,
  rebates, both medical scheme credits) and the retirement deduction line now
  have a "How was this calculated?" toggle that shows the formula applied and
  the exact table values (rates, caps, published rand amounts) that were
  used. The retirement deduction trace names which of the four section 11F
  limits (contributions, annual cap, 27.5 percent of remuneration or taxable
  income, taxable income before the deduction) was the binding cap, since
  that was previously invisible.
- The Compare page shows the same working next to mismatched lines (currently
  the retirement deduction and the "assessed tax after rebates" summary row),
  so a discrepancy against a real SARS assessment can be traced back to the
  specific rate or cap that produced it, not just the delta.
- Why: the app's value as a self-check tool depends on the user being able to
  see why a figure differs from SARS's, not only that it differs.

How it is tested: `src/lib/tax-engine/trace.ts` mirrors `assessment.ts`'s
composition by calling the same underlying pure functions
(`taxBeforeRebates`, `totalRebates`, `retirementDeduction`,
`annualMedicalSchemeCredit`, `additionalMedicalCredit`), so there is no
duplicated tax logic, only duplicated orchestration to also capture the
working. `src/lib/tax-engine/__tests__/trace.test.ts` covers a plain
tax-before-rebates scenario, an age 65+ rebate scenario, a medical scheme
credit scenario, and retirement deduction scenarios asserting which of the
four section 11F candidates is named as binding, plus cross-checks against
`composeAssessment` for the same inputs.

Phase 7 (design polish and accessibility) is complete:

- Layout parity with the design reference: exact 280px sidebar, 1280px
  max-width content container, and on mobile the sidebar's key summary views
  (Home, Income, Results, Compare) become a bottom-tab bar, with the full
  navigation still available in the drawer.
- Both themes were built from the design reference from Phase 0 onward, and
  every component uses semantic theme tokens, so light/dark parity holds
  across every screen including charts (whose palettes are separately
  validated per mode).
- Accessibility pass: a skip-to-content link targeting the main landmark,
  keyboard operability for the drawer toggle (Enter and Space), Escape
  closing the consent modal with focus moved into it on open, focus-visible
  styled as the reference's 2px primary ring, aria-current on active
  navigation, labeled icon-only controls throughout, chart figures with
  roles, printed labels, and table fallbacks, and reduced-motion support via
  `prefers-reduced-motion`.

How it is tested: shell tests cover the skip link and main landmark wiring,
the mobile quick navigation contents, keyboard activation of the drawer
toggle, scoped navigation queries, and the year switcher. An upload page
accessibility test asserts the consent modal takes focus on open and closes
on Escape. The full suite (247 tests) passes in both structure and coverage
thresholds.

Phase 6 (dashboard and analytics) is complete:

- The home page becomes a dashboard once income is captured: the estimated
  refund-or-owed verdict in SARS's own sign convention (positive means payable
  by you; refunds render in the primary green, owed amounts in red), with
  total income, PAYE, tax payable, and effective rate tiles.
- Tax bracket visualisation: the year's bracket table on a linear rand scale
  as a single-hue sequential ramp, with a marker at your taxable income, rate
  labels printed in the segments, and the full bracket table available
  underneath.
- Month-by-month income and PAYE chart across all employers: two fixed
  series, legend, per-bar tooltips, recessive gridlines, and a table view.
- Deduction breakdown: horizontal proportion bars (retirement, donations,
  home office) with amounts and percentages printed as text.
- Year-over-year comparison: total income, effective rate, and refund/owed
  per stored tax year, first-class because multiple years are stored.
- Chart series colors are brand-family variants validated programmatically
  (lightness band, chroma floor, colorblind separation, and contrast against
  each theme's surface) for both light and dark modes, exposed as
  `--chart-1..3` theme variables. Nothing in any chart rides on color alone:
  legends, printed labels, and table views accompany every figure.

How it is tested: the data shaping is pure and unit tested (monthly sums
across employers, breakdown percentages, year-over-year filtering and
sorting, bracket segment shares summing to 100 with the marker in the right
segment, clamping for very high and zero incomes). Dashboard component tests
cover the empty landing state and the populated dashboard (verdict, all four
sections, marginal bracket text, deduction rows, year row).

The provisional taxpayer warning on the Results page now names the IRP6
payment dates (end of August and end of February) rather than only saying
"verify your registration status with SARS", since the deadline is what a
taxpayer flagged as likely provisional actually needs to act on.

How it is tested: a Results page test drives non-PAYE income above the
threshold and asserts the warning text includes both payment dates.

Google sign-in was added alongside email/password auth: a "Continue with
Google" button on the Account page (`src/lib/firebase/client.ts`,
`signInWithGoogle`) using Firebase's `GoogleAuthProvider` and a popup flow.
Enable the Google provider for the `sars-auto-assessment` project under
Firebase console > Authentication > Sign-in method. Popup-specific failures
(closed by the user, blocked, or an existing email tied to a different
provider) get their own friendly messages alongside the existing
email/password ones.

How it is tested: Account page tests cover a successful Google sign-in and
the cancelled-popup error message, mocking the Firebase client the same way
as the existing email/password tests.

Phase 5 (auth, storage, and security) is complete:

- Client-side encryption (`src/lib/crypto/encryption.ts`): PBKDF2-SHA256 with
  310 000 iterations and a random per-save salt derives an AES-GCM 256 key
  from a passphrase only the user holds. Every save uses a fresh IV, and GCM
  authenticates the ciphertext so tampering fails outright. Firestore only
  ever stores ciphertext envelopes; the passphrase never leaves the device
  and is never persisted. Losing it makes the cloud copy unrecoverable, by
  design, and the UI says exactly that.
- Firebase (`src/lib/firebase/`): configuration comes only from environment
  variables (see `.env.example`), targeting the existing
  `sars-auto-assessment` project. Email/password and Google sign-in, and a
  single encrypted document per user at `users/{uid}/private/appData`. The
  SDK loads lazily
  and the whole app stays fully usable with Firebase unconfigured
  (local-only mode).
- Firestore security rules (`firestore.rules`): per-user documents readable
  and writable only by the authenticated owner, reference collections
  world-readable and never client-writable, everything else denied by
  default. Deploy them in the Firebase console or with the Firebase CLI.
- Account page: sign up, sign in, sign out, passphrase entry (memory only),
  save/load with a document size guard under Firestore's 1 MiB limit, and
  generic user-facing error messages (detail goes to the console only).
- Attack surface notes: the app exposes no server API routes at all, so
  there is nothing to rate limit server-side; the cloud LLM fallback calls
  the provider directly from the browser by explicit consent, and Firestore
  access is bounded by the rules plus Firebase's own quotas. All
  user-supplied values continue to pass the model validation boundary, and
  writes are size-checked before leaving the device.

How it is tested: encryption tests cover round-trip fidelity, fresh salt and
IV per save, ciphertext opacity, wrong-passphrase and tamper rejection,
version gating, and the short-passphrase guard. Sync tests cover the
versioned envelope round trip and malformed document rejection, without
touching Firestore (the pure build/read steps are separated from the thin
write/read wrappers). Account page tests mock the Firebase layer and drive
local-only mode, sign in, the short-password guard, passphrase-required
saves, encrypted save calls, and cloud load hydrating the store.

### Setting up cloud sync (optional)

1. In the Firebase console for `sars-auto-assessment`, add a web app and copy
   its config values into `.env.local` (template: `.env.example`).
2. Enable Email/Password sign-in under Authentication.
3. Deploy `firestore.rules` (console rules editor or `firebase deploy --only
   firestore:rules`).

Phase 4 (assessment engine and SARS comparison) is complete:

- Assessment composer (`src/lib/tax-engine/assessment.ts`): composes every
  captured source into the ITA34 structure: income by SARS code (3601, 3605,
  3713, 3801, 3805, 3817, 4201 with the exemption as a negative adjustment
  line), deductions allowed (4029 with carry-forward warnings, donations, home
  office), taxable income, assessed tax after rebates (including s6A and s6B
  medical credits), tax credits and adjustments (PAYE), assessment result, and
  the SARS rating percentage. Sign convention matches SARS: positive is
  payable by the taxpayer. Provisional taxpayer likelihood is flagged when
  non-PAYE income exceeds the threshold.
- ITA34 parser (`src/lib/extraction/ita34.ts`): reads coded lines and summary
  rows from pasted ITA34 text, treating trailing minus as negative. Unread
  figures stay absent, never zero.
- Comparison (`src/lib/tax-engine/compare.ts`): line-by-line diff by SARS code
  plus the summary rows, with a configurable mismatch threshold. SARS-side
  figures that could not be read show as "not available" and can be completed
  manually; codes SARS assessed that we did not calculate are surfaced too.
- Results page: the estimated assessment in ITA34 form with a refund/owed
  verdict (green for refund, red for owed, matching SARS's own sign
  convention). Compare page: paste the ITA34, see the diff, fill in anything
  the parser could not read.

How it is tested: the composer, parser, and comparison were written test-first
(failing suite committed before implementation). A full hand-computed 2025/26
reference scenario pins every intermediate figure (payroll code totals,
interest exemption, retirement limit, taxable income 497 600, tax 116 763,
credits, result 15 840), plus refund, empty-year, missing-date-of-birth,
carry-forward, and CGT scenarios. Component tests drive both pages, including
the manual completion of a not-available SARS value flipping a row to match.

Monthly PAYE estimator, added after Phase 4:

- `src/lib/tax-engine/monthly-paye.ts`: estimates PAYE for one pay period
  using the SARS employer annualisation formula method (Guide for Employers
  in respect of Employees' Tax, PAYE-GEN-01-G04): the period's remuneration is
  annualised, taxed with the same bracket, rebate, section 11F retirement
  cap, and section 6A medical credit functions the annual assessment uses,
  then divided back down to a per-period figure. The section 6B additional
  medical credit is deliberately excluded, since SARS's monthly PAYE
  calculation does not apply it, only annual assessment does. This is an
  estimate: SARS's published monthly deduction tables round to fixed
  brackets rather than using the continuous formula, and a bonus or other
  irregular amount in the estimated period will overstate the annual
  equivalent, since the cumulative "average" method payroll systems use to
  smooth those months is not implemented.
- Income page: each captured payslip shows this estimate alongside its actual
  PAYE, with a badge when the two differ by more than R100 and 10 percent.
  The badge is a prompt to look closer, not a verdict, a bonus month, a
  mid-year start, or a benefit not yet settled can all produce a genuine gap
  against a regular-month estimate.

How it is tested: `monthly-paye.ts` was written test-first, with hand-computed
reference scenarios (a regular month, the retirement cap engaging, the age-65
secondary rebate, zero remuneration, medical credits exceeding tax, and an
alternate pay frequency). Income page tests cover the estimate rendering
alongside a mismatched and a matching actual PAYE figure.

Phase 3 (extraction pipeline) is complete:

- Local-first extraction (`src/lib/extraction/`): PDF text-layer reading via
  `pdfjs-dist` with y-position line reconstruction (so bordered layouts where
  the label and amount sit far apart still parse), on-device OCR via
  `tesseract.js` for images (nothing leaves the browser), and a paste-raw-text
  path. Scanned PDFs are detected and the user is guided to the image or paste
  path instead of silently failing.
- Field-suggestion heuristics for the full payslip field set: same-line
  matching at high confidence, a two-line lookahead for bordered layouts at
  reduced confidence, named allowance detection, employer and period
  detection, and warnings instead of assumptions. A missing PAYE line produces
  a warning that final payslips can legitimately omit it, never a silent zero.
- Confidence scoring per extracted field (high/medium/low), surfaced as badges.
  The user reviews every suggested field, can edit or exclude each one, and
  low-confidence rows start unchecked.
- Cloud LLM fallback, strictly opt-in per instance: a consent modal states
  exactly what will be sent (the extracted text) and to which provider
  (`api.anthropic.com`), the request goes directly from the browser to the
  Anthropic API with the user's own key (bring-your-own-key, stored locally
  only, never in any cloud data), and structured outputs constrain the model
  response to a fixed JSON schema. Invalid model values are dropped, not
  trusted.
- Structured JSON import (`src/lib/extraction/json-import.ts`), for payslips
  already parsed into salary-code lines by a third-party vision or OCR tool
  rather than run through the free-text heuristics. Each line is classified by
  its description against a fixed rule set (pay, PAYE, UIF, retirement,
  employer medical, named allowances, non-tax deductions); an unrecognised
  line is never dropped, it lands in a taxable-fringe-benefit or non-tax
  catch-all and is flagged for review. A line posted on the opposite side of
  its normal section (for example a PAYE correction under earnings) is
  treated as a reversal against the running total rather than new income, and
  a warning names the correction. An optional `tax_certificate` block in the
  same JSON is cross-checked against the imported totals (gross income code
  3699, PAYE code 4102), catching a missing or duplicated month.

How it is tested: heuristics are covered by fixture payslips for same-line,
bordered split-line, and termination layouts (the termination fixture asserts
the no-PAYE warning). The PDF line reconstruction is unit tested as a pure
function. The cloud client is tested against a fake fetch (request shape,
direct-browser header, field mapping, invalid value rejection, key and rate
limit errors, refusal handling). Upload page component tests drive paste
analysis, row exclusion, saving into the store, and assert the consent gate:
the send button stays disabled until both a key and explicit consent are
given, and the cloud is never called without them. The JSON importer has its
own suite: field classification, the earnings-side PAYE correction case,
duplicate-note flagging, an unresolvable period being skipped rather than
guessed, unrecognised lines kept instead of dropped, and the tax certificate
cross-check both matching and flagging a mismatch. Upload page tests cover
parsing, previewing, importing into the store, and invalid JSON producing a
readable error.

Phase 2 (multi-source income model) is complete:

- Data model in `src/lib/model/`: payslips with an `employer` field and no cap on
  entries per year (mid-year job changes are first-class), named allowance and
  fringe benefit lists, employer retirement and medical fringe benefits captured
  as their own line items, PAYE, UIF, and non-tax deductions tracked for the
  user's records but excluded from tax. Unlimited rental properties with expense
  apportionment, freelance income as a repeatable list, local interest and
  dividends, capital disposals with per-disposal primary residence exclusion, and
  a full dependents model (relationship, date of birth, disability, months of
  medical scheme cover), not just a headcount.
- SARS source code registry in `src/lib/sars-codes.ts`, and aggregation in
  `src/lib/model/aggregate.ts` that maps payroll fields to code totals (3601,
  3605, 3713, 3801, 3805, 3817) ready for the Phase 4 assessment composer.
- Input validation and sanitisation at the model boundary for every
  user-supplied value (`src/lib/model/validate.ts`): currency parsing and
  clamping, label sanitisation, ISO date and month checks.
- Client store (`src/lib/store/`): pure reducer, versioned localStorage
  persistence (`sars-app-data-v1`), multi-year data keyed by tax year with an
  active-year switcher in the shell sidebar.
- Capture UI: app shell with sidebar navigation, and pages for employment
  income (payslip list and form), other income (rentals, freelance, interest,
  dividends, disposals), and deductions and household (taxpayer details,
  medical costs, retirement, donations, home office, dependents).

How it is tested: 145 tests. Unit suites cover aggregation (including more than
12 payslips across employers, rental apportionment and losses, the primary
residence exclusion), validation edge cases, formatting, the reducer (including
immutability and year switching), and storage corruption recovery. Component
suites drive the real forms with Testing Library user events: adding payslips
with named allowances, rentals with expenses, freelance items, disposals,
dependents, and the year switcher.

Phase 1 (core tax engine) is complete:

- Versioned tax year tables in `src/lib/tax-engine/tax-tables/`, one config file
  per tax year (2025/26 and 2026/27), covering brackets, rebates by age band, tax
  thresholds, medical scheme fees tax credit, retirement deduction rate and cap,
  interest exemption, prescribed travel reimbursement rate, and CGT inclusion rate
  and exclusions. A new tax year is a new file plus regression tests, not a code
  change.
- Calculation modules: bracket tax (`brackets.ts`), rebates and age bands
  (`rebates.ts`), section 6A medical scheme fees credit and section 6B additional
  medical credit (`medical.ts`), section 11F retirement deduction with the
  lesser-of cap logic and carry-forward (`retirement.ts`), local interest
  exemption (`interest.ts`), and taxable capital gains (`cgt.ts`).
- Notable 2026/27 changes captured: brackets and rebates adjusted 3.4 percent,
  retirement cap raised to R430,000 (first change since 2016), CGT annual
  exclusion raised to R50,000, death-year exclusion to R440,000, primary
  residence exclusion to R3,000,000, travel rate R4.95/km.

How it is tested: the whole engine was written test-first (the failing reference
suite is its own commit, before any implementation). 73 unit tests pin SARS
published figures for both tax years as regression tests, including bracket
boundary values, rebate stacking, no-tax thresholds, medical credit families,
retirement cap and carry-forward, and CGT exclusions. Two invariant suites verify
every year's bracket table is continuous and consistent with its own rebates.

### Annual tax table process

Each February/March, after the Budget Speech:

1. Verify the new year's figures against the Budget Speech tax guide from
   National Treasury and cross-check a reputable secondary source.
2. Add a new `year-YYYY-YY.ts` file under `src/lib/tax-engine/tax-tables/` with
   source links in the file comment. Never edit a previous year's file.
3. Add regression tests pinning the new published figures so an accidental edit
   is caught by CI.

Phase 0 (scaffold) is complete:

- Next.js + TypeScript + Tailwind + DaisyUI project setup.
- A light and a dark theme, both derived from the project's design reference rather
  than DaisyUI defaults. The user's choice persists in `localStorage`, falls back to
  the OS preference, and is resolved by an inline script before first paint so the
  wrong theme never flashes on load.
- CI pipeline and CodeQL analysis (see `.github/workflows/`).
- Project conventions in `AGENTS.md`, referenced by `CLAUDE.md`.
- Smoke tests covering the home page render and the theme toggle behaviour
  (`src/app/__tests__`, `src/components/__tests__`, `src/lib/__tests__`).

How it is tested: `npm test` runs the Vitest suite in jsdom. The theme module is
unit tested (storage, system fallback, applied-attribute precedence, failure paths)
and the toggle is exercised through Testing Library user events, asserting both the
`data-theme` attribute on `<html>` and the persisted value.

## Contributing

Read `AGENTS.md` first. In short: `main` -> `dev` -> `feature/*`, feature branches
are never deleted, every PR carries its own tests and a README update, no
`Co-Authored-By` trailers, no em dashes anywhere, and tax-engine work is test-first.

## Research links

Each feature PR adds the research links consulted for that change.

Phase 3 (extraction):

- [pdf.js documentation](https://mozilla.github.io/pdf.js/), text content and
  worker setup
- [tesseract.js documentation](https://github.com/naptha/tesseract.js), worker
  lifecycle and confidence reporting
- [Anthropic API: Messages](https://platform.claude.com/docs/en/api/messages)
  and structured outputs, direct browser access header, current model ids

Phase 1 (tax engine):

- [SARS: Rates of Tax for Individuals](https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/),
  brackets, rebates, and thresholds for both supported years
- [National Treasury: Budget 2026 Tax Guide](https://www.treasury.gov.za/documents/National%20Budget/2026/sars/Budget%202026%20Tax%20guide.pdf),
  2026/27 changes including the retirement cap increase
- [SARS: Rates per kilometre](https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/),
  prescribed reimbursive travel rates
- [SARS: CGT annual exclusion](https://www.sars.gov.za/types-of-tax/capital-gains-tax/proceeds/calculation-of-taxable-capital-gains-and-assessed-capital-losses/annual-exclusion/)
- [PwC Tax Summaries: South Africa income determination](https://taxsummaries.pwc.com/south-africa/individual/income-determination),
  cross-check for the 2026/27 CGT exclusions
