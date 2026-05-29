## PISAN-Suggest.md

*Produced by Claude.AI on 2026-05-29*

## Project Overview

Rate My Husky (repo `382-uwb-rate-my-profs`) is a Next.js 14 (App Router) + React 18 + TypeScript + Tailwind web app that lets verified UW students browse UW Bothell professors, read official IASystem evaluation data, submit structured reviews, and read Gemini-generated summaries of those reviews. Auth is Firebase Google Sign-In gated to `@uw.edu` on both the client and the server (Admin SDK + `verifyIdToken(checkRevoked=true)`); persistence is Firestore. Two Gemini integration points are wired in: (1) review moderation on `POST /api/reviews` and (2) on-demand summary generation on `GET /api/summary/[id]`. A real seed catalog of 131 UW Bothell professors and 109 courses lives in `seed.json` (loaded via `scripts/import_catalog.ts`). Contributors per `git shortlog`: Hyobin Yook (~20 commits, core schema/UI/moderation), Alec Situ (~25 commits across two emails, auth/summary/professor-blocking), and `kjfhouwhgq8424bnwf` registered to `bennetto@uw.edu` (~7 commits, dark mode + IAS data + security fixes).

## Evaluation Against Assignment Specification

Evaluation based only on what is visible in the GitHub repository.

### UW Community Impact (10 pts)

Strong fit for UW. The product solves a problem the proposal frames clearly: existing rate-my-professors data for UW is noisy and unverifiable, and the official IASystem written feedback is not student-accessible. The repo backs the UW framing with real data: `seed.json` is a generated dump from the actual UW Bothell time-schedule catalog (`generatedAt: 2026-05-21`, `professorCount: 131`, `courseCount: 109`), professor IDs are domain-derived (e.g. `awad_a`, `Awad,A`), the IASystem schema captures the actual UW evaluation items (overall summative 0-5, CEI 1-7, four summative items), and `@uw.edu` gating is enforced server-side with refresh-token revocation. The UW connection is *not* cosmetic here — it is the platform's defining constraint. Ceiling: only UW Bothell is in the catalog today; the search UI advertises Bothell / Seattle / Tacoma campus pills but the seed contains only Bothell, and `app/about/page.tsx` lines 8-11 still reads "Replace these placeholders as the project matures." Score estimate: **9/10**.

### AI Integration (15 pts)

AI is meaningfully embedded, not a sidecar chat. Two distinct Gemini call sites both gate user-facing behavior:

1. **Review moderation** (`app/api/reviews/route.ts:74-132`): every review body is sent to `gemini-2.5-flash` with a constrained JSON-only prompt; the parsed `{pass, reason}` decides whether the write to Firestore proceeds. Includes a pre-filter of cheap regex spam patterns, a three-attempt exponential backoff on quota errors, and graceful degradation on parse failure.
2. **Per-professor summary** (`app/api/summary/[id]/route.ts:1-114`): on demand, the route samples 5 most-recent + 5 random verified reviews (Fisher-Yates), builds a prompt that includes per-review scores plus body, calls Gemini, persists the summary plus `summary_review_count` and `summary_updated_at` to the professor doc, and the UI surfaces a "stale" nudge when ≥3 new verified reviews have arrived since the last generation (`app/professors/[id]/page.tsx:580-582`).

Both calls are gated by `requireUwUser` so cost cannot be burned by anonymous traffic. The integration is structurally central (no Firestore write of a review without an AI moderation pass, no summary panel without an AI call) and the prompts are well-engineered (third-person, neutral, plain prose only).

Weaknesses cost the rest: (1) the moderation routine's `parse_error_defaulted_pass` branch returns `pass: false` despite the comment saying "fail open to avoid blocking legit reviews" — the code contradicts the intent and will silently reject reviews on a single Gemini parse error; (2) `moderation_skipped_no_key` also returns `pass: false`, so a missing `GEMINI_API_KEY` blocks all writes rather than failing open with a warning; (3) the `IAsystemEntry.ai_summary` field is read by the UI but no route generates it — the values came in via the `d5dbd22 initial ias review data` data dump, so today this is hand-curated data, not AI output; (4) the spam pre-filter `/\bsucks\b/i` will reject any legitimate review that uses the word ("this class sucks all the joy out of CSS") before Gemini ever sees it. Score estimate: **12/15**.

