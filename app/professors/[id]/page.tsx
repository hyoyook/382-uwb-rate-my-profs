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

const SUMMATIVE_LABELS: Record<keyof IAsystemEntry["summative_items"], string> = {
  course_as_whole: "Course as a whole",
  course_content: "Course content",
  instructor_contribution: "Instructor contribution",
  instructor_effectiveness: "Instructor effectiveness",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfessorPage() {
  return <AuthGuard>{(user) => <ProfessorView user={user} />}</AuthGuard>;
}

function ProfessorView({ user: _user }: { user: User }) {
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
        <p className="text-lg font-semibold text-gray-700">Professor not found.</p>
        <Link href="/search" className="text-sm text-husky-purple hover:underline">← Back to search</Link>
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
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-husky-purple transition-colors">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link href="/search" className="hover:text-husky-purple transition-colors">Browse Professors</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">{professor.name}</span>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-husky-light text-husky-purple text-2xl font-bold">
              {professor.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{professor.name}</h1>
              <p className="text-sm text-gray-500">{professor.department}</p>
              <p className="text-xs text-husky-metallic mt-0.5">{professor.campus.join(" / ")}</p>
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
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">{professor.bio}</p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          {/* Overall rating */}
          <div className="flex flex-col items-center py-5 px-4 gap-1 rounded-2xl bg-husky-light">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Overall</span>
            <span className="text-3xl font-bold text-husky-purple">
              {professor.overall_rating > 0 ? professor.overall_rating.toFixed(1) : "—"}
            </span>
            <StarRow rating={professor.overall_rating} size="sm" />
            <span className="text-xs text-gray-500">
              {professor.ratings_count} review{professor.ratings_count !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Verified rating */}
          <div className="flex flex-col items-center py-5 px-4 gap-1 rounded-2xl bg-green-50 border border-green-100">
            <span className="text-xs font-semibold uppercase tracking-wide text-green-600">✓ Verified</span>
            <span className="text-3xl font-bold text-husky-purple">
              {verifiedAvg > 0 ? verifiedAvg.toFixed(1) : "—"}
            </span>
            <StarRow rating={verifiedAvg} size="sm" />
            <span className="text-xs text-gray-500">
              {verifiedCount} review{verifiedCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Unverified rating */}
          <div className="flex flex-col items-center py-5 px-4 gap-1 rounded-2xl bg-gray-50 border border-gray-100">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Unverified</span>
            <span className="text-3xl font-bold text-husky-purple">
              {unverifiedAvg > 0 ? unverifiedAvg.toFixed(1) : "—"}
            </span>
            <StarRow rating={unverifiedAvg} size="sm" />
            <span className="text-xs text-gray-500">
              {unverifiedCount} review{unverifiedCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Courses Taught</p>
          <div className="flex flex-wrap gap-2">
            {professor.courses_taught.map((c) => (
              <span key={c} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── IASystem Ratings ─────────────────────────────────────────────────── */}
      <IAsystemPanel entries={professor.iasystem_ratings ?? []} />

      {/* ── AI Summary ────────────────────────────────────────────────────────── */}
      <AISummarySection
        professor={professor}
        reviewCount={reviews.length}
        verifiedCount={verifiedCount}
        hasEnough={hasEnoughForSummary}
      />

      {/* ── Buzz-words ───────────────────────────────────────────────────────── */}
      {buzzWords.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">What Students Say</h2>
          <div className="flex flex-wrap gap-2">
            {buzzWords.map(([tag, count]) => (
              <BuzzWord key={tag} tag={tag} count={count} total={reviews.length} />
            ))}
          </div>
        </div>
      )}

      {/* ── Reviews ──────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-white p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">
            Student Reviews
            {hasReviews && <span className="ml-2 text-sm font-normal text-gray-400">({reviews.length})</span>}
          </h2>

          {hasReviews && (
            <div className="flex flex-wrap gap-3">
              {/* Star filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Stars:</span>
                <button type="button" onClick={() => setStarFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${starFilter === null ? "bg-husky-purple text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  All
                </button>
                {[5, 4, 3, 2, 1].map((s) => (
                  <button key={s} type="button" onClick={() => setStarFilter(starFilter === s ? null : s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${starFilter === s ? "bg-husky-purple text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {s}★
                  </button>
                ))}
              </div>

              {/* Course filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Course:</span>
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-husky-purple">
                  <option value="All">All</option>
                  {professor.courses_taught.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Campus filter — only shows when reviews span multiple campuses */}
              {reviewCampuses.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Campus:</span>
                  <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-husky-purple">
                    <option value="All">All</option>
                    {reviewCampuses.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              {/* Verified filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Source:</span>
                <button type="button" onClick={() => setVerifiedOnly(false)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${!verifiedOnly ? "bg-husky-purple text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  All
                </button>
                <button type="button" onClick={() => setVerifiedOnly(true)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${verifiedOnly ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  ✓ Verified
                </button>
              </div>
            </div>
          )}
        </div>

        {!hasReviews ? (
          <NoReviewsState professorId={professor.id} />
        ) : filteredReviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No reviews match your filters.</p>
        ) : (
          <div className="space-y-4">
            {verifiedCount < 5 && (
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-amber-600 text-sm">⚠</span>
                <p className="text-xs text-amber-700">
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

// ─── IASystem Panel ───────────────────────────────────────────────────────────

function IAsystemPanel({ entries }: { entries: IAsystemEntry[] }) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selected = entries[selectedIdx] ?? null;

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">IASystem Ratings</h2>

        {entries.length > 0 && (
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-husky-purple"
          >
            {entries.map((e, i) => (
              <option key={i} value={i}>
                {e.course_code} {e.section} · {e.quarter} {e.year}
              </option>
            ))}
          </select>
        )}
      </div>

      {!selected ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <p className="text-sm text-gray-500">No IASystem data available for this professor.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Left: 4 summative bar items */}
            <div className="space-y-3">
              {(Object.keys(SUMMATIVE_LABELS) as Array<keyof IAsystemEntry["summative_items"]>).map((key) => {
                const val = selected.summative_items[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-44 text-xs text-gray-600 shrink-0">{SUMMATIVE_LABELS[key]}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-husky-purple transition-all duration-500"
                        style={{ width: `${(val / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">
                      {val > 0 ? val.toFixed(1) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right: Overall Summative + CEI */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl bg-husky-light py-4 px-6 gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Overall Summative</span>
                  <Tooltip text="Average of the four summative items. Reported on a 0–5 scale." />
                </div>
                <span className="text-3xl font-bold text-husky-purple">
                  {selected.overall_summative > 0 ? selected.overall_summative.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">out of 5.0</span>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl bg-husky-light py-4 px-6 gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">CEI</span>
                  <Tooltip text="Course Evaluation Index — a composite score weighted across all evaluation items. Reported on a 1–7 scale." />
                </div>
                <span className="text-3xl font-bold text-husky-purple">
                  {selected.cei > 0 ? selected.cei.toFixed(1) : "—"}
                </span>
                <span className="text-xs text-gray-400">out of 7.0</span>
              </div>

              <p className="text-xs text-gray-400 text-center">
                {selected.responses} / {selected.enrollment} responses
              </p>
            </div>
          </div>

          {/* AI summary of written comments */}
          {selected.ai_summary && (
            <div className="mt-4 rounded-md border border-husky-light bg-husky-light/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Student Comments Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{selected.ai_summary}</p>
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-xs text-gray-400">Source: UW IASystem official evaluation data.</p>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-gray-400 text-xs hover:border-husky-purple hover:text-husky-purple focus:outline-none"
        aria-label="More information"
      >
        i
      </button>
      {visible && (
        <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 z-10 w-56 rounded-md border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600 shadow-md">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── AI Summary ───────────────────────────────────────────────────────────────

function AISummarySection({
  professor, reviewCount, verifiedCount, hasEnough,
}: {
  professor: Professor;
  reviewCount: number;
  verifiedCount: number;
  hasEnough: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(professor.summary);
  const [error, setError] = useState<string | null>(null);

  async function fetchSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/summary/${professor.id}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError("Couldn't load summary. Try again later.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <SparkleIcon className="h-4 w-4 text-husky-purple" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">AI-Generated Summary</h2>
        <span className="rounded-full bg-husky-light px-2 py-0.5 text-xs font-medium text-husky-metallic">Powered by Gemini</span>
      </div>

      {!hasEnough ? (
        <div className="rounded-md bg-gray-50 border border-dashed border-gray-200 px-4 py-5 text-center">
          <p className="text-sm text-gray-500">
            AI summaries require <span className="font-semibold">5 verified reviews</span>.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {verifiedCount === 0
              ? "No verified reviews yet."
              : `${5 - verifiedCount} more verified review${5 - verifiedCount !== 1 ? "s" : ""} needed.`}
          </p>
          {reviewCount > verifiedCount && (
            <p className="text-xs text-gray-400 mt-1">
              {reviewCount - verifiedCount} unverified review{reviewCount - verifiedCount !== 1 ? "s" : ""} not counted toward this threshold.
            </p>
          )}
        </div>
      ) : summary ? (
        <div>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          {professor.summary_updated_at && (
            <p className="mt-2 text-xs text-gray-400">
              Last updated {new Date(professor.summary_updated_at.seconds * 1000).toLocaleDateString()}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-gray-500">This professor has enough verified reviews for an AI summary.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={fetchSummary} disabled={loading}
            className="flex items-center gap-2 rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90 disabled:opacity-60 transition-colors">
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
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRow rating={r.scores.overall} size="sm" />
          <span className="text-xs font-medium text-gray-700">{r.course.code}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{r.campus}</span>
          <span className="text-xs text-gray-400">{r.term.quarter} {r.term.year}</span>
        </div>

        <div className="flex items-center gap-3">
          {r.verified ? (
            <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              ✓ Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
              Unverified
            </span>
          )}
          <span className="text-xs text-gray-500">
            Difficulty: <span className="font-medium text-gray-700">{r.scores.difficulty}/5</span>
          </span>
          {r.scores.would_take_again
            ? <span className="text-xs text-green-600 font-medium">Would take again ✓</span>
            : <span className="text-xs text-red-500 font-medium">Wouldn't take again</span>}
          {date && <span className="text-xs text-gray-400">{date}</span>}
        </div>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed">{r.body}</p>

      {r.tags && r.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {r.tags.map((t) => (
            <span key={t} className="rounded-full bg-husky-light px-2 py-0.5 text-xs text-husky-metallic">#{t}</span>
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
      <p className="text-sm font-medium text-gray-700">No peer reviews yet.</p>
      <p className="text-xs text-gray-400">Be the first to leave a verified review.</p>
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
        ? "border-red-100 bg-red-50 text-red-600"
        : "border-husky-purple/20 bg-husky-light text-husky-purple"
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
        <svg key={i} className={`${s} ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} viewBox="0 0 24 24">
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
