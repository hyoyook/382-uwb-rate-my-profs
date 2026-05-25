// app/professors/[id]/ias/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import AuthGuard from "@/components/AuthGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

type IasName = { first: string; last: string };

type IasCourseEval = {
  code: string;
  term: string; // e.g. "Winter 2026"
  n: number; // responses
  median: number; // 0–5 ordinal median
};

type IasReview = {
  id: string;
  professor_id: string;
  author_id: string;
  created_at: string | null; // ISO string
  course: { code: string; name: string };
  term: { semester: string; year: number };
  scores: {
    overall: number | null;
    difficulty: number | null;
    clarity: number | null;
    helpfulness: number | null;
    would_take_again: boolean | null;
  };
  attendance_mandatory: boolean | null;
  grade_received: string | null;
  textbook_required: boolean | null;
  body: string;
  tags: string[];
  votes: { helpful: number; not_helpful: number };
  flagged: boolean;
  flag_reason: string | null;
};

type IasDoc = {
  id: string;
  name: IasName;
  department: string;
  institution: string;
  title: string;
  email: string | null;
  overall_rating: number;
  ratings_count: number;
  tags: string[];
  courses_evaluated: IasCourseEval[];
  reviews: IasReview[];
};

type ProfessorLite = {
  name: string;
  ias_review_id?: string;
};

// ─── Term ordering helpers ──────────────────────────────────────────────────

const SEM_ORDER: Record<string, number> = {
  Winter: 0,
  Spring: 1,
  Summer: 2,
  Autumn: 3,
  Fall: 3,
};

function termSortKey(term: string): number {
  const parts = term.trim().split(/\s+/);
  const sem = parts[0];
  const yr = Number(parts[parts.length - 1]);
  return yr * 10 + (SEM_ORDER[sem] ?? 0);
}

function termObjKey(t: { semester: string; year: number }): number {
  return t.year * 10 + (SEM_ORDER[t.semester] ?? 0);
}

// "CSS 343 D" → "CSS 343" (strips a trailing single-letter section)
function baseCourse(code: string): string {
  return code.replace(/\s+[A-Z]$/, "").trim();
}