### Technical Execution (25 pts)

The codebase is unusually well-engineered for a class project. Highlights from the code:

- Two-layer `@uw.edu` enforcement that is the right design: client check in `lib/auth.ts:30-38` for UX, server-side `requireUwUser` (`lib/serverAuth.ts:24-66`) doing `verifyIdToken(checkRevoked=true)` + `email_verified === true` + domain match for every protected route.
- Refresh-token revocation on rejected sign-in (`app/api/auth/verify/route.ts:47-53`) so a non-UW account cannot replay an old token.
- Real, idempotent professor-aggregate update via a Firestore transaction (`app/api/reviews/route.ts:292-308`) instead of a naive last-write-wins overwrite.
- A deterministic review doc ID (`${netid}_${professor_id}_${courseSlug}_${campusSlug}_${quarter}${year}`) prevents duplicate reviews per (student, prof, course, term).
- Server-side campus derivation from the professor doc (`route.ts:243-257`) rather than trusting client input, with a clear comment about why ("prevent spoofing").
- Rate limit of 3 reviews per 24h via a `created_at >= oneDayAgo` Firestore query (`route.ts:204-217`).
- Real PR/branch workflow: 16 merged PRs, feature branches like `yook-write-review`, `Alec/Work-Summary`, `kj-dark-mode`, `kj-security-fixes`, with squashed merges into `main`. This is the kind of milestone evidence the rubric explicitly rewards.

Concerns:

1. **No deployed URL is committed anywhere.** `netlify.toml` is configured and the README walks through the Netlify setup, but the README does not list the production URL and there is no badge or "live demo" link. The grader cannot click a working instance from the repo, which is the single biggest fixable item.
2. **No CI.** There is no `.github/workflows/` directory; nothing runs `npm run typecheck` or `next build` on PR. With three contributors and 16 PRs already merged, this is the right time to add a 10-line workflow.
3. **No automated tests.** `package.json` exposes `dev`, `build`, `start`, `typecheck` — no `test` script. Pure functions like `sampleRandom`, the `isValidScore` validator, the `parse_error` paths in `moderateReview`, and the `STALE_THRESHOLD` logic are all trivially testable.
4. **`moderateReview` fails closed when the intent is to fail open** (`route.ts:126-127`): the variable name `parse_error_defaulted_pass` says "default to pass" but `pass: false` is returned. This is a real correctness bug that will only manifest under transient Gemini outages.
5. **Review-eligibility fallback is permissive** (`lib/reviewEligibility.ts:28, 35`): when the eligibility API fails, the client returns `true` and the UI shows the review button. The server route still rejects the write via `isProfessorAccount`, so it's defense-in-depth, but a confusing UX (button appears clickable, then the submit silently fails).
6. **No Firestore Security Rules in the repo.** The README itself flags this as a recommended next step (lines 117-119), but production-readable Firestore from the client side without rules is a real exposure — anyone with the public `NEXT_PUBLIC_FIREBASE_*` values can `getDocs(collection(db, "reviews"))` without going through `requireUwUser`. The rules file should land in the repo (under `firestore.rules`) and be referenced from `firebase.json`.
7. **`app/professors/[id]/page.tsx` is 819 lines** in one file, mixing the hero, IASystem panel, AI-summary section, review filters, review card, tooltip, and icons. Time to split into `components/professor/HeroCard.tsx`, `IAsystemPanel.tsx`, `AISummarySection.tsx`, `ReviewCard.tsx`.
8. `flashModel` is constructed at module import (`lib/gemini.ts:4-11`) and throws if `GEMINI_API_KEY` is missing. That will turn a missing env var into a build-time failure on Netlify rather than a clean runtime error message, and it makes `next build` impossible without the key. Either lazy-init or throw on first use.
9. The contributor identity `kjfhouwhgq8424bnwf <bennetto@uw.edu>` is unusual. The instructor should confirm this maps to a real teammate; peer-review attribution will otherwise be ambiguous.
10. `AuthGuard.tsx:47-50` and `[/api/reviews]` log `console.log` lines (including the email under check) on every protected-page load and every review attempt. These should be gated behind `process.env.NODE_ENV !== "production"` or removed; logging PII in production is a real concern.

Score estimate: **18/25**.

### Project Web Presence (15 pts)

