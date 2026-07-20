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

This round adds an ITA34-styled document view: the estimated assessment (or
a Compare-page comparison) rendered in the visual language of the real SARS
Notice of Assessment, for onscreen review, printing to PDF, and side by side
comparison, covering income and deduction categories the sample data may not
happen to show, not just the ones a given user currently has.

- **The statement document (`/statement`).** `src/lib/document/statement.ts`
  reshapes an already-computed `Assessment` into the ITA34's own section
  layout, structured against a real reference ITA34 section by section:
  a Details block (year of assessment, date generated, type of document),
  Balance of Account, Assessment Summary Information with the reference's
  "Calculated Tax Liability:" subheader, Tax calculation, Income grouped by
  category (Employment income [IRP5/IT3(a)], Local Interest Income, Local
  Rental Income, Other Income, Capital Gains, only the categories that have
  data), Deductions allowed, Taxable income with the SARS rating
  percentage, and numbered Notes. No tax is calculated here, only
  presented, so it stays outside `tax-engine`. `Ita34Document.tsx` renders
  it with navy section banners, steel-blue column headers, and bordered
  tables matching the real document's look, independent of the app's own
  emerald/slate theme (a document should look like paper regardless of
  light or dark mode), with a persistent "not an official SARS document"
  banner on screen and in print, not only a print-only header.
- **The reference's two amount columns, reproduced faithfully.** Every
  coded table carries both a "Computations & adjustments" column (component
  figures) and an "Amount assessed" column (the signed contribution), and
  rows follow the real document's conventions: employment code lines show
  the same figure in both columns, local interest (4201) is
  computations-only with the "Investment exemption" adjustment beneath it
  and the taxable net on the section header, retirement (4029) shows its
  contribution build-up ("Amount b/f from previous year", pension/provident
  versus retirement annuity split) as indented computations-only rows
  followed by the reference's two blue narrative captions quoting the
  actual section 11F limits ("Deduction limited to lesser of R350 000 or
  27,5% of the greater of taxable income or remuneration", with the real
  figures). Rebates and medical credits nest as children under one
  "Rebates" umbrella row, and PAYE sits as a 4102 detail line under an
  "Employees' tax" parent, both exactly as the reference groups them. The
  gross `remuneration` figure the narrative needs was already computed
  inside `composeAssessment` and is now exposed on `Assessment`
  (test-first, per the tax-engine discipline).
- **Notes are numbered mini-sections, not bullets.** A "Medical Rebates for
  persons below 65 without a disability" style note (heading worded from
  the taxpayer's actual age band and disability status) carries the
  contributions detail and credit amounts as label:value rows, a Capital
  gains note quotes the year's inclusion rate and annual exclusion, and the
  assessment's own warnings surface verbatim in a final note.
- **SARS-only fields are omitted, never faked.** The real ITA34 carries a
  Reference number, Document number, PRN, Contact Details, Compliance
  Information, and a marital/communal-estate declaration. This app has no
  honest equivalent for any of them, so the statement leaves them out
  entirely rather than printing fabricated identifiers or placeholder
  values, both to stay truthful and to avoid impersonating a SARS-issued
  document.
- **Compare mode.** The Compare page's already-computed comparison rows
  (`ComparisonRow[]`) are handed to the same document as a three-column
  variance layout, Your calculation / SARS assessment / Variance, grouped
  the same way the Compare table already groups rows. The parsed SARS
  figures live only in the Compare page's component state, never in
  `AppData`, so they cross to the `/statement?mode=compare` route through a
  small sessionStorage handoff (`src/lib/document/handoff.ts`), tab-scoped
  and read without clearing (clearing on read broke under React Strict
  Mode's dev double-invocation, the second call would see the entry already
  gone). A missing or malformed handoff falls back to the solo view.
- **Two lines that were previously invisible to Compare now have SARS
  codes.** Net rental income and the taxable capital gain line in
  `composeAssessment` carried no code, and section 18A donations carried no
  code either, so `compareAssessments` (which skips uncoded lines) never
  surfaced them even when they differed from SARS. They now carry codes
  4210, 4250, and 4011 respectively, sourced from the published SARS source
  code list, so a mismatch on rental, CGT, or donations now shows up in the
  Compare table and the comparison statement, where before it was silently
  skipped.
