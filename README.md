# Rate My Husky

A verified, UW-only professor review platform for University of Washington
students. Students sign in with a Google account ending in `@uw.edu`, browse and
search UW instructors, read AI-generated summaries of verified peer reviews
alongside official IASystem numerical ratings, and submit their own structured
reviews. Every reviewer is a verified UW account, and every submission passes an
AI moderation gate before it is published.

- **Live application:** https://382-rmh.netlify.app
- **Project website (overview / technical docs / user guide):** https://382-rmh.netlify.app/about
- **Course:** CSS 382, University of Washington Bothell
- **Team:** Alec Situ, Hyobin Yook, Bennett Anderson

> **Access / credentials.** The app is not password-protected at the site level,
> but submitting or reading reviews requires a Google Sign-In with an `@uw.edu`
> address (enforced server-side — see *§7 How the @uw.edu restriction works*).
> Graders without a UW Google account can browse the public landing page and
> `/about` documentation; exercising the signed-in features requires a `@uw.edu`
> login. No shared credentials are committed to this repo by design, since auth
> is delegated to Google and gated to the UW domain.

## 1. Project overview

- **Audience:** current UW (Seattle / Bothell / Tacoma) students.
- **Problem:** UW students rely on Rate My Professor, which does not verify that
  a reviewer ever took the course, and the official IASystem evaluations students
  complete each quarter are never surfaced back to them. Rate My Husky is a
  UW-only platform where every reviewer is a verified `@uw.edu` account and
  IASystem numbers are shown next to verified peer feedback.
- **What it does today (fully implemented):**
  - Google Sign-In gated to `@uw.edu` on both the client (UX) and server (source
    of truth).
  - A searchable catalog of **131 real UW Bothell professors**, filterable by
    name, department, course, campus, and minimum rating.
  - Professor profile pages showing official IASystem numerical ratings, the
    verified review list, and an AI-generated summary.
  - A structured review submission form (scores, would-take-again, written
    review, optional tags) protected by identity verification, a per-user rate
    limit, a uniqueness constraint, and an AI moderation pass.
  - Two server-side Gemini AI roles wired directly into the request path:
    **review summarization** and **submission moderation** (see §2).
- **Anonymity model:** reviewers are anonymous to other users and to
  instructors; identity is recoverable only under a formal university policy
  violation requiring legal process.

## 2. AI integration

AI is on the critical request path, not a side chat. Both roles call
`gemini-2.5-flash` through the `@google/generative-ai` SDK (`lib/gemini.ts`),
server-side only.

- **Review summarization** — `app/api/summary/[id]/route.ts`. When a professor
  has at least **5 verified reviews** (`MIN_VERIFIED`), the route builds a
  representative sample (the 5 most recent reviews plus up to 5 more drawn at
  random via Fisher–Yates), asks Gemini for a 2–3 sentence neutral overview of
  teaching style, workload/difficulty, and overall sentiment, and persists the
  result with the review count and a timestamp so profile pages render without
  recomputing. The professor profile page fetches this endpoint directly. Below
  5 reviews the app shows reviews verbatim with a "limited data" indicator; at
  zero it shows only IASystem ratings.
- **Submission moderation** — `app/api/reviews/route.ts`. Every review must pass
  a Gemini moderation check before it is written. The model rejects promotional
  content/links, personal attacks with no academic substance, off-topic
  submissions with no course-specific content, and gibberish. Because moderation
  is a hard gate on the write path, no review reaches the public site without the
  AI evaluating it first.

## 3. Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript — one
  codebase for UI and API routes, one deployment.