// Short term label "Winter 2026" → "W'26"
function shortTerm(term: string): string {
  const parts = term.trim().split(/\s+/);
  const sem = parts[0]?.[0] ?? "?";
  const yr = parts[parts.length - 1]?.slice(2) ?? "";
  return `${sem}'${yr}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IasReviewsPage() {
  return <AuthGuard>{() => <IasView />}</AuthGuard>;
}

function IasView() {
  const params = useParams();
  const professorId = params.id as string;

  const [professor, setProfessor] = useState<ProfessorLite | null>(null);
  const [ias, setIas] = useState<IasDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const profSnap = await getDoc(doc(db, "professors", professorId));
        if (!profSnap.exists()) {
          setError("Professor not found.");
          return;
        }
        const prof = profSnap.data() as ProfessorLite;
        setProfessor(prof);

        if (!prof.ias_review_id) {
          // Nothing to load — render the "no data" state.
          return;
        }

        const iasSnap = await getDoc(doc(db, "ias-reviews", prof.ias_review_id));
        if (!iasSnap.exists()) {
          setError("IAS evaluation record not found.");
          return;
        }
        setIas({ id: iasSnap.id, ...iasSnap.data() } as IasDoc);
      } catch (err) {
        console.error("Failed to load IAS reviews:", err);
        setError("Couldn't load IAS evaluation data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [professorId]);

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">{error}</p>
        <Link href={`/professors/${professorId}`} className="text-sm text-husky-purple dark:text-husky-purpleLight hover:underline">
          ← Back to professor
        </Link>
      </div>
    );
  }

  const profName = professor?.name ?? "Professor";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/search" className="hover:text-husky-purple dark:hover:text-husky-purpleLight transition-colors">Browse Professors</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <Link href={`/professors/${professorId}`} className="hover:text-husky-purple dark:hover:text-husky-purpleLight transition-colors">{profName}</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">IAS Ratings</span>
      </nav>

      {!ias ? (
        <NoIasState professorId={professorId} profName={profName} />
      ) : (
        <IasContent ias={ias} professorId={professorId} />
      )}
    </div>
  );
}

// ─── Main content ───────────────────────────────────────────────────────────

function IasContent({ ias, professorId }: { ias: IasDoc; professorId: string }) {
  const fullName = `${ias.name.first} ${ias.name.last}`.trim();

  const evals = ias.courses_evaluated ?? [];
  const reviews = ias.reviews ?? [];

  // ── Derived aggregates ──────────────────────────────────────────────────
  const distinctCourses = useMemo(
    () => Array.from(new Set(evals.map((e) => baseCourse(e.code)))).sort(),
    [evals]
  );
  const distinctTerms = useMemo(
    () => Array.from(new Set(evals.map((e) => e.term))).sort((a, b) => termSortKey(a) - termSortKey(b)),
    [evals]
  );

  const totalResponses = useMemo(() => evals.reduce((s, e) => s + (e.n ?? 0), 0), [evals]);

  // Response-weighted average median across all evaluations.
  const weightedMedian = useMemo(() => {
    if (totalResponses === 0) return 0;
    const sum = evals.reduce((s, e) => s + (e.median ?? 0) * (e.n ?? 0), 0);
    return sum / totalResponses;
  }, [evals, totalResponses]);

  // would-take-again % among reviews that recorded it
  const wta = useMemo(() => {
    const recorded = reviews.filter((r) => r.scores.would_take_again !== null);
    if (recorded.length === 0) return null;
    const yes = recorded.filter((r) => r.scores.would_take_again === true).length;
    return { pct: Math.round((yes / recorded.length) * 100), n: recorded.length };
  }, [reviews]);

  const commentsCount = useMemo(() => reviews.filter((r) => r.body?.trim()).length, [reviews]);

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-husky-light dark:bg-husky-purple/20 text-husky-purple dark:text-husky-purpleLight text-2xl font-bold">
              {ias.name.first?.[0] ?? "?"}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {[ias.title, ias.department].filter(Boolean).join(" · ")}
              </p>
              <p className="text-xs text-husky-metallic dark:text-husky-gold mt-0.5">{ias.institution}</p>
            </div>
          </div>

          <Link
            href={`/professors/${professorId}`}
            className="rounded-md border border-husky-purple/40 px-4 py-2 text-sm font-medium text-husky-purple dark:text-husky-purpleLight hover:bg-husky-light dark:hover:bg-husky-purple/20 transition-colors"
          >
            ← Student Reviews
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-husky-light dark:border-husky-purple/30 bg-husky-light/40 dark:bg-husky-purple/10 px-3 py-2">
          <span className="text-husky-purple dark:text-husky-purpleLight">🏛️</span>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Numerical ordinal ratings sourced from official <span className="font-semibold">UW IASystem</span> course
            evaluations. Medians are reported on a 0–5 scale.
          </p>
        </div>

        {ias.tags && ias.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {ias.tags.map((t) => (
              <span key={t} className="rounded-full bg-husky-light dark:bg-husky-purple/20 px-3 py-1 text-xs font-medium text-husky-metallic dark:text-husky-gold">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Stat tiles ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Overall Rating" value={ias.overall_rating > 0 ? ias.overall_rating.toFixed(1) : "—"} sub="out of 5.0" accent />
        <StatTile label="Avg Median" value={weightedMedian > 0 ? weightedMedian.toFixed(2) : "—"} sub="response-weighted" />
        <StatTile label="Evaluations" value={String(evals.length)} sub={`${totalResponses} responses`} />
        <StatTile label="Courses" value={String(distinctCourses.length)} sub="distinct" />
        <StatTile label="Terms" value={String(distinctTerms.length)} sub="evaluated" />
        <StatTile label="Would Retake" value={wta ? `${wta.pct}%` : "—"} sub={wta ? `of ${wta.n}` : "no data"} />
      </div>

      {/* ── Median over time (per course) ──────────────────────────────────── */}
      <RatingTrendChart evals={evals} />

      {/* ── Course leaderboard ─────────────────────────────────────────────── */}
      <CourseLeaderboard evals={evals} />

      {/* ── Responses per term ─────────────────────────────────────────────── */}
      <ResponsesPerTerm evals={evals} />

      {/* ── Student rating breakdown (from written reviews w/ scores) ──────── */}
      <ScoreBreakdown reviews={reviews} />

      {/* ── Official evaluations table ─────────────────────────────────────── */}
      <EvaluationsTable evals={evals} />

      {/* ── Written comments ───────────────────────────────────────────────── */}
      <CommentsSection reviews={reviews} commentsCount={commentsCount} />
    </>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl py-4 px-3 text-center ${accent ? "bg-husky-light dark:bg-husky-purple/20" : "bg-white dark:bg-gray-800 shadow-sm"}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-2xl font-bold text-husky-purple dark:text-husky-purpleLight">{value}</span>
      {sub && <span className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</span>}
    </div>
  );
}

// ─── Card wrapper ───────────────────────────────────────────────────────────

function Card({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ─── Color palette for course series ─────────────────────────────────────────

const SERIES_COLORS = [
  "#4B2E83", // husky purple
  "#B7A57A", // gold
  "#2563eb", // blue
  "#16a34a", // green
  "#dc2626", // red
  "#db2777", // pink
  "#ea580c", // orange
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#65a30d", // lime
];

// ─── Rating trend over time (multi-series line chart) ─────────────────────────

function RatingTrendChart({ evals }: { evals: IasCourseEval[] }) {
  // Build per-base-course series of {termKey, term, median} averaged across sections.
  const { series, terms } = useMemo(() => {
    const termSet = new Set<string>();
    // course -> term -> [medians weighted by n]
    const map = new Map<string, Map<string, { sum: number; n: number }>>();
    for (const e of evals) {
      const c = baseCourse(e.code);
      termSet.add(e.term);
      if (!map.has(c)) map.set(c, new Map());
      const tm = map.get(c)!;
      const cur = tm.get(e.term) ?? { sum: 0, n: 0 };
      cur.sum += (e.median ?? 0) * (e.n ?? 1);
      cur.n += e.n ?? 1;
      tm.set(e.term, cur);
    }
    const terms = Array.from(termSet).sort((a, b) => termSortKey(a) - termSortKey(b));
    const series = Array.from(map.entries())
      .map(([course, tm]) => ({
        course,
        points: terms
          .map((t, i) => {
            const v = tm.get(t);
            return v && v.n > 0 ? { x: i, median: v.sum / v.n } : null;
          })
          .filter((p): p is { x: number; median: number } => p !== null),
        count: Array.from(tm.values()).reduce((s, v) => s + v.n, 0),
      }))
      .sort((a, b) => b.count - a.count);
    return { series, terms };
  }, [evals]);

  // Visibility toggles — default to showing the busiest 5 series.
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const h = new Set<string>();
    return h;
  });
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && series.length > 0) {
      const h = new Set<string>();
      series.forEach((s, i) => { if (i >= 5) h.add(s.course); });
      setHidden(h);
      setInitialized(true);
    }
  }, [series, initialized]);

  if (terms.length < 2) {
    return (
      <Card title="Median Rating Over Time" subtitle="Not enough terms to plot a trend.">
        <EmptyHint>Need evaluations from at least two terms.</EmptyHint>
      </Card>
    );
  }

  // Chart geometry
  const W = 720;
  const H = 260;
  const padL = 32;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const yMin = 0;
  const yMax = 5;
  const xFor = (i: number) => padL + (terms.length === 1 ? plotW / 2 : (i / (terms.length - 1)) * plotW);
  const yFor = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const colorOf = (course: string) => SERIES_COLORS[series.findIndex((s) => s.course === course) % SERIES_COLORS.length];

  return (
    <Card
      title="Median Rating Over Time"
      subtitle="Official evaluation median per course, by term (sections averaged). Toggle courses below."
    >
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Median rating over time">
          {/* Y gridlines at 1..5 */}
          {[0, 1, 2, 3, 4, 5].map((g) => (
            <g key={g}>
              <line x1={padL} y1={yFor(g)} x2={W - padR} y2={yFor(g)} className="stroke-gray-100 dark:stroke-gray-700" strokeWidth={1} />
              <text x={padL - 6} y={yFor(g) + 3} textAnchor="end" className="fill-gray-400 dark:fill-gray-500 text-[9px]">{g}</text>
            </g>
          ))}
          {/* X labels */}
          {terms.map((t, i) => (
            <text key={t} x={xFor(i)} y={H - 8} textAnchor="middle" className="fill-gray-400 dark:fill-gray-500 text-[9px]">
              {shortTerm(t)}
            </text>
          ))}
          {/* Series */}
          {series.filter((s) => !hidden.has(s.course)).map((s) => {
            const color = colorOf(s.course);
            const pts = s.points;
            const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.x)},${yFor(p.median)}`).join(" ");
            return (
              <g key={s.course}>
                {pts.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {pts.map((p) => (
                  <circle key={p.x} cx={xFor(p.x)} cy={yFor(p.median)} r={3} fill={color}>
                    <title>{`${s.course} · ${terms[p.x]}: ${p.median.toFixed(1)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend / toggles */}
      <div className="mt-3 flex flex-wrap gap-2">
        {series.map((s) => {
          const off = hidden.has(s.course);
          return (
            <button
              key={s.course}
              type="button"
              onClick={() => {
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.course)) next.delete(s.course);
                  else next.add(s.course);
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${off ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500" : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: off ? "transparent" : colorOf(s.course), border: off ? `1.5px solid ${colorOf(s.course)}` : "none" }} />
              {s.course}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Course leaderboard ───────────────────────────────────────────────────────

function CourseLeaderboard({ evals }: { evals: IasCourseEval[] }) {
  const rows = useMemo(() => {
    const map = new Map<string, { sum: number; n: number; sections: number }>();
    for (const e of evals) {
      const c = baseCourse(e.code);
      const cur = map.get(c) ?? { sum: 0, n: 0, sections: 0 };
      cur.sum += (e.median ?? 0) * (e.n ?? 0);
      cur.n += e.n ?? 0;
      cur.sections += 1;
      map.set(c, cur);
    }
    return Array.from(map.entries())
      .map(([course, v]) => ({ course, avg: v.n > 0 ? v.sum / v.n : 0, n: v.n, sections: v.sections }))
      .sort((a, b) => b.avg - a.avg);
  }, [evals]);

  if (rows.length === 0) return null;

  return (
    <Card title="Course Leaderboard" subtitle="Response-weighted average median per course, highest first.">
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.course} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-right text-xs font-semibold text-gray-400 dark:text-gray-500">{i + 1}</span>
            <span className="w-24 shrink-0 text-xs font-medium text-gray-700 dark:text-gray-300">{r.course}</span>
            <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${i === 0 ? "bg-husky-purple" : "bg-husky-purple/70"}`}
                style={{ width: `${(r.avg / 5) * 100}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-bold text-gray-700 dark:text-gray-300">{r.avg.toFixed(1)}</span>
            <span className="hidden sm:inline w-28 shrink-0 text-right text-[10px] text-gray-400 dark:text-gray-500">
              {r.n} resp · {r.sections} sec
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Responses per term ───────────────────────────────────────────────────────

function ResponsesPerTerm({ evals }: { evals: IasCourseEval[] }) {
  const bars = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of evals) map.set(e.term, (map.get(e.term) ?? 0) + (e.n ?? 0));
    return Array.from(map.entries())
      .map(([term, n]) => ({ term, n }))
      .sort((a, b) => termSortKey(a.term) - termSortKey(b.term));
  }, [evals]);

  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((b) => b.n), 1);

  return (
    <Card title="Evaluation Responses by Term" subtitle="Number of official evaluation responses collected each term.">
      <div className="flex items-end gap-2 h-40 overflow-x-auto pb-1">
        {bars.map((b) => (
          <div key={b.term} className="flex flex-1 min-w-[34px] flex-col items-center justify-end gap-1 h-full">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300">{b.n}</span>
            <div
              className="w-full rounded-t bg-husky-purple/80 hover:bg-husky-purple transition-colors"
              style={{ height: `${(b.n / max) * 100}%` }}
              title={`${b.term}: ${b.n} responses`}
            />
            <span className="text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap">{shortTerm(b.term)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Score breakdown (from written reviews carrying numeric scores) ───────────

const METRIC_LABELS: Record<"overall" | "difficulty" | "clarity" | "helpfulness", string> = {
  overall: "Overall",
  difficulty: "Difficulty",
  clarity: "Clarity",
  helpfulness: "Helpfulness",
};

function ScoreBreakdown({ reviews }: { reviews: IasReview[] }) {
  const { hist, total, averages } = useMemo(() => {
    const hist = [0, 0, 0, 0, 0]; // index 0 → 1 star
    let total = 0;
    const sums: Record<string, { sum: number; n: number }> = {
      overall: { sum: 0, n: 0 },
      difficulty: { sum: 0, n: 0 },
      clarity: { sum: 0, n: 0 },
      helpfulness: { sum: 0, n: 0 },
    };
    for (const r of reviews) {
      const o = r.scores.overall;
      if (typeof o === "number" && o >= 1 && o <= 5) {
        hist[o - 1] += 1;
        total += 1;
      }
      (["overall", "difficulty", "clarity", "helpfulness"] as const).forEach((k) => {
        const v = r.scores[k];
        if (typeof v === "number") {
          sums[k].sum += v;
          sums[k].n += 1;
        }
      });
    }
    const averages = (Object.keys(METRIC_LABELS) as Array<keyof typeof METRIC_LABELS>).map((k) => ({
      key: k,
      avg: sums[k].n > 0 ? sums[k].sum / sums[k].n : 0,
      n: sums[k].n,
    }));
    return { hist, total, averages };
  }, [reviews]);

  if (total === 0) {
    return (
      <Card title="Student Rating Breakdown" subtitle="From written evaluations that included a numeric score.">
        <EmptyHint>No numeric student ratings recorded for this professor.</EmptyHint>
      </Card>
    );
  }

  const max = Math.max(...hist, 1);

  return (
    <Card title="Student Rating Breakdown" subtitle={`Based on ${total} evaluation${total !== 1 ? "s" : ""} that included numeric scores.`}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Histogram of overall scores */}
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = hist[star - 1];
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-xs text-gray-500 dark:text-gray-400">{star}★</span>
                <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-yellow-400 transition-all duration-500" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Metric averages */}
        <div className="space-y-3">
          {averages.map((m) => (
            <div key={m.key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-gray-600 dark:text-gray-300">{METRIC_LABELS[m.key]}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-husky-purple transition-all duration-500" style={{ width: `${(m.avg / 5) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                {m.n > 0 ? m.avg.toFixed(1) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Official evaluations table ───────────────────────────────────────────────

type SortKey = "term" | "code" | "median" | "n";

function EvaluationsTable({ evals }: { evals: IasCourseEval[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("term");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...evals];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "term") cmp = termSortKey(a.term) - termSortKey(b.term);
      else if (sortKey === "code") cmp = a.code.localeCompare(b.code);
      else if (sortKey === "median") cmp = (a.median ?? 0) - (b.median ?? 0);
      else cmp = (a.n ?? 0) - (b.n ?? 0);
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [evals, sortKey, asc]);

  function toggle(k: SortKey) {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(k === "code"); }
  }

  if (evals.length === 0) {
    return (
      <Card title="Official Course Evaluations">
        <EmptyHint>No IASystem evaluations recorded.</EmptyHint>
      </Card>
    );
  }

  const arrow = (k: SortKey) => (k === sortKey ? (asc ? " ▲" : " ▼") : "");

  return (
    <Card title="Official Course Evaluations" subtitle={`All ${evals.length} evaluated sections. Click a column to sort.`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <Th onClick={() => toggle("code")}>Course{arrow("code")}</Th>
              <Th onClick={() => toggle("term")}>Term{arrow("term")}</Th>
              <Th onClick={() => toggle("n")} className="text-right">Responses{arrow("n")}</Th>
              <Th onClick={() => toggle("median")} className="text-right">Median{arrow("median")}</Th>
              <th className="py-2 px-3 w-32" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={`${e.code}-${e.term}-${i}`} className="border-b border-gray-50 dark:border-gray-700/50">
                <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{e.code}</td>
                <td className="py-2 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.term}</td>
                <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{e.n}</td>
                <td className="py-2 px-3 text-right font-semibold text-gray-700 dark:text-gray-300">{e.median?.toFixed(1) ?? "—"}</td>
                <td className="py-2 px-3">
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div className="h-full rounded-full bg-husky-purple" style={{ width: `${((e.median ?? 0) / 5) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children, onClick, className = "" }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <th className={`py-2 px-3 cursor-pointer select-none hover:text-husky-purple dark:hover:text-husky-purpleLight ${className}`} onClick={onClick}>
      {children}
    </th>
  );
}

// ─── Written comments ─────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

function CommentsSection({ reviews, commentsCount }: { reviews: IasReview[]; commentsCount: number }) {
  const [courseFilter, setCourseFilter] = useState("All");
  const [scoredOnly, setScoredOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest" | "helpful">("newest");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const courseOptions = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.course.code))).sort(),
    [reviews]
  );

  const filtered = useMemo(() => {
    const arr = reviews.filter((r) => {
      const courseOk = courseFilter === "All" || r.course.code === courseFilter;
      const scoreOk = !scoredOnly || typeof r.scores.overall === "number";
      return courseOk && scoreOk;
    });
    arr.sort((a, b) => {
      if (sort === "helpful") return (b.votes?.helpful ?? 0) - (a.votes?.helpful ?? 0);
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return sort === "newest" ? tb - ta : ta - tb;
    });
    return arr;
  }, [reviews, courseFilter, scoredOnly, sort]);

  // Reset paging when filters change.
  useEffect(() => { setVisible(PAGE_SIZE); }, [courseFilter, scoredOnly, sort]);

  return (
    <Card
      title="Written Comments"
      subtitle={`${commentsCount} comment${commentsCount !== 1 ? "s" : ""} from official evaluations.`}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-md border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-husky-purple"
          >
            <option value="All">All courses</option>
            {courseOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-gray-200 dark:border-gray-700 dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-husky-purple"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="helpful">Most helpful</option>
          </select>
          <button
            type="button"
            onClick={() => setScoredOnly((v) => !v)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${scoredOnly ? "bg-husky-purple text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            Scored only
          </button>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <EmptyHint>No comments match your filters.</EmptyHint>
      ) : (
        <>
          <div className="space-y-4">
            {filtered.slice(0, visible).map((r) => <CommentCard key={r.id} review={r} />)}
          </div>
          {visible < filtered.length && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Show more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CommentCard({ review: r }: { review: IasReview }) {
  const date = r.created_at
    ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;
  const hasOverall = typeof r.scores.overall === "number";

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasOverall && <StarRow rating={r.scores.overall as number} />}
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{r.course.code}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{r.term.semester} {r.term.year}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {typeof r.scores.clarity === "number" && <ScorePill label="Clarity" value={r.scores.clarity} />}
          {typeof r.scores.helpfulness === "number" && <ScorePill label="Helpful" value={r.scores.helpfulness} />}
          {typeof r.scores.difficulty === "number" && <ScorePill label="Difficulty" value={r.scores.difficulty} />}
          {r.scores.would_take_again === true && <span className="text-xs font-medium text-green-600 dark:text-green-400">Would retake ✓</span>}
          {r.scores.would_take_again === false && <span className="text-xs font-medium text-red-500 dark:text-red-400">Wouldn&apos;t retake</span>}
          {date && <span className="text-xs text-gray-400 dark:text-gray-500">{date}</span>}
        </div>
      </div>

      {r.course.name && <p className="text-[11px] text-gray-400 dark:text-gray-500">{r.course.name}</p>}

      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{r.body}</p>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {r.tags?.map((t) => (
          <span key={t} className="rounded-full bg-husky-light dark:bg-husky-purple/20 px-2 py-0.5 text-xs text-husky-metallic dark:text-husky-gold">#{t}</span>
        ))}
        {(r.votes?.helpful ?? 0) > 0 && (
          <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">👍 {r.votes.helpful} helpful</span>
        )}
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs text-gray-500 dark:text-gray-400">
      {label}: <span className="font-medium text-gray-700 dark:text-gray-300">{value}/5</span>
    </span>
  );
}

// ─── No-data state ────────────────────────────────────────────────────────────

function NoIasState({ professorId, profName }: { professorId: string; profName: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-gray-800 p-10 shadow-sm flex flex-col items-center gap-3 text-center">
      <div className="text-4xl">🏛️</div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No IASystem evaluations for {profName}.</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">
        Official course evaluation ratings haven&apos;t been published for this professor yet.
      </p>
      <Link href={`/professors/${professorId}`} className="mt-1 text-sm text-husky-purple dark:text-husky-purpleLight hover:underline">
        ← Back to student reviews
      </Link>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-6 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400">{children}</p>
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 dark:fill-gray-600 text-gray-200 dark:text-gray-700"}`} viewBox="0 0 24 24">
          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ))}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-husky-purple border-t-transparent" />;
}