- `groupComparisonRows`, previously private to `ComparePage.tsx`, is now
  exported from `src/lib/tax-engine/compare.ts` so the Compare table and the
  comparison statement group rows identically instead of two
  implementations drifting apart.
- Print CSS: the existing print stylesheet forces a white background on
  html/body, which does not reach the statement's own navy and steel-blue
  backgrounds, but browsers still strip non-white backgrounds from print
  output by default. A rule scoped to `.ita34-doc` opts back in with
  `print-color-adjust: exact`, and an `@page` rule sets A4 size and margins.

How it is tested: written test-first, `assessment.test.ts` and
`compare.test.ts` assert the new codes, the `remuneration` field, and
`groupComparisonRows`'s grouping before the implementation existed.
`src/lib/document/__tests__/statement.test.ts` covers the two-column row
conventions per section (both-columns employment lines, computations-only
interest with the exemption adjustment, the retirement build-up rows and
narrative captions with their real figures), category ordering, the Rebates
umbrella and its children including the secondary/tertiary rows for an
older taxpayer, the Details block, the numbered notes, the summary and
taxable-income figures, the refund versus payable framing, that empty
categories are omitted entirely rather than zero-filled, and that the
income section totals always reconcile to the assessment's income total
(the test that caught 37xx allowance codes falling out of the employment
grouping). `handoff.test.ts` covers the round trip, a missing entry,
reading twice without clearing, and a malformed payload.
`StatementPage.test.tsx` covers the solo layout including the revision's
structural elements, the comparison layout with a handoff present, and the
fallback when `mode=compare` has no handoff to read. The rendered page was
also verified visually against the reference ITA34 in a real browser with
a seeded scenario reproducing the reference's figures. The full suite,
lint, typecheck, and build pass locally.

