# Project conventions

These rules apply to every commit, PR, and doc produced for this project, without
exception. They bind human contributors and coding agents equally.

## Git flow

- Branch model: `main` -> `dev` -> `feature/*`.
- Feature branches are created from `dev`, merge back into `dev` via reviewed PR,
  and are never deleted after merging.
- `dev` promotes to prod via reviewed PR plus passing CI. `main` stays a stable
  snapshot.
- Make many small commits per feature rather than one large one.

## Commit and writing style

- No `Co-Authored-By` trailers in any commit message, ever.
- No em dashes anywhere: not in commit messages, PR descriptions, code comments,
  or docs. Use a comma, a period, or "and"/"but" instead.

## Testing discipline

- Every feature ships with its own tests in the same PR. No feature is done
  without passing tests attached.
- Discipline is split by risk:
  - For `tax-engine` modules (brackets, rebates, deductions, the assessment
    composer, anything that produces a rand figure), tests are written before the
    implementation. A PR without a failing-test-first commit history for that
    module is not approved. This is where correctness bugs are expensive and easy
    to hide.
  - For UI components, hooks, and OCR/extraction glue code, tests are required in
    the same PR but can be written alongside or after the implementation.

## README

- Every feature PR updates the README: what changed, why, how it is tested, and
  any new research links consulted.
- The README reads as a professional, current account of the project, not a
  changelog dump.

## Review

- Extensive code review is required before merge to `dev`. At minimum, the
  self-review checklist below is worked through and confirmed honestly before
  requesting review. It is an internal process step, not PR content: verify
  each item locally and note in the PR description only that the checklist
  was completed, never paste the checklist itself into the public PR body.

### PR review checklist (verify locally before requesting review, do not paste into the PR)

- [ ] Tests added/updated for this change, and they fail without the change
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass locally
- [ ] README updated: what changed, why, how it is tested, research links if any
- [ ] No secrets, API keys, or real personal financial figures committed
- [ ] No `Co-Authored-By` trailers, no em dashes, in commit messages or this PR
- [ ] Security-relevant change reviewed for: Firestore rule impact, input validation,
      new third-party data flow (does data leave the browser, and is that consented to)

## Private documents

- Design references and any doc containing real personal financial figures stay
  gitignored: `docs/PROJECT_SPEC.md`, `docs/SARS_CALCULATOR_PROJECT_SPEC.md`,
  `docs/design/`, `docs/notes/`. Never commit them.
- No secrets, API keys, or credentials are ever committed. Environment variable
  conventions are documented in the README.