- [Tailwind CSS](https://tailwindcss.com/) (with a dark-mode theme).
- [Firebase Auth](https://firebase.google.com/docs/auth) (Google provider, gated
  to `@uw.edu`).
- [Cloud Firestore](https://firebase.google.com/docs/firestore) —
  `professors`, `reviews`, and `users` collections.
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) for
  server-side ID-token verification in API routes.
- [Google Gemini](https://ai.google.dev/) (`gemini-2.5-flash`) via
  `@google/generative-ai` for summarization and moderation.
- [Netlify](https://www.netlify.com/) deployment via the official
  `@netlify/plugin-nextjs` runtime.

## 4. Routes

Pages:

- `/` — landing / welcome page (signed-out marketing view, signed-in dashboard).
- `/login` — Google Sign-In.
- `/dashboard` — protected; redirects to `/login` when signed out.
- `/search` — professor catalog with name/department/course/campus/rating filters.
- `/professors/[id]` — professor profile: IASystem ratings, reviews, AI summary.
- `/professors/[id]/review` — structured review submission form.
- `/about` — public project website (Project Overview, Technical Documentation,
  User Guide).

API routes:

- `POST /api/auth/verify` — server-side ID-token verification + user upsert.
- `GET  /api/auth/review-eligibility` — whether the signed-in user may review.
- `GET  /api/summary/[id]` — generate/return the AI summary for a professor.
- `POST /api/reviews` — validated, rate-limited, moderated review submission.

## 5. Install dependencies

```bash
npm install
```

Requires Node.js 18.18+ (Next.js 14 baseline).

## 6. Configure Firebase

1. Create a Firebase project at <https://console.firebase.google.com/>.
2. **Web app:** in *Project settings → General → Your apps*, register a Web app.
   Copy the `firebaseConfig` values — these become the `NEXT_PUBLIC_FIREBASE_*`
   variables.
3. **Firestore:** *Build → Firestore Database* → create a database (production
   mode). The app uses `professors`, `reviews`, and `users` collections.
4. **Service account (Admin SDK):** *Project settings → Service accounts →
   Firebase Admin SDK* → **Generate new private key**. From the JSON you need:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` (keep the literal `\n`
     sequences; the app un-escapes them at startup).

## 7. Enable Google Sign-In

1. Firebase console → *Build → Authentication → Sign-in method*.
2. Enable **Google**, set a support email, save.
3. *Authentication → Settings → Authorized domains*: add `localhost` and your
   Netlify preview/production domain(s).

> The `hd=uw.edu` hint in `lib/firebaseClient.ts` is a UX hint only. It does
> **not** enforce the domain restriction — the server route does (see §9).

## 8. Set environment variables

```bash
cp .env.local.example .env.local
```

| Variable | Source |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web app config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web app config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Web app config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web app config |
| `FIREBASE_ADMIN_PROJECT_ID` | Service account JSON |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service account JSON |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service account JSON (keep literal `\n`) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) |

Never commit `.env.local`. The `.gitignore` already excludes it.

## 9. How the @uw.edu restriction works

Domain enforcement happens in two layers; both must pass.

1. **Client-side (UX):** after the Google popup, `lib/auth.ts` checks
   `user.email.endsWith("@uw.edu")`. A non-matching account is immediately
   signed out with a clear message.
2. **Server-side (source of truth):** every protected API route calls
   `requireUwUser` (`lib/serverAuth.ts`), which:
   - calls `adminAuth.verifyIdToken(token, /* checkRevoked */ true)`,
   - confirms `email_verified === true`,
   - confirms the decoded email ends with `@uw.edu`,
   - and rejects otherwise.

Because the Admin SDK runs only on the server with a service-account credential,
the client cannot bypass this check.

## 10. Anti-abuse and data-integrity controls

- **One review per course:** each review is stored under a composite document ID
  — `netid_professorId_courseSlug_campusSlug_quarterYear` — so a re-submission
  overwrites rather than stacking a second vote.
- **Rate limiting:** `RATE_LIMIT_MAX = 3` reviews per user per 24 hours blocks
  brigading.
- **Professors cannot review:** accounts matching a known-professor email set are
  blocked from submitting.
- **AI moderation gate + regex pre-filter** on every submission (see §2).
- **Aggregate integrity:** the professor's running rating average is updated
  inside a Firestore transaction on each accepted review.

## 11. Run locally

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit, no build
```

## 12. Seed the professor catalog

The seed scripts populate Firestore with the real UW Bothell catalog and
recompute aggregates. They require the `FIREBASE_ADMIN_*` variables in
`.env.local` and `seed.json` in the project root.

```bash
npx ts-node --project tsconfig.seed.json scripts/import_catalog.ts
npx ts-node --project tsconfig.seed.json scripts/recalculate_aggregates.ts
```

## 13. Deploy to Netlify

1. Push to GitHub.
2. Netlify → **Add new site → Import an existing project** → connect the repo.
3. Netlify auto-detects Next.js via `netlify.toml` and `@netlify/plugin-nextjs`.
4. Add every variable from §8 (including `GEMINI_API_KEY`) under *Site settings →
   Build & deploy → Environment*. For `FIREBASE_ADMIN_PRIVATE_KEY`, paste the
   value with literal `\n` sequences intact.
5. After the first deploy, add the Netlify domain to Firebase *Authorized
   domains* so Google Sign-In works in production.

## Project layout

```
app/
  page.tsx                          # / landing
  login/page.tsx                    # /login
  dashboard/page.tsx                # /dashboard (protected)
  search/page.tsx                   # /search
  about/page.tsx                    # /about (project website)
  professors/[id]/page.tsx          # professor profile + AI summary
  professors/[id]/review/page.tsx   # review submission form
  api/auth/verify/route.ts          # server-side ID-token verification
  api/auth/review-eligibility/route.ts
  api/summary/[id]/route.ts         # Gemini review summarization
  api/reviews/route.ts              # validated/rate-limited/moderated submission
components/                         # Navbar, AuthGuard, GoogleSignInButton, ...
lib/
  firebaseClient.ts                 # browser Firebase init
  firebaseAdmin.ts                  # server-only Admin SDK init
  serverAuth.ts                     # requireUwUser token gate
  gemini.ts                         # Gemini model (gemini-2.5-flash)
  auth.ts                           # sign-in / sign-out helpers
  firestore.ts                      # Firestore helpers
scripts/
  import_catalog.ts                 # seed 131 UW Bothell professors
  recalculate_aggregates.ts         # recompute rating averages
```

## License

Academic project for UW CSS 382. Not licensed for redistribution.