// app/professors/[id]/review/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
    courses_taught: string[];
}

interface ExistingReview {
    id: string;
    course: { code: string; name: string };
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
    grade_received: string | null;
    attendance_mandatory: boolean | null;
    textbook_required: boolean | null;
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

// ─── Route export ─────────────────────────────────────────────────────────────

export default function WriteReviewPage() {
    return (
        <AuthGuard>
            {(user) => <ReviewView user={user} />}
        </AuthGuard>
    );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value, onChange, label, disabled }: {
    value: number;
    onChange: (v: number) => void;
    label: React.ReactNode;
    disabled?: boolean;
}) {
    const [hovered, setHovered] = useState(0);
    return (
        <div>
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => !disabled && onChange(star)}
                        onMouseEnter={() => !disabled && setHovered(star)}
                        onMouseLeave={() => setHovered(0)}
                        disabled={disabled}
                        className="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none disabled:cursor-default"
                        aria-label={`${star} star${star !== 1 ? "s" : ""}`}
                    >
                        <span className={star <= (hovered || value) ? "text-husky-gold" : "text-gray-300 dark:text-gray-600"}>
                            ★
                        </span>
                    </button>
                ))}
                {value > 0 && (
                    <span className="ml-2 self-center text-sm text-gray-500 dark:text-gray-400">{value}/5</span>
                )}
            </div>
        </div>
    );
}

// ─── Difficulty Picker ────────────────────────────────────────────────────────

function DifficultyPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const labels = ["", "Very Easy", "Easy", "Medium", "Hard", "Very Hard"];
    return (
        <div>
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Difficulty <span className="text-red-500 dark:text-red-400">*</span>
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
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-husky-purple hover:text-husky-purple dark:hover:text-husky-purpleLight"
                            }`}
                    >
                        {n}
                    </button>
                ))}
                {value > 0 && (
                    <span className="self-center text-sm text-gray-500 dark:text-gray-400">{labels[value]}</span>
                )}
            </div>
        </div>
    );
}

// ─── Submit Confirmation Modal ────────────────────────────────────────────────

function SubmitConfirmModal({
    isEdit,
    onConfirm,
    onCancel,
    submitting,
}: {
    isEdit: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    submitting: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-husky-light dark:bg-husky-purple/20">
                        <svg className="h-5 w-5 text-husky-purple dark:text-husky-purpleLight" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007v.007H12v-.007zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {isEdit ? "Update your review?" : "Submit your review?"}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {isEdit
                                ? "Your updated review will be visible to all UW students."
                                : "This will become visible to all UW students."}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Go back
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 rounded-md bg-husky-purple px-4 py-2 text-sm font-medium text-white hover:bg-husky-purple/90 disabled:opacity-60 transition-colors"
                    >
                        {submitting ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                {isEdit ? "Updating…" : "Submitting…"}
                            </>
                        ) : (
                            isEdit ? "Yes, update" : "Yes, submit"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Inner view ───────────────────────────────────────────────────────────────

function ReviewView({ user }: { user: User }) {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const editReviewId = searchParams.get("edit"); // present when editing
    const isEdit = !!editReviewId;

    // Professor state
    const [professor, setProfessor] = useState<Professor | null>(null);
    const [loadingProf, setLoadingProf] = useState(true);

    // Form state
    const [courseCodeSelect, setCourseCodeSelect] = useState("");
    const [courseCodeOther, setCourseCodeOther] = useState("");
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [quarter, setQuarter] = useState("");
    const [year, setYear] = useState("");
    const [overall, setOverall] = useState(0);
    const [difficulty, setDifficulty] = useState(0);
    const [clarity, setClarity] = useState(0);
    const [helpfulness, setHelpfulness] = useState(0);
    const [wouldTakeAgain, setWouldTakeAgain] = useState<boolean | null>(null);
    const [review, setReview] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [customTagInput, setCustomTagInput] = useState("");
    const MAX_CUSTOM_TAGS = 3;
    const [grade, setGrade] = useState("");
    const [attendanceMandatory, setAttendanceMandatory] = useState<string>("");
    const [textbookRequired, setTextbookRequired] = useState<string>("");

    // Submission state
    const [submitState, setSubmitState] = useState<SubmitState>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [showConfirmModal, setShowConfirmModal] = useState(false);

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

    // If editing, fetch existing review and pre-fill form
    useEffect(() => {
        if (!editReviewId) return;
        getDoc(doc(db, "reviews", editReviewId))
            .then((snap) => {
                if (!snap.exists()) return;
                const data = snap.data() as ExistingReview;

                // Pre-fill course code
                const code = data.course?.code ?? "";
                // Use select if it matches a course in the list, otherwise "other"
                setCourseCodeSelect(code); // will fall back to "other" if not found — handled in render
                setCourseCodeOther(code);

                // Lock term — just display, don't allow change
                setQuarter(data.term?.quarter ?? "");
                setYear(String(data.term?.year ?? ""));

                // Scores
                setOverall(data.scores?.overall ?? 0);
                setDifficulty(data.scores?.difficulty ?? 0);
                setClarity(data.scores?.clarity ?? 0);
                setHelpfulness(data.scores?.helpfulness ?? 0);
                setWouldTakeAgain(data.scores?.would_take_again ?? null);

                // Body + tags
                setReview(data.body ?? "");
                setSelectedTags(data.tags ?? []);

                // Optional
                setGrade(data.grade_received ?? "");
                setAttendanceMandatory(
                    data.attendance_mandatory === true ? "yes"
                        : data.attendance_mandatory === false ? "no"
                            : ""
                );
                setTextbookRequired(
                    data.textbook_required === true ? "yes"
                        : data.textbook_required === false ? "no"
                            : ""
                );
            });
    }, [editReviewId]);

    // Tag toggle
    function toggleTag(tag: string) {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    }

    function addCustomTag() {
        const normalized = customTagInput.trim().toLowerCase().slice(0, 20);
        if (!normalized) return;
        if (selectedTags.includes(normalized)) { setCustomTagInput(""); return; }
        const customCount = selectedTags.filter((t) => !TAGS.includes(t)).length;
        if (customCount >= MAX_CUSTOM_TAGS) return;
        setSelectedTags((prev) => [...prev, normalized]);
        setCustomTagInput("");
    }

    // Normalize course code
    function normalizeCourseCode(raw: string): string {
        const upper = raw.toUpperCase().trim();
        return upper.replace(/([A-Z&]+)\s*(\d)/, "$1 $2").replace(/\s{2,}/g, " ");
    }

    const courseCode =
        courseCodeSelect === "other"
            ? normalizeCourseCode(courseCodeOther)
            : courseCodeSelect;

    // Validation
    const MIN_REVIEW_LENGTH = 30;
    const reviewTooShort = review.trim().length > 0 && review.trim().length < MIN_REVIEW_LENGTH;
    const isValid =
        courseCode.trim().length > 0 &&
        (courseCodeSelect !== "other" || courseCodeOther.trim().length > 0) &&
        quarter.length > 0 &&
        year.length > 0 &&
        overall > 0 &&
        difficulty > 0 &&
        clarity > 0 &&
        helpfulness > 0 &&
        wouldTakeAgain !== null &&
        review.trim().length >= MIN_REVIEW_LENGTH;

    function getValidationErrors(): string[] {
        const errors: string[] = [];
        if (!courseCode.trim()) errors.push("Course Code is required");
        if (courseCodeSelect === "other" && !courseCodeOther.trim()) errors.push("Please enter a course code");
        if (!quarter) errors.push("Quarter is required");
        if (!year) errors.push("Year is required");
        if (overall === 0) errors.push("Overall Rating is required");
        if (clarity === 0) errors.push("Clarity rating is required");
        if (helpfulness === 0) errors.push("Helpfulness rating is required");
        if (difficulty === 0) errors.push("Difficulty rating is required");
        if (wouldTakeAgain === null) errors.push("Please answer: Would you take this professor again?");
        if (review.trim().length < MIN_REVIEW_LENGTH) errors.push(`Written Review must be at least ${MIN_REVIEW_LENGTH} characters`);
        return errors;
    }

    // Step 1: validate + show confirmation modal
    function handleSubmitClick() {
        const errors = getValidationErrors();
        if (errors.length > 0) {
            setValidationErrors(errors);
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        setValidationErrors([]);
        setShowConfirmModal(true);
    }

    // Step 2: confirmed — actually submit
    async function handleConfirmedSubmit() {
        setSubmitState("submitting");
        setErrorMsg("");

        const token = await user.getIdToken();

        try {
            let res: Response;

            if (isEdit) {
                // PATCH — edit existing review
                res = await fetch("/api/reviews", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        review_id: editReviewId,
                        scores: { overall, difficulty, clarity, helpfulness, would_take_again: wouldTakeAgain },
                        body: review.trim(),
                        tags: selectedTags,
                        grade_received: grade || null,
                        attendance_mandatory: attendanceMandatory === "yes" ? true : attendanceMandatory === "no" ? false : null,
                        textbook_required: textbookRequired === "yes" ? true : textbookRequired === "no" ? false : null,
                    }),
                });
            } else {
                // POST — new review
                res = await fetch("/api/reviews", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        professor_id: id,
                        course_code: courseCode,
                        quarter,
                        year: parseInt(year),
                        scores: { overall, difficulty, clarity, helpfulness, would_take_again: wouldTakeAgain },
                        body: review.trim(),
                        tags: selectedTags,
                        grade_received: grade || null,
                        attendance_mandatory: attendanceMandatory === "yes" ? true : attendanceMandatory === "no" ? false : null,
                        textbook_required: textbookRequired === "yes" ? true : textbookRequired === "no" ? false : null,
                    }),
                });
            }

            setShowConfirmModal(false);
            const data = await res.json();

            if (res.status === 400 && data.reason) {
                setSubmitState("moderated");
                const reasonMessages: Record<string, string> = {
                    moderation_unavailable_quota: "Our moderation system is temporarily unavailable (API quota exhausted). Reviews can't be submitted right now — try again later or tomorrow.",
                };
                setErrorMsg(reasonMessages[data.reason] ?? data.reason);
                return;
            }
            if (res.status === 403 && data.reason === "professor_accounts_cannot_review") {
                setSubmitState("error");
                setErrorMsg("Professor accounts cannot submit reviews.");
                return;
            }
            if (!res.ok) {
                setSubmitState("error");
                setErrorMsg(data.error ?? "Something went wrong. Please try again.");
                return;
            }

            setSubmitState("success");
        } catch {
            setShowConfirmModal(false);
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

    if (!professor) {
        return (
            <div className="rounded-lg bg-white dark:bg-gray-800 p-8 shadow-sm text-center">
                <p className="text-gray-600 dark:text-gray-300">Professor not found.</p>
                <Link href="/search" className="mt-4 inline-block text-sm text-husky-purple dark:text-husky-purpleLight hover:underline">
                    ← Back to search
                </Link>
            </div>
        );
    }

    // ── Success ────────────────────────────────────────────────────────────────
    if (submitState === "success") {
        return (
            <div className="rounded-lg bg-white dark:bg-gray-800 p-10 shadow-sm text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <svg className="h-7 w-7 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {isEdit ? "Review updated!" : "Review submitted!"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your review for <span className="font-medium">{professor.name}</span> has been {isEdit ? "updated" : "published"}.
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
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                        Browse more professors
                    </Link>
                </div>
            </div>
        );
    }

    // Determine if course code from existing review matches a known course
    const knownCourses = professor.courses_taught ?? [];
    const resolvedCourseCodeSelect = isEdit
        ? (knownCourses.includes(courseCodeSelect) ? courseCodeSelect : "other")
        : courseCodeSelect;

    // ── Main form ──────────────────────────────────────────────────────────────
    return (
        <>
            {/* Confirmation modal */}
            {showConfirmModal && (
                <SubmitConfirmModal
                    isEdit={isEdit}
                    onConfirm={handleConfirmedSubmit}
                    onCancel={() => setShowConfirmModal(false)}
                    submitting={submitState === "submitting"}
                />
            )}

            <div className="space-y-6">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Link href="/search" className="hover:text-husky-purple dark:hover:text-husky-purpleLight">Search</Link>
                    <span>›</span>
                    <Link href={`/professors/${id}`} className="hover:text-husky-purple dark:hover:text-husky-purpleLight">{professor.name}</Link>
                    <span>›</span>
                    <span className="text-gray-900 dark:text-gray-100">{isEdit ? "Edit Review" : "Write a Review"}</span>
                </nav>

                {/* Header card */}
                <div className="rounded-lg bg-white dark:bg-gray-800 px-8 py-6 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-husky-purple dark:text-husky-purpleLight">{professor.name}</h1>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                {professor.department} · {professor.campus?.join(", ")}
                            </p>
                            {isEdit && (
                                <span className="mt-2 inline-block rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                    ✏️ Editing existing review
                                </span>
                            )}
                        </div>

                    </div>
                </div>

                {/* Validation errors */}
                {validationErrors.length > 0 && (
                    <div className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                        <p className="mb-1.5 font-semibold">Please fix the following before submitting:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {validationErrors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                    </div>
                )}

                {/* Form card */}
                <div className="rounded-lg bg-white dark:bg-gray-800 px-8 py-7 shadow-sm space-y-8">

                    {/* ── Section 1: Course info ── */}
                    <section className="space-y-5">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Course Details</h2>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Course Code <span className="text-red-500 dark:text-red-400">*</span>
                                    {isEdit && <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(locked — cannot be changed)</span>}
                                </label>
                                {isEdit ? (
                                    // Locked display in edit mode
                                    <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        {courseCode || courseCodeOther || "—"}
                                    </div>
                                ) : (
                                    <>
                                        <select
                                            value={courseCodeSelect}
                                            onChange={(e) => { setCourseCodeSelect(e.target.value); setCourseCodeOther(""); }}
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                                        >
                                            <option value="">Select a course…</option>
                                            {(professor.courses_taught ?? []).map((c) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                            <option value="other">Other (type it in)</option>
                                        </select>
                                        {courseCodeSelect === "other" && (
                                            <div className="mt-2">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. CSS 343 or B & A 300"
                                                    value={courseCodeOther}
                                                    onChange={(e) => setCourseCodeOther(e.target.value)}
                                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                                                    autoFocus
                                                />
                                                {courseCodeOther.trim() && (
                                                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                                        Will be saved as: <span className="font-medium text-gray-700 dark:text-gray-300">{normalizeCourseCode(courseCodeOther)}</span>
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Quarter — locked in edit mode */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Quarter <span className="text-red-500 dark:text-red-400">*</span>
                                    {isEdit && <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(locked)</span>}
                                </label>
                                {isEdit ? (
                                    <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        {quarter || "—"}
                                    </div>
                                ) : (
                                    <select
                                        value={quarter}
                                        onChange={(e) => setQuarter(e.target.value)}
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                                    >
                                        <option value="">Select quarter…</option>
                                        {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                )}
                            </div>

                            {/* Year — locked in edit mode */}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Year <span className="text-red-500 dark:text-red-400">*</span>
                                    {isEdit && <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">(locked)</span>}
                                </label>
                                {isEdit ? (
                                    <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                                        <svg className="h-3.5 w-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                        {year || "—"}
                                    </div>
                                ) : (
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(e.target.value)}
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple"
                                    >
                                        <option value="">Select year…</option>
                                        {[...YEARS].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-gray-700" />

                    {/* ── Section 2: Ratings ── */}
                    <section className="space-y-5">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Ratings</h2>

                        <StarRating label={<>Overall Rating <span className="text-red-500 dark:text-red-400">*</span></>} value={overall} onChange={setOverall} />
                        <StarRating label={<>Clarity <span className="text-red-500 dark:text-red-400">*</span></>} value={clarity} onChange={setClarity} />
                        <StarRating label={<>Helpfulness <span className="text-red-500 dark:text-red-400">*</span></>} value={helpfulness} onChange={setHelpfulness} />
                        <DifficultyPicker value={difficulty} onChange={setDifficulty} />

                        <div>
                            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Would you take this professor again? <span className="text-red-500 dark:text-red-400">*</span>
                            </span>
                            <div className="flex gap-3">
                                {([true, false] as const).map((val) => (
                                    <button
                                        key={String(val)}
                                        type="button"
                                        onClick={() => setWouldTakeAgain(val)}
                                        className={`rounded-md border px-5 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-husky-purple focus:ring-offset-1 ${wouldTakeAgain === val
                                            ? "border-husky-purple bg-husky-purple text-white"
                                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-husky-purple hover:text-husky-purple dark:hover:text-husky-purpleLight"
                                            }`}
                                    >
                                        {val ? "Yes" : "No"}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-gray-700" />

                    {/* ── Section 3: Written review ── */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Your Review</h2>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Written Review <span className="text-red-500 dark:text-red-400">*</span>
                            </label>
                            <textarea
                                rows={5}
                                placeholder="Describe your experience — lectures, workload, exams, how the professor communicates…"
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${reviewTooShort
                                    ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                                    : "border-gray-300 dark:border-gray-600 focus:border-husky-purple focus:ring-husky-purple"
                                    }`}
                            />
                            <div className="mt-1 flex justify-between text-xs">
                                {reviewTooShort ? (
                                    <span className="text-red-500 dark:text-red-400">
                                        {MIN_REVIEW_LENGTH - review.trim().length} more characters needed
                                    </span>
                                ) : (
                                    <span className="text-gray-400 dark:text-gray-500">Minimum {MIN_REVIEW_LENGTH} characters</span>
                                )}
                                <span className={review.trim().length >= MIN_REVIEW_LENGTH ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"}>
                                    {review.trim().length} / {MIN_REVIEW_LENGTH}+
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Tags <span className="font-normal text-gray-400 dark:text-gray-500">(optional)</span>
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none ${selectedTags.includes(tag)
                                            ? "border-husky-purple bg-husky-purple text-white"
                                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-husky-purple hover:text-husky-purple dark:hover:text-husky-purpleLight"
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                                {selectedTags.filter((t) => !TAGS.includes(t)).map((tag) => (
                                    <span key={tag} className="flex items-center gap-1 rounded-full border border-husky-purple bg-husky-purple px-3 py-1 text-xs font-medium text-white">
                                        {tag}
                                        <button type="button" onClick={() => toggleTag(tag)} className="ml-0.5 leading-none hover:text-husky-gold focus:outline-none" aria-label={`Remove tag ${tag}`}>×</button>
                                    </span>
                                ))}
                            </div>
                            {selectedTags.filter((t) => !TAGS.includes(t)).length < MAX_CUSTOM_TAGS && (
                                <div className="mt-2 flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Add your own tag…"
                                        value={customTagInput}
                                        maxLength={20}
                                        onChange={(e) => setCustomTagInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                                        className="rounded-full border border-dashed border-gray-300 dark:border-gray-600 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple w-44"
                                    />
                                    {customTagInput.trim() && (
                                        <button type="button" onClick={addCustomTag} className="rounded-full border border-husky-purple px-3 py-1 text-xs font-medium text-husky-purple dark:text-husky-purpleLight hover:bg-husky-purple hover:text-white transition-colors focus:outline-none">
                                            Add
                                        </button>
                                    )}
                                </div>
                            )}
                            {selectedTags.filter((t) => !TAGS.includes(t)).length >= MAX_CUSTOM_TAGS && (
                                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">Maximum {MAX_CUSTOM_TAGS} custom tags reached.</p>
                            )}
                        </div>
                    </section>

                    <hr className="border-gray-100 dark:border-gray-700" />

                    {/* ── Section 4: Optional extras ── */}
                    <section className="space-y-5">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Optional Details</h2>

                        <div className="grid gap-5 sm:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Grade Received</label>
                                <select value={grade} onChange={(e) => setGrade(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple">
                                    <option value="">Select…</option>
                                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Attendance Required</label>
                                <select value={attendanceMandatory} onChange={(e) => setAttendanceMandatory(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple">
                                    <option value="">Select…</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Textbook Required</label>
                                <select value={textbookRequired} onChange={(e) => setTextbookRequired(e.target.value)}
                                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:border-husky-purple focus:outline-none focus:ring-1 focus:ring-husky-purple">
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
                            ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
                            : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                            }`}>
                            {submitState === "moderated" && <p className="mb-0.5 font-medium">Review flagged for moderation</p>}
                            {errorMsg}
                        </div>
                    )}

                    {/* ── Submit row ── */}
                    <div className="flex items-center justify-between pt-1">
                        <Link href={`/professors/${id}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-husky-purple dark:hover:text-husky-purpleLight">
                            ← Cancel
                        </Link>
                        <button
                            type="button"
                            onClick={handleSubmitClick}
                            disabled={!isValid || submitState === "submitting"}
                            className="flex items-center gap-2 rounded-md bg-husky-purple px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-husky-purple/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isEdit ? "Update Review" : "Submit Review"}
                        </button>
                    </div>

                    <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                        {isEdit
                            ? "Updating will overwrite your previous review text and scores."
                            : "Submitting a review for a course you've already reviewed will overwrite your previous one."}
                    </p>
                </div>
            </div>
        </>
    );
}