The README (`README.md`) is detailed and useful: clear sectioned setup (Firebase, env vars, Netlify), an `@uw.edu` enforcement explanation, a "Project layout" file map, and a note on which checks are UX vs. source-of-truth. That is good developer documentation. What is missing is the "why" and "how" facing a non-developer reader:

- No live URL anywhere — `README.md` line 152 just says "trigger a deploy."
- `app/about/page.tsx` exists but its own header reads "Documentation and project notes. Replace these placeholders as the project matures" (lines 9-11) — graders landing here see a self-described placeholder.
- No screenshots, demo gif, or architecture diagram in the repo.
- The signed-out home page (`app/page.tsx:84-127`) is on-message and well-designed (Husky purple, three feature cards, clear value prop). If you deploy and that page is the landing experience, half of "Project Web Presence" is already done.

Score estimate: **8/15**. Would be 12-13/15 with a live URL in the README and an `/about` page that actually explains the product, the team, and how the AI is used.

### Milestones & Planning (20 pts)

Commit history shows real iterative work over ~14 days with clear milestone progression:

- Scaffold + restructure (2026-05-14 to 05-17): firebase packages, login redirect, restructure to repo root
- Search + profile + seed (2026-05-17 to 05-19): Gemini-powered review route, professor search and profile pages, navbar auth state, Netlify deploy fix
- Write-review feature (2026-05-20 to 05-21): write-review page, Firestore schema redesign, moderation fix, score display
- Hardening (2026-05-24): Gemini 2.0 → 2.5 + rate-limit + retry, moderation logging fix for Netlify's read-only FS, moderation prompt loosening, AI summary endpoint
- Polish (2026-05-25 to 05-28): auth-flow fixes, dark mode, IASystem data load, login error message, professor-blocking, review sort by term/post

Contributor balance is real but uneven. By commit count: Alec ~25, Yook ~20, kj ~7. By substantive feature area, both Alec and Yook own distinct, load-bearing features (Alec: auth/summary/blocking; Yook: schema/review/moderation), and kj contributed the dark mode, the IAS data load, and the security/auth-flow fixes. For a 3-person team this distribution is defensible and probably the healthiest balance among the projects reviewed in this cohort. PR-based workflow with feature branches per person and per-feature is exactly what the rubric is looking for.

Gaps: no `MILESTONES.md` mapping commits back to the proposal's Week 1-2 / 3-4 / 5-6 plan, no tagged releases, no project board visible in the repo. The proposal's `Docs/PROPOSAL.md` is committed and includes the milestone roadmap (good), but there is no public status update against it (e.g., "Week 5 MVP delivered: signin, search, profile, AI moderation, AI summary").

Score estimate: **16/20**.

### Peer Review (15 pts) — Not evaluable from repository alone

Nothing peer-review-specific is committed. Defer to instructor records.

**Subtotal excluding Peer Review: ~63 / 85**

## Suggested Improvements & New Features

### UI / UX

1. **Deploy and put the URL at the top of `README.md`** plus on `app/about/page.tsx`. Without it, the entire signed-out marketing experience is invisible to graders.
2. **Replace the `app/about/page.tsx` placeholder** with a real "why / how / who" page: problem statement, the two AI integration points (moderation + summary) with a one-line "what Gemini sees", the IASystem data source explanation, the three team members and what each owned. Half of "Project Web Presence" gets done in 30 minutes.
3. **Add a screenshot of a professor profile page** (one with reviews, one with an AI summary visible) to the README. The profile UI is the strongest visual asset and currently invisible until you sign in.
4. **Clarify the "Review Disabled" state for professors** in `app/professors/[id]/page.tsx:243-251`. Today it just says "Professor accounts cannot submit reviews." but a non-professor whose eligibility API failed will *also* see a disabled button (because of the permissive fallback). Add a "(temporary — try again)" hint when the eligibility check errored.
5. **Loading state on the search page** (`app/search/page.tsx:168-170`) is a centered spinner with no skeleton. Render 4-5 placeholder cards so the page feels populated.
6. **Show the IASystem `ai_summary` provenance** — today the UI calls it "Student Comments Summary" with no indication that it was either pre-generated or curated. A small badge ("auto-summary · last refreshed YYYY-MM-DD") would build trust and surface stale data.

### New Features

