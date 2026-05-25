// app/professors/[id]/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc, getDoc, collection, query, where, getDocs, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import AuthGuard from "@/components/AuthGuard";
import type { User } from "firebase/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type IAsystemEntry = {
  course_code: string;
  section: string;
  quarter: string;
  year: number;
  responses: number;
  enrollment: number;
  overall_summative: number;   // 0–5
  cei: number;                 // 1–7
  summative_items: {
    course_as_whole: number;
    course_content: number;
    instructor_contribution: number;
    instructor_effectiveness: number;
  };
  ai_summary: string | null;
};

type Professor = {
  id: string;
  name: string;
  department: string;
  campus: string[];
  email: string;
  bio: string;
  courses_taught: string[];
  iasystem_ratings: IAsystemEntry[];
  ias_review_id?: string;
  overall_rating: number;
  ratings_count: number;
  tags: string[];
  summary: string | null;
  summary_updated_at: { seconds: number } | null;
  summary_review_count: number;
};

type Review = {
  id: string;
  professor_id: string;
  course: { code: string; name: string };
  campus: string;
  term: { quarter: string; year: number };
  scores: {
    overall: number;
    difficulty: number;
    clarity: number;
    helpfulness: number;
    would_take_again: boolean;
  };
  body: string;
  tags: string[];
  verified: boolean;
  created_at: { seconds: number } | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfessorPage() {
  return <AuthGuard>{(user) => <ProfessorView user={user} />}</AuthGuard>;
}

function ProfessorView({ user }: { user: User }) {
  const params = useParams();
  const router = useRouter();
  const professorId = params.id as string;

  const [professor, setProfessor] = useState<Professor | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("All");
  const [campusFilter, setCampusFilter] = useState<string>("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const profSnap = await getDoc(doc(db, "professors", professorId));
        if (!profSnap.exists()) { setNotFound(true); return; }
        const profData = { id: profSnap.id, ...profSnap.data() } as Professor;
        setProfessor(profData);

        const reviewsQ = query(
          collection(db, "reviews"),
          where("professor_id", "==", professorId)
        );
        const reviewsSnap = await getDocs(reviewsQ);
        const fetched = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
        // Sort client-side — avoids needing a Firestore composite index on professor_id + created_at
        fetched.sort((a, b) => (b.created_at?.seconds ?? 0) - (a.created_at?.seconds ?? 0));
        setReviews(fetched);
      } catch (err) {
        console.error("Failed to load professor:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [professorId]);

  const reviewCampuses = useMemo(() => {
    const s = new Set(reviews.map((r) => r.campus));
    return Array.from(s).sort();
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const starOk = starFilter === null || r.scores.overall === starFilter;
      const courseOk = courseFilter === "All" || r.course.code === courseFilter;
      const campusOk = campusFilter === "All" || r.campus === campusFilter;
      const verifiedOk = !verifiedOnly || r.verified;
      return starOk && courseOk && campusOk && verifiedOk;
    });
  }, [reviews, starFilter, courseFilter, campusFilter, verifiedOnly]);

  const buzzWords = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const r of reviews) {
      for (const tag of r.tags ?? []) freq[tag] = (freq[tag] ?? 0) + 1;
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [reviews]);

  const hasEnoughForSummary = reviews.filter((r) => r.verified).length >= 5;

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;

  if (notFound || !professor) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Professor not found.</p>
        <Link href="/search" className="text-sm text-husky-purple dark:text-husky-purpleLight hover:underline">← Back to search</Link>
      </div>
    );
  }

  const hasReviews = reviews.length > 0;
  const verifiedCount = reviews.filter((r) => r.verified).length;
  const unverifiedCount = reviews.filter((r) => !r.verified).length;
  const verifiedAvg = verifiedCount > 0
    ? Math.round((reviews.filter((r) => r.verified).reduce((s, r) => s + r.scores.overall, 0) / verifiedCount) * 10) / 10
    : 0;
  const unverifiedAvg = unverifiedCount > 0
    ? Math.round((reviews.filter((r) => !r.verified).reduce((s, r) => s + r.scores.overall, 0) / unverifiedCount) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-husky-purple dark:hover:text-husky-purpleLight transition-colors">Dashboard</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <Link href="/search" className="hover:text-husky-purple dark:hover:text-husky-purpleLight transition-colors">Browse Professors</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{professor.name}</span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-husky-light dark:bg-husky-purple/20 text-husky-purple dark:text-husky-purpleLight text-2xl font-bold">
              {professor.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{professor.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{professor.department}</p>
              <p className="text-xs text-husky-metallic dark:text-husky-gold mt-0.5">{professor.campus.join(" / ")}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/professors/${professor.id}/review`)}
            className="rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90 transition-colors"
          >
            ✏️ Write a Review
          </button>
        </div>

        {professor.bio && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{professor.bio}</p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          {/* Overall rating */}
          <div className="flex flex-col items-center py-5 px-4 gap-1 rounded-2xl bg-husky-light dark:bg-husky-purple/20">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Overall</span>
            <span className="text-3xl font-bold text-husky-purple dark:text-husky-purpleLight">
              {professor.overall_rating > 0 ? professor.overall_rating.toFixed(1) : "—"}
            </span>
            <StarRow rating={professor.overall_rating} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {professor.ratings_count} review{professor.ratings_count !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Verified rating */}
          <div className="flex flex-col items-center py-5 px-4 gap-1 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
            <span className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">✓ Verified</span>
            <span className="text-3xl font-bold text-husky-purple dark:text-husky-purpleLight">
              {verifiedAvg > 0 ? verifiedAvg.toFixed(1) : "—"}
            </span>
            <StarRow rating={verifiedAvg} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {verifiedCount} review{verifiedCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Unverified rating */}
          <div className="flex flex-col items-center py-5 px-4 gap-1 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Unverified</span>
            <span className="text-3xl font-bold text-husky-purple dark:text-husky-purpleLight">
              {unverifiedAvg > 0 ? unverifiedAvg.toFixed(1) : "—"}
            </span>
            <StarRow rating={unverifiedAvg} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {unverifiedCount} review{unverifiedCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Courses Taught</p>
          <div className="flex flex-wrap gap-2">
            {professor.courses_taught.map((c) => (
              <span key={c} className="rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── IASystem Ratings ─────────────────────────────────────────────────── */}
      {professor.ias_review_id && (
        <Link
          href={`/professors/${professor.id}/ias`}
          className="group flex items-center justify-between gap-4 rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm transition-colors hover:bg-husky-light/40 dark:hover:bg-husky-purple/10"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-husky-light dark:bg-husky-purple/20 text-2xl">
              🏛️
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">IASystem Ratings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View numerical ordinal ratings from official UW course evaluations.
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-husky-purple/90">
            View IAS Reviews →
          </span>
        </Link>
      )}

      {/* ── AI Summary ────────────────────────────────────────────────────────── */}
      <AISummarySection
        professor={professor}
        reviewCount={reviews.length}
        verifiedCount={verifiedCount}
        hasEnough={hasEnoughForSummary}
        user={user}
      />

      {/* ── Buzz-words ───────────────────────────────────────────────────────── */}
      {buzzWords.length > 0 && (
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">What Students Say</h2>
          <div className="flex flex-wrap gap-2">
            {buzzWords.map(([tag, count]) => (
              <BuzzWord key={tag} tag={tag} count={count} total={reviews.length} />
            ))}
          </div>
        </div>
      )}

      {/* ── Reviews ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Student Reviews
            {hasReviews && <span className="ml-2 text-sm font-normal text-gray-400 dark:text-gray-500">({reviews.length})</span>}
          </h2>

          {hasReviews && (
            <div className="flex flex-wrap gap-3">
              {/* Star filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Stars:</span>
                <button type="button" onClick={() => setStarFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${starFilter === null ? "bg-husky-purple text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                  All
                </button>
                {[5, 4, 3, 2, 1].map((s) => (
                  <button key={s} type="button" onClick={() => setStarFilter(starFilter === s ? null : s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${starFilter === s ? "bg-husky-purple text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                    {s}★
                  </button>
                ))}
              </div>

              {/* Course filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Course:</span>
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
                  className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-husky-purple">
                  <option value="All">All</option>
                  {professor.courses_taught.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Campus filter — only shows when reviews span multiple campuses */}
              {reviewCampuses.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Campus:</span>
                  <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)}
                    className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-husky-purple">
                    <option value="All">All</option>
                    {reviewCampuses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Verified filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">Source:</span>
                <button type="button" onClick={() => setVerifiedOnly(false)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${!verifiedOnly ? "bg-husky-purple text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                  All
                </button>
                <button type="button" onClick={() => setVerifiedOnly(true)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${verifiedOnly ? "bg-green-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                  ✓ Verified
                </button>
              </div>
            </div>
          )}
        </div>

        {!hasReviews ? (
          <NoReviewsState professorId={professor.id} />
        ) : filteredReviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">No reviews match your filters.</p>
        ) : (
          <div className="space-y-4">
            {verifiedCount < 5 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                <span className="text-amber-600 dark:text-amber-400 text-sm">⚠</span>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">Limited verified data</span> — fewer than 5 verified reviews.
                  AI summary not yet available.
                </p>
              </div>
            )}
            {filteredReviews.map((r) => <ReviewCard key={r.id} review={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Summary ───────────────────────────────────────────────────────────────

// How many new verified reviews since last summary triggers the stale nudge
const STALE_THRESHOLD = 3;

function AISummarySection({
  professor, reviewCount, verifiedCount, hasEnough, user,
}: {
  professor: Professor;
  reviewCount: number;
  verifiedCount: number;
  hasEnough: boolean;
  user: User;
}) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(professor.summary);
  const [summaryReviewCount, setSummaryReviewCount] = useState<number>(
    professor.summary_review_count ?? 0
  );
  const [updatedAt, setUpdatedAt] = useState<{ seconds: number } | null>(
    professor.summary_updated_at
  );
  const [error, setError] = useState<string | null>(null);

  const isStale =
    !!summary &&
    verifiedCount - summaryReviewCount >= STALE_THRESHOLD;

  async function fetchSummary() {
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/summary/${professor.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status})`);
      }

      if (!res.ok) {
        throw new Error((data.error as string) ?? `Server error (${res.status})`);
      }

      setSummary(data.summary as string);
      setSummaryReviewCount(data.review_count as number);
      setUpdatedAt({ seconds: Math.floor(Date.now() / 1000) });
    } catch (err) {
      setError("Couldn't load summary. Try again later.");
      console.error("[AISummarySection]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <SparkleIcon className="h-4 w-4 text-husky-purple dark:text-husky-purpleLight" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">AI-Generated Summary</h2>
        <span className="rounded-full bg-husky-light dark:bg-husky-purple/20 px-2 py-0.5 text-xs font-medium text-husky-metallic dark:text-husky-gold">Powered by Gemini</span>
      </div>

      {!hasEnough ? (
        <div className="rounded-md bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700 px-4 py-5 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            AI summaries require <span className="font-semibold">5 verified reviews</span>.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {verifiedCount === 0
              ? "No verified reviews yet."
              : `${5 - verifiedCount} more verified review${5 - verifiedCount !== 1 ? "s" : ""} needed.`}
          </p>
          {reviewCount > verifiedCount && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {reviewCount - verifiedCount} unverified review{reviewCount - verifiedCount !== 1 ? "s" : ""} not counted toward this threshold.
            </p>
          )}
        </div>
      ) : summary ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {updatedAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last updated {new Date(updatedAt.seconds * 1000).toLocaleDateString()}
                {summaryReviewCount > 0 && ` · based on ${summaryReviewCount} verified review${summaryReviewCount !== 1 ? "s" : ""}`}
              </p>
            )}

            {/* Stale nudge — shown when enough new reviews have come in since last generation */}
            {isStale && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {verifiedCount - summaryReviewCount} new review{verifiedCount - summaryReviewCount !== 1 ? "s" : ""} since last summary
                </p>
                <button
                  type="button"
                  onClick={fetchSummary}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-60 transition-colors"
                >
                  {loading ? <><Spinner small /> Regenerating...</> : "↺ Regenerate"}
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">This professor has enough verified reviews for an AI summary.</p>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90 disabled:opacity-60 transition-colors"
          >
            {loading ? <><Spinner small /> Generating...</> : "Generate Summary"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────

function ReviewCard({ review: r }: { review: Review }) {
  const date = r.created_at
    ? new Date(r.created_at.seconds * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRow rating={r.scores.overall} size="sm" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{r.course.code}</span>
          <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">{r.campus}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{r.term.quarter} {r.term.year}</span>
        </div>

        <div className="flex items-center gap-3">
          {r.verified ? (
            <span className="flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
              ✓ Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              Unverified
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Clarity: <span className="font-medium text-gray-700 dark:text-gray-300">{r.scores.clarity}/5</span>
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Helpfulness: <span className="font-medium text-gray-700 dark:text-gray-300">{r.scores.helpfulness}/5</span>
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Difficulty: <span className="font-medium text-gray-700 dark:text-gray-300">{r.scores.difficulty}/5</span>
          </span>
          {r.scores.would_take_again
            ? <span className="text-xs text-green-600 dark:text-green-400 font-medium">Would take again ✓</span>
            : <span className="text-xs text-red-500 dark:text-red-400 font-medium">Wouldn't take again</span>}
          {date && <span className="text-xs text-gray-400 dark:text-gray-500">{date}</span>}
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{r.body}</p>

      {r.tags && r.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {r.tags.map((t) => (
            <span key={t} className="rounded-full bg-husky-light dark:bg-husky-purple/20 px-2 py-0.5 text-xs text-husky-metallic dark:text-husky-gold">#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── No reviews state ─────────────────────────────────────────────────────────

function NoReviewsState({ professorId }: { professorId: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="text-4xl">📝</div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No peer reviews yet.</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">Be the first to leave a verified review.</p>
      <button type="button" onClick={() => router.push(`/professors/${professorId}/review`)}
        className="mt-1 rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90 transition-colors">
        Write a Review
      </button>
    </div>
  );
}

// ─── Buzz-word chip ───────────────────────────────────────────────────────────

function BuzzWord({ tag, count, total }: { tag: string; count: number; total: number }) {
  const pct = Math.round((count / total) * 100);
  const weight = count / total;
  const size = weight > 0.5 ? "text-base" : weight > 0.3 ? "text-sm" : "text-xs";
  const isNegative = ["disorganized", "no-curve", "fast-paced", "test-heavy"].includes(tag);

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 border cursor-default ${isNegative
        ? "border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
        : "border-husky-purple/20 bg-husky-light dark:bg-husky-purple/20 text-husky-purple dark:text-husky-purpleLight"
        }`}
      title={`${count} mention${count !== 1 ? "s" : ""} (${pct}% of reviews)`}
    >
      <span className={`font-medium ${size}`}>
        {isNegative ? "∼" : "↗"} {tag.replace(/-/g, " ")}
      </span>
      <span className="text-xs opacity-60">({count})</span>
    </div>
  );
}

// ─── Star row ─────────────────────────────────────────────────────────────────

function StarRow({ rating, size }: { rating: number; size: "sm" | "md" }) {
  const s = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`${s} ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 dark:fill-gray-600 text-gray-200 dark:text-gray-700"}`} viewBox="0 0 24 24">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function Spinner({ small }: { small?: boolean }) {
  const s = small ? "h-3.5 w-3.5" : "h-6 w-6";
  return <span aria-hidden="true" className={`inline-block ${s} animate-spin rounded-full border-2 border-white border-t-transparent`} />;
}
