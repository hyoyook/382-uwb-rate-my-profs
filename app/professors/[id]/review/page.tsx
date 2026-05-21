// app/professors/[id]/review/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import AuthGuard from "@/components/AuthGuard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Professor {
    id: string;
    name: string;
    department: string;
    campus: string[];
}

type SubmitState = "idle" | "submitting" | "success" | "error" | "moderated";

const QUARTERS = ["Winter", "Spring", "Summer", "Autumn"];
const YEARS = ["2022", "2023", "2024", "2025", "2026"];
const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F", "Prefer not to say"];
const TAGS = [
    "Engaging lecturer",
    "Tough grader",
    "Project-based",
    "Clear explanations",
    "Helpful office hours",
    "Heavy workload",
    "Fair exams",
    "Research opportunities",
    "Group work",
    "Attendance required",
];

// ─── Route export — AuthGuard wraps everything ────────────────────────────────

export default function WriteReviewPage() {
    return (
        <AuthGuard>
            {(user) => <ReviewView user={user} />}
        </AuthGuard>
    );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({
    value,
    onChange,
    label,
}: {
    value: number;
    onChange: (v: number) => void;
    label: React.ReactNode;
}) {
    const [hovered, setHovered] = useState(0);

    return (
        <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        onMouseEnter={() => setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
                        aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                    >
                        <span className={star <= (hovered || value) ? "text-husky-gold" : "text-gray-300"}>
                            ★
                        </span>
                    </button>
                ))}
                {value > 0 && (
                    <span className="ml-2 self-center text-sm text-gray-500">{value}/5</span>
                )}
            </div>
        </div>
    );
}

// ─── Difficulty Picker ────────────────────────────────────────────────────────

function DifficultyPicker({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    const labels = ["", "Very Easy", "Easy", "Medium", "Hard", "Very Hard"];
    return (
        <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
                Difficulty <span className="text-red-500">*</span>
            </span>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        title={labels[n]}
                        className={`h-9 w-9 rounded-full border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-husky-purple focus:ring-offset-1 ${value === n
                            ? "border-husky-purple bg-husky-purple text-white"
                            : "border-gray-300 bg-white text-gray-600 hover:border-husky-purple hover:text-husky-purple"
                            }`}
                    >
                        {n}
                    </button>
                ))}
                {value > 0 && (
                    <span className="self-center text-sm text-gray-500">{labels[value]}</span>
                )}
            </div>
        </div>
    );
}

// ─── Inner view — receives verified user from AuthGuard ───────────────────────