1. **A `firestore.rules` file + `firebase.json` reference**. The README itself flags this as the recommended next step (line 117-119). Without rules, the `NEXT_PUBLIC_*` Firebase config (which is necessarily exposed to the client) lets anyone read the `professors` and `reviews` collections directly via the Firestore REST API. The right rule is `request.auth.token.email.matches('.*@uw[.]edu$')` on read/write of `professors` and `reviews`.
2. **A "report this review" flow.** The schema already has `flagged: false` and `status: "published"` (`route.ts:270-271`). A one-click report button that flips `flagged: true` and notifies an admin queue would turn an honest gap into a real moderation surface.
3. **Per-quarter IASystem trend.** The `IAsystemEntry[]` is a list; today the UI shows one entry at a time via a select. A small sparkline of `overall_summative` across the most recent N quarters per professor would be a clear "data we have but don't show" win.
4. **A professor-level "courses currently teaching" badge.** The seed has `mostRecentTerm` per professor and `courses` keyed by code with term lists. Surface "currently teaching CSS 343 (SPR2026)" on the search results card — the data is one transformation away.
5. **Seed Seattle/Tacoma professors.** The search page advertises three campuses; the seed has one. Even a thin Seattle CSE seed would deliver on the platform's "verified UW students" promise across campuses.
6. **`.ics` of when a professor next teaches a given course** — turns the catalog into an action.

### Code Quality / Technical

1. **Fix the `parse_error_defaulted_pass` bug** in `app/api/reviews/route.ts:126-127`: either return `pass: true` (matching the variable name and the comment), or rename the variable and update the comment to reflect the closed-by-default policy. Right now the code and the intent disagree and the silent rejection on any parse error will be hard to debug later.
2. **Don't block writes when `GEMINI_API_KEY` is missing** (`route.ts:75-78`). For a class demo where a teammate runs locally without the key, the current behavior makes the whole platform feel broken. Return `pass: true, reason: "moderation_skipped_no_key"` with a 200 status and a server-side warning.
3. **Loosen the spam pre-filter** at `route.ts:220-225`. The `/\bsucks\b/i` and `/^[a-z\s]{1,6}(\s[a-z]{1,6}){3,}$/i` rules will reject many legitimate short reviews. Trust Gemini for content judgment and use the regex layer only for unambiguous spam (links, "buy my").
4. **Add CI.** A single `.github/workflows/ci.yml` running `npm ci && npm run typecheck && npm run build` on push to `main` and on PR would catch deploy-breakers before Netlify does. The whole file is under 25 lines.
5. **Add `firestore.rules`** and reference it from `firebase.json`. See "New Features" #1.
6. **Lazy-init `flashModel`** (`lib/gemini.ts`). Convert it from a module-level constant to a `getFlashModel()` function so missing env vars surface as a 500 from the route, not a crash on import (which breaks `next build` and `npm run typecheck` for anyone who cloned without the key).
7. **Split `app/professors/[id]/page.tsx` (819 lines)** into a directory of components. `IAsystemPanel`, `AISummarySection`, `ReviewCard`, `BuzzWord`, `Tooltip`, and the SVG icons should each live in their own file under `components/professor/`. The current single-file `page.tsx` is the largest file in the repo and will only grow.
8. **Gate debug logs behind `process.env.NODE_ENV`** in `AuthGuard.tsx:47-57`, `app/api/reviews/route.ts:57, 62, 70, 106, 121`, and `app/api/summary/[id]/route.ts:98, 110`. Logging the user's email on every protected-page load is unnecessary PII exposure.
9. **Add a Firestore composite index** for `reviews(professor_id, created_at desc)` so the client load in `app/professors/[id]/page.tsx:111-118` does not have to fetch all reviews and sort in memory. The code comment even acknowledges this ("avoids needing a Firestore composite index"); for >50 reviews per professor this will start to matter.
10. **Standardize commit author identity** for `kjfhouwhgq8424bnwf <bennetto@uw.edu>`. A `git config --global user.name "Real Name"` per teammate before the final submission would make `git shortlog` cleanly attributable for peer review.
11. **Pin Node version in `netlify.toml`** with `[build.environment] NODE_VERSION = "20"`. `package.json` declares `engines.node >= 18.18`; without a pin in Netlify, a future runtime bump can break the deploy silently.

---

*End of automated feedback. — Pisan (via Claude.AI, model: claude-opus-4-7)*