Research links consulted: SARS's source code finder
(https://www.sars.gov.za/types-of-tax/personal-income-tax/filing-season/find-a-source-code/)
for the rental, capital gain, and donations codes, and TaxTim's summary of
the capital gains tax source codes
(https://www.taxtim.com/za/blog/the-new-capital-gains-tax-source-codes) as a
cross-check.

A third mobile issue found from live screenshots, same PR, same round of
testing as the two below:

- **Checkbox labels bleeding off the card on mobile.** DaisyUI's `.label`
  sets `white-space: nowrap`, built for a short label like "Remember me".
  Every checkbox label in this app is a full sentence instead ("I or a
  member of my household have a SARS-recognised disability..."), so on
  mobile the text could not break at all and ran the row, and visually the
  whole card, off the right edge of the viewport. Fixing the wrap needed
  two more rules underneath, the same `min-width: auto` default at two
  levels (the label as a CSS grid item inside a column track that only
  exists at `sm:` and up, and the label's text span as a flex child of the
  label). Verified against a real mobile viewport: the disability label
  went from a 738px-wide row on a 390px viewport to wrapping across three
  lines inside the card; confirmed desktop is unaffected.

Two more mobile issues found from live screenshots, in the same PR as the
figure-flex fix below since both came from the same round of user testing:

- **Blank m² and kilometre fields on Deductions.** Office area, total home
  area, total kilometres, and business kilometres all render their value as
  an empty string when 0 (so the user isn't stuck looking at a literal "0"
  while typing a real figure), but had no placeholder to fill that gap.
  Next to currency fields on the same page, which always show something
  (`R` plus `0.00`), a box with nothing in it at all reads as broken rather
  than just unset, especially in dark mode. Fixed by adding a `0`
  placeholder to all four; they were the only inputs in the codebase using
  the `value={x || ""}` pattern without one.
- **Mobile legal disclaimer hidden under the sticky bars.** The mobile
  disclaimer block in `AppShell.tsx` reserved just enough bottom padding to
  clear the bottom-tab dock nav alone. Deductions, Results, and Other
  Income each also render a `StickyActionBar` above the dock, and combined
  the two fixed bars covered the disclaimer's last line. Fixed with one
  padding bump (`pb-20` to `pb-28`) rather than threading sticky-bar
  awareness from three pages into the shell. Verified by measuring the
  disclaimer text's bounding box against the sticky bar's on a real
  headless-Chromium mobile viewport: a 24.6px clear gap now, where it
  previously overlapped.

Follow-up round: the previous mobile readability fixes did not actually
resolve the reported chart squishing, because they treated the symptom
(overlapping labels) rather than the cause. This round found and fixed the
real cause, verified against a real headless-Chromium mobile viewport
(Playwright, 375px, a seeded 12-month payslip dataset) rather than by code
review alone:

- **Root cause of the chart squishing.** `BracketBar` and `MonthlyBars` both
  use `<figure>` as their outer wrapper. DaisyUI's card component applies
  `display: flex; flex-direction: row; align-items: center; justify-content:
  center` to every `<figure>` on the page, styling meant for a card's
  thumbnail image. That silently turned each chart's stacked children into
  centered, shrink-to-fit row items on any screen width, which is what was
  actually crushing bracket labels together, not the label placement itself.
  Fixed with one rule in `globals.css` (`figure { display: block; }`)
  rather than override classes on every figure, consistent with the
  existing `.input`/`.select`/`.textarea` max-width rule already in that
  file for the same kind of DaisyUI base-style override.
- **Results ledger table.** Separately, the SARS code sat in its own fixed
  `w-20` column, leaving the description column too narrow on a 375px
  viewport for anything but one word per line. The code now renders inline
  as a small mono chip before the description on mobile, and keeps its own
  column at `sm:` and up.
- **Verified, not assumed.** Both fixes were confirmed by seeding a
  representative `AppData` object into `localStorage` and driving the app
  with Playwright at a 375px viewport: screenshots of Home, Results,
  Deductions, and Compare, plus an end-to-end test of uploading a JSON file
  into the Compare page's file input and confirming the comparison table
  populated correctly.

Previous round in this series (mobile readability fixes and a structured
file import for the Compare page, reported directly against the live
mobile app):

- **Bracket chart legibility.** `BracketBar` (used on the dashboard and the
  Results page's marginal rate chart) used to print each bracket's rate
  label inside its own segment. On a linear rand scale the lower brackets
  are only a few percent of the bar's width, so their labels overlapped
  into unreadable text on narrow screens. Rate labels now live in a
  wrapping legend row below the bar instead, with a coloured swatch per
  rate and the taxpayer's active bracket marked "(you)", so every rate
  stays legible at any width. The segment bar itself is unchanged, only
  where the text renders moved.
- **Monthly income and PAYE chart.** `MonthlyBars` is a fixed-viewBox SVG
  that scales down uniformly on narrow screens, shrinking axis and month
  labels below a readable size. It now sits in a horizontal-scroll wrapper
  with an explicit minimum width, so the chart keeps its designed font
  size and scrolls horizontally on mobile rather than shrinking illegibly.
- **Form fields overflowing their card on mobile.** Native `date` and
  `number` inputs (Taxpayer details, dependents, the travel logbook
  section) carry an intrinsic minimum width that could push a grid cell,
  and the whole card, wider than the viewport, driving text and inputs off
  the right edge. Fixed globally in `globals.css`: DaisyUI's `.input`,
  `.select`, and `.textarea` are capped at `max-width: 100%`, and
  `.form-control` wrappers get `min-width: 0` so they can actually shrink
  inside a CSS grid, which is what the overflow needed.
- **JSON and Excel import for the SARS comparison.** The Compare page
  previously only accepted pasted ITA34 text. `src/lib/extraction/ita34-import.ts`
  adds two more paths into the same `ParsedIta34` shape: `parseIta34Json`
  (accepts a `{codes, summary}` object, a flat code/label map, or an array
  of row objects or tuples) and `parseIta34Workbook` (reads the first sheet
  of an uploaded `.xlsx`/`.xls`/`.csv` file via SheetJS, matching 4-digit
  SARS codes and known summary labels per row). Both follow the existing
  rule: a figure that cannot be read stays absent, never assumed to be
  zero. SheetJS is dynamically imported so it only loads when a file is
  actually chosen, not in the main bundle. The npm registry build of
  `xlsx` carries unpatched high-severity advisories (prototype pollution,
  ReDoS) with no fix available, a real concern for a library parsing
  untrusted user uploads, so the dependency is pinned to the vendor's own
  patched build (`xlsx@0.20.3` from `cdn.sheetjs.com`) instead of the
  npm-registry package.

How it is tested: `src/lib/extraction/__tests__/ita34-import.test.ts` covers
amount coercion (formatted strings, decimal commas, trailing-minus
negatives), all three JSON shapes, the row-mapping helper, and a real
xlsx-round-trip test (writes a workbook with SheetJS, reads it back through
`parseIta34Workbook`). The chart and form-overflow fixes are layout-only, no
new business logic, verified by running the existing suite unchanged (354
tests passing) plus a manual check of the built pages. No tax-engine
calculation changed, so no rand-figure tests were needed.

This round closes the remaining gaps between the original Stitch design
mockups and the shipped app, and adds three genuinely new tax features.

New tax engine capability (all rand-figure changes shipped test-first per
the project's testing discipline):

- **Travel allowance logbook deduction.** A new
  `src/lib/tax-engine/travel.ts` implements the SARS deemed cost method:
  the fixed cost for the vehicle value band divided by total kilometres,
  plus the fuel and maintenance rates where the taxpayer bore those costs
  in full, times logbook business kilometres, capped at the allowance
  received. Every tax year table now carries its own SARS cost scale,
  verified against the official PAYE-GEN-01-G03-A01 Rate per Kilometre
  Schedule (revision 19, effective 1 March 2026) for 2026/27 and the SARS
  eLogbook fixed cost tables for 2023/24, 2024/25, and 2025/26. Note the
  2026/27 scale changed the value bands (R115,000 steps) and its open top
  band has a different maintenance rate to the band below it.
- **Area based home office deduction.** `src/lib/tax-engine/home-office.ts`
  apportions the home's annual running costs by office floor area over
  total floor area, added to directly claimable office expenses. The
  deductions page captures both areas, shows the calculated office share
  live, and notes SARS's exclusive-use requirement.
- **Section 18A donations: itemisation and the 10 percent cap.** Donation
  certificates can now be captured individually (summed with the flat
  donations figure), and the assessment applies the section 18A cap of 10
  percent of taxable income after other deductions, with a warning that
  the excess carries forward. Previously donations were deducted uncapped,
  which overstated large claims relative to what SARS would allow.
- The new model fields (travel claim, home office areas, donation
  certificates) are normalised into legacy stored data on load and on
  cloud restore (`normalizeAppData` in `src/lib/model/defaults.ts`), so
  existing local storage or encrypted backups keep working.

Design gap closure across the app, per the Stitch mockups:

- Shared UI primitives (`src/components/ui/`): a linked progress stepper
  for the capture flow, a collapsible section with a summary figure, a
  mobile sticky action bar pinned above the tab dock, and a twelve month
  payslip coverage grid with an anomaly flag on months well above the
  typical month.
- Upload page: stepper and the month coverage grid.
- Other income: each section is now a collapsible card with its net total
  visible while collapsed, a combined other income summary card, the
  freelance record keeping tip, and a sticky continue bar on mobile.
- Deductions: stepper plus a live estimated impact panel (deductions
  allowed, taxable income, estimated result) that updates as figures are
  captured.
- Results: the marginal rate bracket bar now renders on the results page
  itself, and a mobile sticky bar keeps the estimated result, an export
  action, and the compare link visible while the ledger scrolls.
- Compare: a final outcome difference hero states in plain language whose
  figure is more favourable and by how much, the line table is grouped
  under Income, Deductions and allowances, and Tax liability and result
  with an icon status legend and a SARS figure coverage count, and small
  screens get a card per line instead of a horizontally scrolled table.
- Export: browser print-to-PDF (no new dependency) with the navigation
  chrome hidden and a print header on the results and compare pages, a
  Web Share / clipboard summary share on compare, and a link to SARS
  eFiling.

How it is tested: failing-test-first commits cover the travel engine
(`travel.test.ts`, reference values from the official SARS schedules), the
home office apportionment (`home-office.test.ts`), the extended 2025/26
assessment reference scenario including the donations cap and travel
warnings (`assessment.test.ts`), and legacy data normalisation
(`normalize.test.ts`). UI tests cover the new primitives, the travel and
home office capture flows, donation certificates, and the redesigned
compare table. The full suite, lint, typecheck, and build pass locally.

Research links consulted: the SARS Rate per Kilometre Schedule
(https://www.sars.gov.za/wp-content/uploads/Docs/PAYE/Tables/tables2026/PAYE-GEN-01-G03-A01-Rate-per-Kilometre-Schedule-External-Annexure.pdf),
the SARS eLogbook pages for 2023/24 through 2025/26
(https://www.sars.gov.za/wp-content/uploads/Docs/Logbook/2025-26-SARS-eLogbook.pdf),
and the SARS rates per kilometre page
(https://www.sars.gov.za/tax-rates/employers/rates-per-kilometre/).

The dashboard and navigation now follow the original Stitch design reference
more closely, and two pages that had no mobile-specific styling at all now
adapt properly on small screens:

- The dashboard's populated-state hero gained a second call to action,
  "Compare to SARS" (routing to `/compare`), alongside the existing "View
  calculation" link. "Compare to SARS" was chosen over the design's literal
  "Accept result" wording since the app has no SARS submission integration:
  the honest next step for a decision-support tool is checking your estimate
  against the real assessment, not a fabricated "accept" action with nothing
  behind it.
- The four dashboard stat figures (total income, PAYE paid, tax payable,
  effective tax rate) are now clickable `StatTile` components
  (`src/components/ui/StatTile.tsx`) with an icon, linking through to the
  page where that figure is captured or explained, instead of static text.
- The "next steps" capture bento (employment income / other income /
  deductions) now also renders, in a condensed form, once data exists, not
  only on the empty-state landing page. The shared bento markup was
  extracted into a local `CaptureLinksBento` component to avoid duplicating
  it between the two states.
- The mobile bottom-tab bar (`AppShell.tsx`) now shows five tabs, Home,
  Upload payslip, Deductions, Results, Compare, matching the Stitch mobile
  designs, instead of the previous four (Home, Income, Results, Compare).
- `ComparePage.tsx` and `AccountPage.tsx` had zero responsive Tailwind
  classes and broke down on narrow screens. Both pages' button rows (the
  mismatch-threshold/Compare controls, and the Save-to-cloud/Load-from-cloud
  actions) now stack vertically below the `sm` breakpoint and go inline
  above it, consistent with the pattern already used elsewhere in the app.

This is the first of several planned rounds closing gaps between the
original Stitch mockups (`docs/design/stitch/`, gitignored, contains real
design references) and the shipped app: a progress stepper and collapsible
sections on the Upload/Other-income/Deductions flow, a Travel
Allowance/Logbook deduction (not yet implemented at all), a home office
area-based percentage calculator, a Compare page redesign, and PDF export
are still outstanding and intentionally out of scope for this round.

How it is tested: `src/components/ui/__tests__/StatTile.test.tsx` covers the
new component's link and rendered value. `src/components/__tests__/AppShell.test.tsx`
was updated for the new five-tab dock composition. No tax-engine or
calculation logic changed, so no rand-figure tests were needed; the full
existing suite (`npm test`) and `npm run build` both pass unchanged.

Two earlier tax years are now selectable: 2023/24 and 2024/25, alongside
the existing 2025/26 (default) and 2026/27.

- `src/lib/tax-engine/tax-tables/year-2023-24.ts` and `year-2024-25.ts`
  follow the existing pattern: a versioned config file, never an edit to an
  existing year. Brackets, rebates, thresholds, and medical credits are
  identical across 2023/24, 2024/25, and 2025/26, a three-year bracket
  freeze confirmed against SARS's published archive rates (only the
  reimbursive travel rate per kilometre actually changes year to year:
  R4.64/km for 2023/24, R4.84/km for 2024/25, verified against SARS's
  PAYE-GEN-01-G03-A01 rate schedule rather than assumed).
- The retirement fund contribution deduction cap is R350,000 for both new
  years, confirmed unchanged until the R430,000 cap that starts in 2026/27.
- No UI changes needed: the tax year selector already lists whatever
  `listTaxYears()` returns, so both years appear automatically.

How it is tested: `src/lib/tax-engine/__tests__/tax-tables.test.ts` adds a
dedicated describe block per new year (period dates, brackets, rebates,
thresholds, medical credits, retirement cap, interest exemption, CGT
figures, and the year's own travel rate), and the existing
`it.each(listTaxYears())` integrity invariants (bracket continuity, sorted
ascending rates, threshold-matches-rebate) automatically extend to cover
them with no test changes required.

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