function ReviewView({ user }: { user: User }) {
    const { id } = useParams<{ id: string }>();

    // Professor state
    const [professor, setProfessor] = useState<Professor | null>(null);
    const [loadingProf, setLoadingProf] = useState(true);
    const [remainingToday, setRemainingToday] = useState(3);

    // Form state
    const [courseCode, setCourseCode] = useState("");
    const [quarter, setQuarter] = useState("");
    const [year, setYear] = useState("");
    const [overall, setOverall] = useState(0);
    const [difficulty, setDifficulty] = useState(0);
    const [clarity, setClarity] = useState(0);
    const [helpfulness, setHelpfulness] = useState(0);
    const [wouldTakeAgain, setWouldTakeAgain] = useState<boolean | null>(null);
    const [review, setReview] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [grade, setGrade] = useState("");
    const [attendanceMandatory, setAttendanceMandatory] = useState<string>("");
    const [textbookRequired, setTextbookRequired] = useState<string>("");

    // Submission state
    const [submitState, setSubmitState] = useState<SubmitState>("idle");
    const [errorMsg, setErrorMsg] = useState("");

    // Fetch professor
    useEffect(() => {
        if (!id) return;
        setLoadingProf(true);
        getDoc(doc(db, "professors", id))
            .then((snap) => {
                if (snap.exists()) {
                    setProfessor({ id: snap.id, ...(snap.data() as Omit<Professor, "id">) });
                }
            })
            .finally(() => setLoadingProf(false));
    }, [id]);

    // Tag toggle
    function toggleTag(tag: string) {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    }

    // Validation
    const MIN_REVIEW_LENGTH = 30;
    const reviewTooShort = review.trim().length > 0 && review.trim().length < MIN_REVIEW_LENGTH;
    const isValid =
        courseCode.trim().length > 0 &&
        quarter.length > 0 &&
        year.length > 0 &&
        overall > 0 &&
        difficulty > 0 &&
        clarity > 0 &&
        helpfulness > 0 &&
        wouldTakeAgain !== null &&
        review.trim().length >= MIN_REVIEW_LENGTH;

    async function handleSubmit() {
        if (!isValid) return;
        setSubmitState("submitting");
        setErrorMsg("");

        // Always get a fresh token at submission time — never stale
        const token = await user.getIdToken();

        try {
            const res = await fetch("/api/reviews", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    professor_id: id,
                    course_code: courseCode.trim().toUpperCase(),
                    quarter,
                    year: parseInt(year),
                    scores: {
                        overall,
                        difficulty,
                        clarity,
                        helpfulness,
                        would_take_again: wouldTakeAgain,
                    },
                    body: review.trim(),
                    tags: selectedTags,
                    grade_received: grade || null,
                    attendance_mandatory: attendanceMandatory === "yes" ? true : attendanceMandatory === "no" ? false : null,
                    textbook_required: textbookRequired === "yes" ? true : textbookRequired === "no" ? false : null,
                }),
            });

            const data = await res.json();

            if (res.status === 429) {
                setSubmitState("error");
                setErrorMsg("You've hit the 3-review daily limit. Try again tomorrow.");
                setRemainingToday(0);
                return;
            }
            if (res.status === 400 && data.reason) {
                setSubmitState("moderated");
                setErrorMsg(data.reason);
                return;
            }
            if (!res.ok) {
                setSubmitState("error");
                setErrorMsg(data.error ?? "Something went wrong. Please try again.");
                return;
            }

            setSubmitState("success");
            // Use server-returned remaining count if available, otherwise decrement locally
            setRemainingToday(data.remaining ?? ((r: number) => Math.max(0, r - 1)));
        } catch {
            setSubmitState("error");
            setErrorMsg("Network error — check your connection and try again.");
        }
    }

    // ── Loading professor ──────────────────────────────────────────────────────
    if (loadingProf) {
        return (
            <div className="flex min-h-64 items-center justify-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-husky-purple border-t-transparent" />
            </div>
        );
    }

    // ── Professor not found ────────────────────────────────────────────────────
    if (!professor) {
        return (
            <div className="rounded-lg bg-white p-8 shadow-sm text-center">
                <p className="text-gray-600">Professor not found.</p>
                <Link href="/search" className="mt-4 inline-block text-sm text-husky-purple hover:underline">
                    ← Back to search
                </Link>
            </div>
        );
    }

    // ── Success ────────────────────────────────────────────────────────────────
    if (submitState === "success") {
        return (
            <div className="rounded-lg bg-white p-10 shadow-sm text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Review submitted!</h2>
                <p className="text-sm text-gray-500">
                    Your review for <span className="font-medium">{professor.name}</span> has been published.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                    <Link
                        href={`/professors/${id}`}
                        className="rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90"
                    >
                        View professor page
                    </Link>
                    <Link
                        href="/search"
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Browse more professors
                    </Link>
                </div>
            </div>
        );
    }

    // ── Main form ──────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm text-gray-500">
                <Link href="/search" className="hover:text-husky-purple">Search</Link>
                <span>›</span>
                <Link href={`/professors/${id}`} className="hover:text-husky-purple">{professor.name}</Link>
                <span>›</span>
                <span className="text-gray-900">Write a Review</span>
            </nav>

            {/* Header card */}
            <div className="rounded-lg bg-white px-8 py-6 shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-husky-purple">{professor.name}</h1>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {professor.department} · {professor.campus?.join(", ")}
                        </p>
                    </div>
                    {/* Rate limit indicator */}
                    <div className="rounded-md border border-gray-200 px-3 py-2 text-right">
                        <p className="text-xs text-gray-500">Reviews left today</p>
                        <p className={`text-lg font-bold ${remainingToday === 0 ? "text-red-500" : "text-husky-purple"}`}>
                            {remainingToday}/3
                        </p>
                    </div>
                </div>
            </div>

            {/* Form card */}
            <div className="rounded-lg bg-white px-8 py-7 shadow-sm space-y-8">

                {/* ── Section 1: Course info ── */}
                <section className="space-y-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Course Details</h2>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Course Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. CSS 343"
                                value={courseCode}
                                onChange={(e) => setCourseCode(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Quarter <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={quarter}
                                onChange={(e) => setQuarter(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                            >
                                <option value="">Select quarter…</option>
                                {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Year <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                            >
                                <option value="">Select year…</option>
                                {[...YEARS].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                <hr className="border-gray-100" />

                {/* ── Section 2: Ratings ── */}
                <section className="space-y-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Ratings</h2>

                    <StarRating
                        label={<>Overall Rating <span className="text-red-500">*</span></>}
                        value={overall}
                        onChange={setOverall}
                    />

                    <StarRating
                        label={<>Clarity <span className="text-red-500">*</span></>}
                        value={clarity}
                        onChange={setClarity}
                    />

                    <StarRating
                        label={<>Helpfulness <span className="text-red-500">*</span></>}
                        value={helpfulness}
                        onChange={setHelpfulness}
                    />

                    <DifficultyPicker value={difficulty} onChange={setDifficulty} />

                    <div>
                        <span className="mb-1 block text-sm font-medium text-gray-700">
                            Would you take this professor again? <span className="text-red-500">*</span>
                        </span>
                        <div className="flex gap-3">
                            {([true, false] as const).map((val) => (
                                <button
                                    key={String(val)}
                                    type="button"
                                    onClick={() => setWouldTakeAgain(val)}
                                    className={`rounded-md border px-5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-husky-purple focus:ring-offset-1 ${wouldTakeAgain === val
                                        ? "border-husky-purple bg-husky-purple text-white"
                                        : "border-gray-300 bg-white text-gray-600 hover:border-husky-purple hover:text-husky-purple"
                                        }`}
                                >
                                    {val ? "Yes" : "No"}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <hr className="border-gray-100" />

                {/* ── Section 3: Written review ── */}
                <section className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Your Review</h2>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Written Review <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            rows={5}
                            placeholder="Describe your experience — lectures, workload, exams, how the professor communicates…"
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${reviewTooShort
                                ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                                : "border-gray-300 focus:border-husky-purple focus:ring-husky-purple"
                                }`}
                        />
                        <div className="mt-1 flex justify-between text-xs">
                            {reviewTooShort ? (
                                <span className="text-red-500">
                                    {MIN_REVIEW_LENGTH - review.trim().length} more characters needed
                                </span>
                            ) : (
                                <span className="text-gray-400">Minimum {MIN_REVIEW_LENGTH} characters</span>
                            )}
                            <span className={review.trim().length >= MIN_REVIEW_LENGTH ? "text-green-600" : "text-gray-400"}>
                                {review.trim().length} / {MIN_REVIEW_LENGTH}+
                            </span>
                        </div>
                    </div>

                    <div>
                        <span className="mb-2 block text-sm font-medium text-gray-700">
                            Tags <span className="font-normal text-gray-400">(optional)</span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleTag(tag)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none ${selectedTags.includes(tag)
                                        ? "border-husky-purple bg-husky-purple text-white"
                                        : "border-gray-300 bg-white text-gray-600 hover:border-husky-purple hover:text-husky-purple"
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <hr className="border-gray-100" />

                {/* ── Section 4: Optional extras ── */}
                <section className="space-y-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Optional Details</h2>

                    <div className="grid gap-5 sm:grid-cols-3">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Grade Received</label>
                            <select
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                            >
                                <option value="">Select…</option>
                                {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Attendance Required</label>
                            <select
                                value={attendanceMandatory}
                                onChange={(e) => setAttendanceMandatory(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                            >
                                <option value="">Select…</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">Textbook Required</label>
                            <select
                                value={textbookRequired}
                                onChange={(e) => setTextbookRequired(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                            >
                                <option value="">Select…</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* ── Error / moderation banner ── */}
                {(submitState === "error" || submitState === "moderated") && (
                    <div className={`rounded-md border px-4 py-3 text-sm ${submitState === "moderated"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-red-300 bg-red-50 text-red-700"
                        }`}>
                        {submitState === "moderated" && (
                            <p className="mb-0.5 font-medium">Review flagged for moderation</p>
                        )}
                        {errorMsg}
                    </div>
                )}

                {/* ── Submit row ── */}
                <div className="flex items-center justify-between pt-1">
                    <Link href={`/professors/${id}`} className="text-sm text-gray-500 hover:text-husky-purple">
                        ← Cancel
                    </Link>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!isValid || submitState === "submitting" || remainingToday === 0}
                        className="flex items-center gap-2 rounded-md bg-husky-purple px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-husky-purple/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitState === "submitting" ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Submitting…
                            </>
                        ) : (
                            "Submit Review"
                        )}
                    </button>
                </div>

                <p className="text-center text-xs text-gray-400">
                    Submitting a review for a course you've already reviewed will overwrite your previous one.
                </p>
            </div>
        </div>
    );
}
