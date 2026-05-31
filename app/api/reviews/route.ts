// app/api/reviews/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireUwUser } from "@/lib/serverAuth";
import { flashModel } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEWS_COLLECTION = "reviews";
const PROFESSORS_COLLECTION = "professors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidScore(n: unknown, min = 1, max = 5): boolean {
    return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
}

type ProfessorProfileLite = {
    id: string;
    name?: string;
    email?: string;
};

async function findProfessorByEmail(email: string): Promise<ProfessorProfileLite | null> {
    const normalized = email.trim().toLowerCase();

    const exactSnap = await adminDb
        .collection(PROFESSORS_COLLECTION)
        .where("email", "==", email)
        .limit(1)
        .get();
    if (!exactSnap.empty) {
        const doc = exactSnap.docs[0];
        return { id: doc.id, ...(doc.data() as Omit<ProfessorProfileLite, "id">) };
    }

    if (normalized !== email) {
        const normalizedSnap = await adminDb
            .collection(PROFESSORS_COLLECTION)
            .where("email", "==", normalized)
            .limit(1)
            .get();
        if (!normalizedSnap.empty) {
            const doc = normalizedSnap.docs[0];
            return { id: doc.id, ...(doc.data() as Omit<ProfessorProfileLite, "id">) };
        }
    }

    return null;
}

async function isProfessorAccount(email: string): Promise<boolean> {
    console.log("[/api/reviews] Professor check conducted for email:", email);
    const professor = await findProfessorByEmail(email);
    if (professor) {
        console.log("[/api/reviews] Professor matched:", {
            professorId: professor.id,
            professorName: professor.name ?? "(unknown)",
            professorEmail: professor.email ?? email,
        });
        return true;
    }
    console.log("[/api/reviews] Professor check result: no professor match", { email });
    return false;
}

async function moderateReview(body: string): Promise<{ pass: boolean; reason: string }> {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("[/api/reviews] GEMINI_API_KEY not set — skipping moderation");
        return { pass: false, reason: "moderation_skipped_no_key" };
    }

    const prompt = `
You are a strict content moderator for a university professor review platform.
Reject ANY review that meets one or more of these conditions:
- Contains promotional content, links, or spam (e.g. "buy my", "visit my site")
- Is a personal attack with zero academic content
- Contains no mention of teaching, course content, workload, exams, or classroom experience
- Is gibberish or completely off-topic

A review ONLY passes if it contains specific, genuine feedback about a professor's teaching or a course experience.

Reply with JSON only, no markdown:
{ "pass": boolean, "reason": string }

Review: "${body.replace(/"/g, '\\"')}"
`.trim();

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const result = await flashModel.generateContent(prompt);
            const raw = result.response.text().trim();
            const text = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
            const parsed = JSON.parse(text);
            console.log("[moderation] passed:", { reviewBody: body.slice(0, 120), parsed });
            return parsed;
        } catch (err) {
            const errStr = String(err);
            const isQuotaError = errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED");
            if (isQuotaError && attempt < MAX_ATTEMPTS) {
                const backoffMs = 2000 * attempt;
                console.warn(`[/api/reviews] Gemini quota hit (attempt ${attempt}/${MAX_ATTEMPTS}), retrying in ${backoffMs}ms`);
                await new Promise((res) => setTimeout(res, backoffMs));
                continue;
            }
            console.error("[moderation] error:", { attempt, error: errStr, reviewBody: body.slice(0, 120) });
            if (isQuotaError) return { pass: false, reason: "moderation_unavailable_quota" };
            return { pass: false, reason: "parse_error_defaulted_pass" };
        }
    }

    return { pass: false, reason: "moderation_failed_unknown" };
}

// ─── POST /api/reviews ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    // 1. Auth
    const authResult = await requireUwUser(req);
    if (!authResult.ok) return authResult.response;
    const { decoded, email } = authResult;

    const professorAccount = await isProfessorAccount(email);
    if (professorAccount) {
        return NextResponse.json(
            { error: "Professor accounts cannot submit reviews.", reason: "professor_accounts_cannot_review" },
            { status: 403 }
        );
    }

    const netid = email.split("@")[0];

    // 2. Parse body
    let data: {
        professor_id: string;
        course_code: string;
        course_name?: string;
        quarter: string;
        year: number;
        scores: {
            overall: number;
            difficulty: number;
            clarity: number;
            helpfulness: number;
            would_take_again: boolean;
        };
        body: string;
        tags?: string[];
        attendance_mandatory?: boolean | null;
        grade_received?: string | null;
        textbook_required?: boolean | null;
    };

    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { professor_id, course_code, quarter, year, scores, body: reviewBody } = data;

    // 3. Required fields
    if (!professor_id || !course_code || !quarter || !year || !scores || !reviewBody) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // 4. Score validation
    if (
        !isValidScore(scores.overall) ||
        !isValidScore(scores.difficulty) ||
        !isValidScore(scores.clarity) ||
        !isValidScore(scores.helpfulness) ||
        typeof scores.would_take_again !== "boolean"
    ) {
        return NextResponse.json(
            { error: "Invalid scores. overall/difficulty/clarity/helpfulness must be 1–5; would_take_again must be boolean." },
            { status: 400 }
        );
    }

    // 6. Pre-filter spam
    const spamPatterns = [/buy\s+my/i, /http/i, /\bsucks\b/i, /^[a-z\s]{1,6}(\s[a-z]{1,6}){3,}$/i];
    if (spamPatterns.some((p) => p.test(reviewBody))) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: "Contains spam or prohibited content." },
            { status: 400 }
        );
    }

    // 7. Gemini moderation
    const mod = await moderateReview(reviewBody);
    if (!mod.pass) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: mod.reason },
            { status: 400 }
        );
    }

    // 8. Read campus server-side
    const profRef = adminDb.collection(PROFESSORS_COLLECTION).doc(professor_id);
    const profSnap = await profRef.get();
    if (!profSnap.exists) {
        return NextResponse.json({ error: "Professor not found." }, { status: 404 });
    }
    const profData = profSnap.data()!;
    const campus: string = Array.isArray(profData.campus) ? profData.campus[0] : (profData.campus ?? "Unknown");

    // 9. Write review
    const campusSlug = campus.replace(/\s+/g, "");
    const courseSlug = course_code.replace(/\s+/g, "");
    const docId = `${netid}_${professor_id}_${courseSlug}_${campusSlug}_${quarter}${year}`;
    const reviewRef = adminDb.collection(REVIEWS_COLLECTION).doc(docId);

    const reviewDoc = {
        id: docId,
        professor_id,
        author_id: decoded.uid,
        verified: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: null,
        status: "published" as const,
        flagged: false,
        campus,
        course: { code: course_code, name: data.course_name ?? "" },
        term: { quarter, year },
        scores,
        body: reviewBody,
        tags: data.tags ?? [],
        grade_received: data.grade_received ?? null,
        attendance_mandatory: data.attendance_mandatory ?? null,
        textbook_required: data.textbook_required ?? null,
        votes: { helpful: 0, not_helpful: 0 },
        voter_ids: [],
    };

    // Check if this is an overwrite (same composite key already exists)
    const existingReviewSnap = await reviewRef.get();
    const isOverwrite = existingReviewSnap.exists;
    const prevOverallForOverwrite: number = isOverwrite
        ? (existingReviewSnap.data()!.scores?.overall ?? 0)
        : 0;

    try {
        await reviewRef.set(reviewDoc);
    } catch (err) {
        console.error("[/api/reviews] Firestore write failed:", err);
        return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
    }

    // 10. Update professor aggregate
    try {
        await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(profRef);
            if (!snap.exists) return;
            const current = snap.data()!;
            const prevCount: number = current.ratings_count ?? 0;
            const prevAvg: number = current.overall_rating ?? 0;

            let newCount: number;
            let newAvg: number;

            if (isOverwrite) {
                // Replace old score in the average, count stays the same
                newCount = prevCount;
                newAvg = prevCount === 0
                    ? scores.overall
                    : Math.round(((prevAvg * prevCount - prevOverallForOverwrite + scores.overall) / prevCount) * 10) / 10;
            } else {
                // New review — increment count
                newCount = prevCount + 1;
                newAvg = Math.round(((prevAvg * prevCount + scores.overall) / newCount) * 10) / 10;
            }

            tx.update(profRef, { ratings_count: newCount, overall_rating: newAvg });
        });
    } catch (err) {
        console.error("[/api/reviews] professor aggregate update failed:", err);
    }

    return NextResponse.json({ ok: true, id: docId });
}

// ─── PATCH /api/reviews ───────────────────────────────────────────────────────
// Body: { review_id, scores, body, tags, grade_received, attendance_mandatory, textbook_required }
// Term (quarter/year) and course_code are locked — cannot be changed on edit.

export async function PATCH(req: NextRequest) {
    const authResult = await requireUwUser(req);
    if (!authResult.ok) return authResult.response;
    const { decoded } = authResult;

    let data: {
        review_id: string;
        scores: {
            overall: number;
            difficulty: number;
            clarity: number;
            helpfulness: number;
            would_take_again: boolean;
        };
        body: string;
        tags?: string[];
        attendance_mandatory?: boolean | null;
        grade_received?: string | null;
        textbook_required?: boolean | null;
    };

    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { review_id, scores, body: reviewBody } = data;

    if (!review_id || !scores || !reviewBody) {
        return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // Score validation
    if (
        !isValidScore(scores.overall) ||
        !isValidScore(scores.difficulty) ||
        !isValidScore(scores.clarity) ||
        !isValidScore(scores.helpfulness) ||
        typeof scores.would_take_again !== "boolean"
    ) {
        return NextResponse.json({ error: "Invalid scores." }, { status: 400 });
    }

    // Fetch existing review and verify ownership
    const reviewRef = adminDb.collection(REVIEWS_COLLECTION).doc(review_id);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
        return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    const existing = reviewSnap.data()!;
    if (existing.author_id !== decoded.uid) {
        return NextResponse.json({ error: "You can only edit your own reviews." }, { status: 403 });
    }

    // Spam pre-filter
    const spamPatterns = [/buy\s+my/i, /http/i, /\bsucks\b/i, /^[a-z\s]{1,6}(\s[a-z]{1,6}){3,}$/i];
    if (spamPatterns.some((p) => p.test(reviewBody))) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: "Contains spam or prohibited content." },
            { status: 400 }
        );
    }

    // Gemini moderation
    const mod = await moderateReview(reviewBody);
    if (!mod.pass) {
        return NextResponse.json(
            { error: "Review did not pass moderation.", reason: mod.reason },
            { status: 400 }
        );
    }

    // Update — preserve created_at, term, course, campus (all locked)
    const prevOverall: number = existing.scores?.overall ?? 0;
    const updates = {
        scores,
        body: reviewBody,
        tags: data.tags ?? [],
        grade_received: data.grade_received ?? null,
        attendance_mandatory: data.attendance_mandatory ?? null,
        textbook_required: data.textbook_required ?? null,
        updated_at: FieldValue.serverTimestamp(),
    };

    try {
        await reviewRef.update(updates);
    } catch (err) {
        console.error("[/api/reviews PATCH] Firestore write failed:", err);
        return NextResponse.json({ error: "Failed to update review." }, { status: 500 });
    }

    // Recalculate professor aggregate if overall score changed
    if (prevOverall !== scores.overall) {
        try {
            const profRef = adminDb.collection(PROFESSORS_COLLECTION).doc(existing.professor_id);
            await adminDb.runTransaction(async (tx) => {
                const snap = await tx.get(profRef);
                if (!snap.exists) return;
                const current = snap.data()!;
                const count: number = current.ratings_count ?? 1;
                const currentAvg: number = current.overall_rating ?? 0;
                // Reverse out old score, add new score
                const newAvg = Math.round(((currentAvg * count - prevOverall + scores.overall) / count) * 10) / 10;
                tx.update(profRef, { overall_rating: newAvg });
            });
        } catch (err) {
            console.error("[/api/reviews PATCH] professor aggregate update failed:", err);
        }
    }

    return NextResponse.json({ ok: true, id: review_id });
}

// ─── DELETE /api/reviews ──────────────────────────────────────────────────────
// Body: { review_id }

export async function DELETE(req: NextRequest) {
    const authResult = await requireUwUser(req);
    if (!authResult.ok) return authResult.response;
    const { decoded } = authResult;

    let data: { review_id: string };
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { review_id } = data;
    if (!review_id) {
        return NextResponse.json({ error: "review_id is required." }, { status: 400 });
    }

    const reviewRef = adminDb.collection(REVIEWS_COLLECTION).doc(review_id);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
        return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    const existing = reviewSnap.data()!;
    if (existing.author_id !== decoded.uid) {
        return NextResponse.json({ error: "You can only delete your own reviews." }, { status: 403 });
    }

    const deletedOverall: number = existing.scores?.overall ?? 0;
    const professor_id: string = existing.professor_id;

    try {
        await reviewRef.delete();
    } catch (err) {
        console.error("[/api/reviews DELETE] Firestore delete failed:", err);
        return NextResponse.json({ error: "Failed to delete review." }, { status: 500 });
    }

    // Update professor aggregate
    try {
        const profRef = adminDb.collection(PROFESSORS_COLLECTION).doc(professor_id);
        await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(profRef);
            if (!snap.exists) return;
            const current = snap.data()!;
            const prevCount: number = current.ratings_count ?? 1;
            const prevAvg: number = current.overall_rating ?? 0;
            const newCount = Math.max(0, prevCount - 1);
            const newAvg =
                newCount === 0
                    ? 0
                    : Math.round(((prevAvg * prevCount - deletedOverall) / newCount) * 10) / 10;
            tx.update(profRef, { ratings_count: newCount, overall_rating: newAvg });
        });
    } catch (err) {
        console.error("[/api/reviews DELETE] professor aggregate update failed:", err);
    }

    return NextResponse.json({ ok: true });
}